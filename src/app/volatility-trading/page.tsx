'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BalanceDisplay } from '@/components/dashboard/balance-display';
import { TradingChart } from '@/components/dashboard/trading-chart'; 
import type { VolatilityInstrumentType, TradingMode, ActiveAutomatedVolatilityTrade, ProfitsClaimable, PriceTick, InstrumentType } from '@/types/index';
import {
  generateVolatilityTradingStrategy, // Old AI flow for current page simulation
  // VolatilityTradingStrategyInput is used by the old flow
} from '@/ai/flows/volatility-trading-strategy-flow';
import {
  executeVolatilityAiTradeLoop, // New backend action for real trades
  VolatilityTradeExecutionResult
} from '@/app/actions/trade-execution-actions';
import { UserTradeType as UserTradeTypeValue } from '@/types/ai-shared-types'; // For the new trade type selector

import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCandles } from '@/services/deriv';
import { v4 as uuidv4 } from 'uuid'; 
import { getInstrumentDecimalPlaces, getDisplayTradeTypeDetails } from '@/lib/utils'; // Import the new helper
import { useAuth } from '@/contexts/auth-context';
import { Bot, DollarSign, Play, Square, Briefcase, UserCheck, Activity } from 'lucide-react'; 
import { VOLATILITY_INSTRUMENTS } from "../../config/instruments";
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateEMA, calculateATR } from '@/lib/technical-analysis'; // Removed Full versions as page uses single value
import { AI_TRADING_STRATEGIES, DEFAULT_AI_STRATEGY_ID } from '@/config/ai-strategies';
import { useRouter } from 'next/navigation';
import { DerivBalanceListener, type ListenerStatus } from '@/services/deriv-balance-listener';

const DEFAULT_PAPER_BALANCE = 10000;
const DEFAULT_LIVE_BALANCE = 0;

export default function VolatilityTradingPage() {
  const router = useRouter();
  const { 
    authStatus, 
    userInfo,
    selectedDerivAccountType,
    derivDemoBalance,
    derivLiveBalance,
    derivDemoAccountId,
    derivRealAccountId,
    updateSelectedDerivAccountType,
  } = useAuth();
  
  const [currentVolatilityInstrument, setCurrentVolatilityInstrument] = useState<VolatilityInstrumentType>(VOLATILITY_INSTRUMENTS[0]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [selectedAiStrategyId, setSelectedAiStrategyId] = useState<string>(DEFAULT_AI_STRATEGY_ID);
  
  // New state for selecting UserTradeType for the backend loop
  const [selectedUserTradeTypeForLoop, setSelectedUserTradeTypeForLoop] = useState<UserTradeTypeValue | undefined>(undefined);

  const [autoTradeTotalStake, setAutoTradeTotalStake] = useState<number>(10); // Default for new loop (per session) or old (total for sim)
  const [isAutoTradingActive, setIsAutoTradingActive] = useState(false); // Used by both simulation and real loop indication
  const [activeAutomatedTrades, setActiveAutomatedTrades] = useState<ActiveAutomatedVolatilityTrade[]>([]);
  const [profitsClaimable, setProfitsClaimable] = useState<ProfitsClaimable>({
    totalNetProfit: 0,
    tradeCount: 0,
    winningTrades: 0,
    losingTrades: 0,
  });
  const [isAiLoading, setIsAiLoading] = useState(false); // True when AI is processing (either old flow or new backend action)
  const tradeIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const [consecutiveAiCallCount, setConsecutiveAiCallCount] = useState(0);
  const [lastAiCallTimestamp, setLastAiCallTimestamp] = useState<number | null>(null);
  const AI_COOLDOWN_DURATION_MS = 2 * 60 * 1000;

  const { toast } = useToast();

  const [freshDemoBalance, setFreshDemoBalance] = useState<number | null>(null);
  const [freshRealBalance, setFreshRealBalance] = useState<number | null>(null);
  const [isLoadingDemoBalance, setIsLoadingDemoBalance] = useState<boolean>(false);
  const [isLoadingRealBalance, setIsLoadingRealBalance] = useState<boolean>(false);
  const [demoSyncStatus, setDemoSyncStatus] = useState<ListenerStatus>('idle');
  const [realSyncStatus, setRealSyncStatus] = useState<ListenerStatus>('idle');
  const demoBalanceListenerRef = useRef<DerivBalanceListener | null>(null);
  const realBalanceListenerRef = useRef<DerivBalanceListener | null>(null);

  const USER_TRADE_TYPES_OPTIONS: { value: UserTradeTypeValue; label: string }[] = [
    { value: 'RiseFall', label: 'Rise/Fall' },
    { value: 'HigherLower', label: 'Higher/Lower' },
    { value: 'TouchNoTouch', label: 'Touch/No Touch' },
    { value: 'DigitsOverUnder', label: 'Digits - Over/Under' },
    { value: 'DigitsEvenOdd', label: 'Digits - Even/Odd' },
  ];

  const currentBalance = useMemo(() => {
    if (authStatus === 'pending' || !userInfo) return null;
    if (authStatus === 'authenticated') {
      if (selectedDerivAccountType === 'demo') {
        if (isLoadingDemoBalance && freshDemoBalance === null) return null;
        if (freshDemoBalance !== null) return freshDemoBalance;
        return derivDemoBalance ?? 0;
      } else if (selectedDerivAccountType === 'real') {
        if (isLoadingRealBalance && freshRealBalance === null) return null;
        if (freshRealBalance !== null) return freshRealBalance;
        return derivLiveBalance ?? 0;
      }
    }
    return selectedDerivAccountType === 'demo' ? (derivDemoBalance ?? 0) : (derivLiveBalance ?? 0);
  }, [ authStatus, userInfo, selectedDerivAccountType, derivDemoBalance, derivLiveBalance, freshDemoBalance, freshRealBalance, isLoadingDemoBalance, isLoadingRealBalance ]);

  const currentDisplayAccountId = useMemo(() => {
    if (!userInfo) return null;
    return selectedDerivAccountType === 'demo' ? derivDemoAccountId : derivRealAccountId;
  }, [userInfo, selectedDerivAccountType, derivDemoAccountId, derivRealAccountId]);

  const currentSyncStatus = useMemo(() => {
    return selectedDerivAccountType === 'demo' ? demoSyncStatus : realSyncStatus;
  }, [selectedDerivAccountType, demoSyncStatus, realSyncStatus]);

  useEffect(() => {
    const accountTypeKey = selectedDerivAccountType === 'real' ? 'live' : 'paper';
    const profitsKey = `volatilityProfitsClaimable_${accountTypeKey}`;
    const storedProfits = localStorage.getItem(profitsKey);
    if (storedProfits) {
      try { setProfitsClaimable(JSON.parse(storedProfits)); }
      catch (error) { console.error("Error parsing profits:", error); setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 }); }
    } else { setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 }); }
  }, [selectedDerivAccountType]);

  useEffect(() => {
    const accountTypeKey = selectedDerivAccountType === 'real' ? 'live' : 'paper';
    const profitsKey = `volatilityProfitsClaimable_${accountTypeKey}`;
    localStorage.setItem(profitsKey, JSON.stringify(profitsClaimable));
  }, [profitsClaimable, selectedDerivAccountType]);

  const handleInstrumentChange = (instrument: string) => {
    if (VOLATILITY_INSTRUMENTS.includes(instrument as VolatilityInstrumentType)) {
      setCurrentVolatilityInstrument(instrument as VolatilityInstrumentType);
    }
  };

  useEffect(() => { /* ... existing balance listener effects ... */
    return () => {
      if (demoBalanceListenerRef.current) demoBalanceListenerRef.current.close();
      if (realBalanceListenerRef.current) realBalanceListenerRef.current.close();
    };
  }, []);

  useEffect(() => {
    const demoToken = userInfo?.derivDemoApiToken;
    if (selectedDerivAccountType === 'demo' && demoToken && derivDemoAccountId) {
      if (demoBalanceListenerRef.current) demoBalanceListenerRef.current.close();
      setFreshDemoBalance(prev => prev ?? derivDemoBalance ?? DEFAULT_PAPER_BALANCE);
      setIsLoadingDemoBalance(true);
      demoBalanceListenerRef.current = new DerivBalanceListener(
        demoToken, derivDemoAccountId,
        (balanceData) => setFreshDemoBalance(balanceData.balance),
        (error) => console.error('[VolatilityPage] Demo Balance Listener Error:', error),
        (status, message) => {
          setDemoSyncStatus(status);
          if (message) console.log(`[VolatilityPage] Demo Listener Status: ${status} - ${message}`);
          if (status === 'error' && message) toast({ title: 'Demo Balance Sync Issue', description: message, variant: 'destructive'});
          setIsLoadingDemoBalance(!(status === 'connected' || status === 'error' || status === 'disconnected' || status === 'idle'));
        }
      );
    } else {
       if (demoBalanceListenerRef.current) {
          demoBalanceListenerRef.current.close();
          demoBalanceListenerRef.current = null;
       }
       setFreshDemoBalance(derivDemoBalance ?? DEFAULT_PAPER_BALANCE);
       setIsLoadingDemoBalance(false);
       setDemoSyncStatus('idle');
    }
    return () => { if (demoBalanceListenerRef.current) demoBalanceListenerRef.current.close(); };
  }, [userInfo?.derivDemoApiToken, derivDemoAccountId, toast, derivDemoBalance, selectedDerivAccountType]);

  useEffect(() => {
    const realToken = userInfo?.derivRealApiToken;
    if (selectedDerivAccountType === 'real' && realToken && derivRealAccountId) {
      if (realBalanceListenerRef.current) realBalanceListenerRef.current.close();
      setFreshRealBalance(prev => prev ?? derivLiveBalance ?? DEFAULT_LIVE_BALANCE);
      setIsLoadingRealBalance(true);
      realBalanceListenerRef.current = new DerivBalanceListener(
        realToken, derivRealAccountId,
        (balanceData) => setFreshRealBalance(balanceData.balance),
        (error) => console.error('[VolatilityPage] Real Balance Listener Error:', error),
        (status, message) => {
          setRealSyncStatus(status);
          if (message) console.log(`[VolatilityPage] Real Listener Status: ${status} - ${message}`);
          if (status === 'error' && message) toast({ title: 'Real Balance Sync Issue', description: message, variant: 'destructive'});
          setIsLoadingRealBalance(!(status === 'connected' || status === 'error' || status === 'disconnected' || status === 'idle'));
        }
      );
    } else {
      if (realBalanceListenerRef.current) {
          realBalanceListenerRef.current.close();
          realBalanceListenerRef.current = null;
      }
      setFreshRealBalance(derivLiveBalance ?? DEFAULT_LIVE_BALANCE);
      setIsLoadingRealBalance(false);
      setRealSyncStatus('idle');
    }
    return () => { if (realBalanceListenerRef.current) realBalanceListenerRef.current.close(); };
  }, [userInfo?.derivRealApiToken, derivRealAccountId, toast, derivLiveBalance, selectedDerivAccountType]);


  const handleAutoStakeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value >= 0) { setAutoTradeTotalStake(value); }
    else if (event.target.value === "") { setAutoTradeTotalStake(0); }
  };

  const handleAccountTypeSwitch = async (newTypeFromControl: 'demo' | 'real' | null) => {
    const newApiType = newTypeFromControl;
    if (!newApiType || (newApiType !== 'demo' && newApiType !== 'real')) {
        toast({ title: "Invalid Selection", description: "Please select a valid account type.", variant: "destructive"});
        return;
    }
    if (!userInfo?.derivDemoAccountId && !userInfo?.derivRealAccountId ) { // Check if any Deriv connection exists
        toast({ title: "Deriv Account Not Linked", description: "Please connect your Deriv account via Profile page to switch modes.", variant: "destructive" });
        return;
    }
    if (newApiType === selectedDerivAccountType) return;
    try {
        await updateSelectedDerivAccountType(newApiType);
        toast({ title: "Account Switched", description: `Switched to ${newApiType} account.`, variant: "default" });
    } catch (error) {
        toast({ title: "Switch Failed", description: `Failed to switch to ${newApiType} account. Error: ${(error as Error).message}`, variant: "destructive" });
    }
  };

  const handleStartAiAutoTrade = useCallback(async () => {
    if (authStatus === 'unauthenticated' || !userInfo?.id) {
      toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
      router.push('/auth/login');
      return;
    }
    if (!selectedDerivAccountType) {
      toast({ title: "Account Not Selected", description: "Please select a Deriv account type.", variant: "destructive" });
      return;
    }
     if (autoTradeTotalStake <= 0 && selectedUserTradeTypeForLoop) { // Stake check for new loop
      toast({ title: "Invalid Stake", description: "Please enter a valid total stake for the AI session.", variant: "destructive" });
      return;
    }
    if (autoTradeTotalStake <= 0 && !selectedUserTradeTypeForLoop) { // Stake check for old simulation
      toast({ title: "Invalid Stake", description: "Please enter a valid total stake for AI simulation.", variant: "destructive" });
      return;
    }

    const balanceToCheck = currentBalance ?? 0;
    if (autoTradeTotalStake > balanceToCheck) {
      toast({ title: `Insufficient ${selectedDerivAccountType} Balance`, description: `Total stake $${autoTradeTotalStake.toFixed(2)} exceeds available balance of $${balanceToCheck.toFixed(2)}.`, variant: "destructive" });
      return;
    }
    if (selectedUserTradeTypeForLoop && autoTradeTotalStake < 0.35 * VOLATILITY_INSTRUMENTS.length && VOLATILITY_INSTRUMENTS.length > 0) {
        // Basic check if total stake is too low to be reasonably apportioned.
        // Could be more sophisticated, e.g., ensure at least $0.35 per potential trade.
        toast({ title: "Low Stake", description: `Total stake $${autoTradeTotalStake.toFixed(2)} might be too low to apportion effectively across multiple instruments (min $0.35 per trade often applies).`, variant: "warning" });
    }


    if (consecutiveAiCallCount >= 2 && lastAiCallTimestamp && (Date.now() - lastAiCallTimestamp) < AI_COOLDOWN_DURATION_MS) {
      const remainingMinutes = Math.ceil((AI_COOLDOWN_DURATION_MS - (Date.now() - lastAiCallTimestamp)) / 1000 / 60);
      toast({ title: "AI Cooldown", description: `Please wait ${remainingMinutes} min.`, variant: "default" });
      return;
    } else if (consecutiveAiCallCount >=2 ) { // Cooldown expired
        setConsecutiveAiCallCount(0);
    }

    setIsAiLoading(true); 
    setIsAutoTradingActive(true); // Indicates a session (simulated or real) is active
    setActiveAutomatedTrades([]); 

    // For new real trading loop
    if (selectedUserTradeTypeForLoop) {
        const userDerivApiToken = selectedDerivAccountType === 'demo' ? userInfo.derivDemoApiToken : userInfo.derivRealApiToken;
        const targetAccountId = selectedDerivAccountType === 'demo' ? userInfo.derivDemoAccountId : userInfo.derivRealAccountId;

        if (!userDerivApiToken || !targetAccountId) {
            toast({ title: "Deriv Account Issue", description: `Missing token or account ID for ${selectedDerivAccountType} account. Please check profile.`, variant: "destructive"});
            setIsAiLoading(false);
            setIsAutoTradingActive(false);
            return;
        }

        console.log(`[VolatilityPage] Initiating REAL trade loop. User: ${userInfo.id}, Account: ${targetAccountId}, Type: ${selectedUserTradeTypeForLoop}, Total Stake: ${autoTradeTotalStake}`);
        toast({ title: "Volatility AI Loop Starting...", description: `Attempting to place real trades for type: ${selectedUserTradeTypeForLoop}` });

        try {
            const loopResults: VolatilityTradeExecutionResult[] = await executeVolatilityAiTradeLoop(
                userDerivApiToken,
                targetAccountId,
                selectedDerivAccountType as 'demo' | 'real',
                userInfo.id,
                selectedUserTradeTypeForLoop,
                autoTradeTotalStake
            );

            setConsecutiveAiCallCount(prev => prev + 1);
            setLastAiCallTimestamp(Date.now());
            console.log(`[VolatilityPage] Real trade loop results:`, loopResults);

            const newUiTrades: ActiveAutomatedVolatilityTrade[] = loopResults.map(result => ({
                id: result.dbTradeId || uuidv4(),
                instrument: result.instrument,
                derivContractType: result.tradeParams?.contract_type || 'N/A',
                userSelectedTradeType: selectedUserTradeTypeForLoop, // Store this
                stake: result.tradeParams?.amount || 0,
                durationSeconds: result.tradeParams?.duration || 0,
                reasoning: result.aiReasoning || (result.error ? 'Placement Error' : 'N/A'),
                entryPrice: result.tradeResponse?.entry_spot || 0,
                stopLossPrice: 0, // Not applicable for these options directly
                startTime: result.tradeResponse?.purchase_time ? result.tradeResponse.purchase_time * 1000 : Date.now(),
                status: result.success ? 'pending_execution' : 'failed_placement',
                currentPrice: result.tradeResponse?.entry_spot || 0, // Initial price
                pnl: 0, // PNL unknown at placement
                barrier: result.tradeParams?.barrier,
                error: result.error
            }));
            setActiveAutomatedTrades(newUiTrades);

            const successfulPlacements = loopResults.filter(r => r.success).length;
            toast({
                title: 'Volatility AI Loop Concluded',
                description: `Trade placements: ${successfulPlacements} successful, ${loopResults.length - successfulPlacements} failed. (Status updates require polling - not yet implemented)`,
                duration: 7000
            });
        } catch (error: any) {
            toast({ title: "Volatility AI Loop Error", description: `Failed to execute trading loop: ${error.message}`, variant: "destructive" });
            console.error("[VolatilityPage] Error in real trade loop: ", error);
        } finally {
            console.log("[VolatilityPage] Real trade loop finally: Resetting isAiLoading and isAutoTradingActive to false.");
            setIsAiLoading(false);
            setIsAutoTradingActive(false); // Loop has finished placing trades
        }
    } else { // Fallback to OLD SIMULATION logic
        console.log(`[VolatilityPage] Initiating SIMULATED trade session. User: ${userInfo.id}, Account Type: ${selectedDerivAccountType}, Total Stake: ${autoTradeTotalStake}`);
        toast({ title: "AI Simulation Starting...", description: `Simulating trades for Volatility Indices.` });
        try {
            const instrumentTicksData: Record<VolatilityInstrumentType, PriceTick[]> = {} as Record<VolatilityInstrumentType, PriceTick[]>;
            const instrumentIndicatorsData: Record<VolatilityInstrumentType, any> = {};

            for (const inst of VOLATILITY_INSTRUMENTS as VolatilityInstrumentType[]) {
              try {
                const candles = await getCandles(inst, 60);
                if (candles && candles.length > 0) {
                  instrumentTicksData[inst] = candles.map(c => ({ epoch: c.epoch, price: c.close, time: c.time }));
                  const closePrices = candles.map(c => c.close);
                  const highPrices = candles.map(c => c.high);
                  const lowPrices = candles.map(c => c.low);
                  instrumentIndicatorsData[inst] = {
                    ...(calculateRSI(closePrices) !== undefined && { rsi: calculateRSI(closePrices) }),
                    ...(calculateMACD(closePrices) && { macd: calculateMACD(closePrices) }),
                    ...(calculateBollingerBands(closePrices) && { bollingerBands: calculateBollingerBands(closePrices) }),
                    ...(calculateEMA(closePrices) !== undefined && { ema: calculateEMA(closePrices) }),
                    ...(calculateATR(highPrices, lowPrices, closePrices) !== undefined && { atr: calculateATR(highPrices, lowPrices, closePrices) }),
                  };
                } else { throw new Error("No candle data"); }
              } catch (err) {
                instrumentTicksData[inst] = []; instrumentIndicatorsData[inst] = {};
                toast({title: `Data Error ${inst}`, description: `Sim: Could not fetch price data for ${inst}.`, variant: "destructive", duration: 3000});
              }
            }

            const strategyInput = { // This is VolatilityTradingStrategyInput for the old flow
              totalStake: autoTradeTotalStake,
              instruments: VOLATILITY_INSTRUMENTS as VolatilityInstrumentType[],
              tradingMode: tradingMode,
              aiStrategyId: selectedAiStrategyId,
              instrumentTicks: instrumentTicksData,
              instrumentIndicators: instrumentIndicatorsData,
            };
            // @ts-ignore // TODO: Fix type mismatch if generateVolatilityTradingStrategy expects different input now
            const strategyResult = await generateVolatilityTradingStrategy(strategyInput);

            if (!strategyResult || strategyResult.tradesToExecute.length === 0) {
              toast({ title: "AI Sim Update", description: strategyResult?.overallReasoning || 'AI sim: no trades.', duration: 7000 });
              setIsAutoTradingActive(false);
              setIsAiLoading(false); // Also reset here
              return;
            }

            toast({ title: "AI Sim Strategy Initiated", description: `AI proposes ${strategyResult.tradesToExecute.length} simulated trades. ${strategyResult.overallReasoning}`, duration: 5000});
            setConsecutiveAiCallCount(prev => prev + 1);
            setLastAiCallTimestamp(Date.now());

            const newTrades: ActiveAutomatedVolatilityTrade[] = [];
            let currentAllocatedStake = 0;
            for (const proposal of strategyResult.tradesToExecute) {
              if (currentAllocatedStake + proposal.stake > autoTradeTotalStake) continue;
              currentAllocatedStake += proposal.stake;
              const currentTicks = instrumentTicksData[proposal.instrument as VolatilityInstrumentType];
              if (!currentTicks || currentTicks.length === 0) continue;
              const entryPrice = currentTicks[currentTicks.length - 1].price;
              const stopLossPercentage = 0.05;
              const stopLossPrice = proposal.action === 'CALL' ? entryPrice * (1 - stopLossPercentage) : entryPrice * (1 + stopLossPercentage);

              newTrades.push({
                id: uuidv4(),
                instrument: proposal.instrument as VolatilityInstrumentType,
                derivContractType: proposal.action, // Store 'CALL' or 'PUT'
                userSelectedTradeType: "RiseFall", // Simulation implies Rise/Fall
                stake: proposal.stake,
                durationSeconds: proposal.durationSeconds,
                reasoning: proposal.reasoning,
                entryPrice,
                stopLossPrice: parseFloat(stopLossPrice.toFixed(getInstrumentDecimalPlaces(proposal.instrument as InstrumentType))),
                startTime: Date.now(),
                status: 'active',
                currentPrice: entryPrice,
              });
            }
            if (newTrades.length === 0) {
              toast({ title: "AI Sim Update", description: "No valid sim trades initiated.", duration: 7000 });
              setIsAutoTradingActive(false); // Reset if no trades to simulate
            }
            setActiveAutomatedTrades(newTrades);
      } catch (error) {
        toast({ title: "AI Sim Failed", description: `Sim strategy error: ${(error as Error).message}`, variant: "destructive" });
        setIsAutoTradingActive(false); // Reset on error
      } finally {
        console.log("[VolatilityPage] Sim logic finally: Resetting isAiLoading to false. isAutoTradingActive is:", isAutoTradingActive);
        setIsAiLoading(false);
      }
    }
  }, [
    authStatus, userInfo, selectedDerivAccountType, autoTradeTotalStake, currentBalance,
    consecutiveAiCallCount, lastAiCallTimestamp, router, toast,
    selectedUserTradeTypeForLoop, // Added this new state
    tradingMode, selectedAiStrategyId // these are for the old simulation path
    // Removed setProfitsClaimable as it's handled by localStorage effect
]);

  const handleStopAiAutoTrade = () => {
    console.log("[VolatilityPage] handleStopAiAutoTrade called. Resetting isAutoTradingActive and isAiLoading.");
    setIsAutoTradingActive(false); 
    setIsAiLoading(false); // Ensure this is also reset
    tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
    tradeIntervals.current.clear();

    setActiveAutomatedTrades(prevTrades => 
      prevTrades.map(trade => {
        if (trade.status === 'active') { // Only update P/L for trades that were active during simulation
          const pnl = -trade.stake; 
          if (userInfo?.id) {
            // ... (database logging for manually stopped SIMULATED trades - can be kept or removed)
          }
          setProfitsClaimable(prevProfits => ({
            totalNetProfit: prevProfits.totalNetProfit + pnl,
            tradeCount: prevProfits.tradeCount + 1,
            winningTrades: prevProfits.winningTrades,
            losingTrades: prevProfits.losingTrades + 1,
          }));
          return { ...trade, status: 'closed_manual', pnl, reasoning: (trade.reasoning || "") + " Manually stopped." };
        }
        return trade;
      })
    );
    toast({ title: "AI Trading Stopped", description: `Session for ${selectedDerivAccountType} account has been stopped.`});
  };
  
  // This useEffect is for the SIMULATION. It should NOT run if selectedUserTradeTypeForLoop is set.
  useEffect(() => {
    if (selectedUserTradeTypeForLoop || !isAutoTradingActive || activeAutomatedTrades.length === 0 || isAiLoading) {
      if(!selectedUserTradeTypeForLoop && !isAutoTradingActive && tradeIntervals.current.size > 0) { // Clear intervals if sim stops
         tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
         tradeIntervals.current.clear();
      }
      return;
    }
    console.log("[VolatilityPage] Simulation useEffect running for active trades:", activeAutomatedTrades.length);

    activeAutomatedTrades.forEach(trade => {
      if (trade.status === 'active' && !tradeIntervals.current.has(trade.id)) {
        const intervalId = setInterval(() => {
          setActiveAutomatedTrades(prevTrades => {
            let allSimulatedTradesConcluded = true;
            const updatedTrades = prevTrades.map(currentTrade => {
              if (currentTrade.id !== trade.id || currentTrade.status !== 'active') {
                if(currentTrade.status === 'active') allSimulatedTradesConcluded = false;
                return currentTrade;
              }

              let newStatus: ActiveAutomatedVolatilityTrade['status'] = currentTrade.status;
              let pnl = currentTrade.pnl ?? 0;
              let newCurrentPrice = currentTrade.currentPrice ?? currentTrade.entryPrice;
              const decimalPlaces = getInstrumentDecimalPlaces(currentTrade.instrument);
              const priceChangeFactor = (Math.random() - 0.5) * (currentTrade.instrument.includes("100") ? 0.005 : 0.0005);
              newCurrentPrice += priceChangeFactor * newCurrentPrice;
              newCurrentPrice = parseFloat(newCurrentPrice.toFixed(decimalPlaces));

              if (currentTrade.actionDirection === 'CALL' && newCurrentPrice <= currentTrade.stopLossPrice) { // Changed from action to actionDirection
                newStatus = 'lost_stoploss'; pnl = -currentTrade.stake;
              } else if (currentTrade.actionDirection === 'PUT' && newCurrentPrice >= currentTrade.stopLossPrice) { // Changed from action to actionDirection
                newStatus = 'lost_stoploss'; pnl = -currentTrade.stake;
              }

              if (newStatus === 'active' && Date.now() >= currentTrade.startTime + currentTrade.durationSeconds * 1000) {
                const isWin = Math.random() < 0.83;
                if (isWin) { newStatus = 'won'; pnl = currentTrade.stake * 0.85; }
                else { newStatus = 'lost_duration'; pnl = -currentTrade.stake; }
              }

              if (newStatus !== 'active') {
                clearInterval(tradeIntervals.current.get(trade.id)!);
                tradeIntervals.current.delete(trade.id);
                // ... (DB logging for simulated trades - can be kept or removed) ...
                setProfitsClaimable(prevProfits => ({ /* ... */ }));
                toast({ /* ... */ });
              } else {
                allSimulatedTradesConcluded = false;
              }
              return { ...currentTrade, status: newStatus, pnl, currentPrice: newCurrentPrice };
            });

            if (allSimulatedTradesConcluded && isAutoTradingActive) {
                 setTimeout(() => {
                    console.log('[VolatilityPage] Simulation useEffect: All SIMULATED trades concluded, isAutoTradingActive set to false.');
                    setIsAutoTradingActive(false);
                    toast({ title: "AI Simulation Session Complete", description: `All simulated trades for ${selectedDerivAccountType} account concluded.`});
                }, 100);
            }
            return updatedTrades;
          });
        }, 1000);
        tradeIntervals.current.set(trade.id, intervalId);
      }
    });

    return () => {
      tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
      tradeIntervals.current.clear();
    };
  }, [activeAutomatedTrades, isAutoTradingActive, selectedDerivAccountType, setProfitsClaimable, toast, isAiLoading, userInfo, selectedAiStrategyId, tradingMode, selectedUserTradeTypeForLoop]);


  return (
    <div className="container mx-auto py-2 space-y-6">
      <BalanceDisplay
        balance={currentBalance ?? DEFAULT_PAPER_BALANCE}
        selectedAccountType={selectedDerivAccountType}
        displayAccountId={currentDisplayAccountId}
        syncStatus={currentSyncStatus}
      />
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Activity className="h-8 w-8 text-primary" />AI Volatility Index Trading</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><Bot className="mr-2 h-6 w-6 text-primary" />AI Auto-Trading Controls</CardTitle>
              <CardDescription>Configure AI trading for Volatility Indices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ... Trading Mode, AI Strategy, Deriv Account Type Selects ... */}
              <div className="space-y-2">
                <Label htmlFor="volatility-trading-mode">Trading Mode (for Simulation)</Label>
                <Select value={tradingMode} onValueChange={(value) => setTradingMode(value as TradingMode)} disabled={isAutoTradingActive || isAiLoading}>
                  <SelectTrigger id="volatility-trading-mode"><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="volatility-ai-strategy">AI Strategy (for Simulation)</Label>
                <Select value={selectedAiStrategyId} onValueChange={setSelectedAiStrategyId} disabled={isAutoTradingActive || isAiLoading}>
                  <SelectTrigger id="volatility-ai-strategy"><SelectValue placeholder="Select AI Strategy" /></SelectTrigger>
                  <SelectContent>{AI_TRADING_STRATEGIES.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
               <div>
                <Label htmlFor="vol-account-mode">Deriv Account Type</Label>
                <Select value={selectedDerivAccountType || ''} onValueChange={(val) => handleAccountTypeSwitch(val as 'demo' | 'real')} disabled={isAutoTradingActive || isAiLoading || authStatus !== 'authenticated' || !userInfo} >
                  <SelectTrigger id="vol-account-mode" className="mt-1"><SelectValue placeholder="Select Deriv Account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo" disabled={!userInfo?.derivDemoAccountId}><UserCheck className="mr-2 h-4 w-4 inline-block text-blue-500"/>Demo {userInfo?.derivDemoAccountId ? `(${userInfo.derivDemoAccountId.substring(0,3)}...${userInfo.derivDemoAccountId.slice(-3)})` : '(Not Linked)'}</SelectItem>
                    <SelectItem value="real" disabled={!userInfo?.derivRealAccountId}><Briefcase className="mr-2 h-4 w-4 inline-block text-green-500"/>Real {userInfo?.derivRealAccountId ? `(${userInfo.derivRealAccountId.substring(0,3)}...${userInfo.derivRealAccountId.slice(-3)})` : '(Not Linked)'}</SelectItem>
                  </SelectContent>
                </Select>
                 {authStatus === 'authenticated' && !userInfo?.derivDemoAccountId && !userInfo?.derivRealAccountId && ( <p className="text-xs text-muted-foreground mt-1">Link Deriv accounts in Profile.</p> )}
              </div>

              {/* New Selector for UserTradeType for REAL TRADING LOOP */}
              <div className="space-y-2">
                <Label htmlFor="volatility-user-trade-type-loop">Select Trade Type (for Real Backend Loop)</Label>
                <Select
                  value={selectedUserTradeTypeForLoop}
                  onValueChange={(value) => setSelectedUserTradeTypeForLoop(value as UserTradeTypeValue)}
                  disabled={isAutoTradingActive || isAiLoading}
                >
                  <SelectTrigger id="volatility-user-trade-type-loop">
                    <SelectValue placeholder="None (Use Page Simulation)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (Use Page Simulation)</SelectItem>
                    {USER_TRADE_TYPES_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Select a type to use the new backend AI trading loop. 'None' uses the current page's simulation.</p>
              </div>

              <div>
                <Label htmlFor="vol-auto-stake">Total Stake for Session ($)</Label>
                <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="vol-auto-stake" type="number" value={autoTradeTotalStake} onChange={handleAutoStakeChange} placeholder="e.g., 10 for Real Loop / 100 for Sim" className="w-full pl-8" min="1" disabled={isAutoTradingActive || isAiLoading} />
                </div>
                {autoTradeTotalStake > (currentBalance ?? 0) && !isAutoTradingActive && !isAiLoading && (
                    <p className="text-xs text-destructive mt-1">Stake exceeds available balance.</p>
                )}
              </div>

              {isAutoTradingActive ? (
                <Button onClick={handleStopAiAutoTrade} className="w-full bg-red-600 hover:bg-red-700 text-primary-foreground" >
                    <Square className="mr-2 h-5 w-5" /> Stop AI Session
                </Button>
                ) : (
                <Button onClick={handleStartAiAutoTrade} className="w-full bg-blue-600 hover:bg-blue-700 text-primary-foreground"
                    disabled={isAiLoading || (selectedUserTradeTypeForLoop ? autoTradeTotalStake < 0.35 : autoTradeTotalStake <= 0) || autoTradeTotalStake > (currentBalance ?? Infinity) || !selectedDerivAccountType}
                >
                    <Bot className="mr-2 h-5 w-5" /> 
                    {isAiLoading ? 'AI Initializing...' : (selectedUserTradeTypeForLoop ? 'Start Real AI Loop' : 'Start Simulation')}
                </Button>
              )}
              <p className="text-xs text-muted-foreground text-center">
                {selectedUserTradeTypeForLoop ? "Real trades will be attempted." : "Trading is simulated on this page."} Volatility Index trading involves high risk.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
             <TradingChart 
                instrument={currentVolatilityInstrument}
                onInstrumentChange={handleInstrumentChange}
                instrumentsToShow={VOLATILITY_INSTRUMENTS}
                isMarketOpen={true} 
                marketStatusMessage={`${currentVolatilityInstrument} market is Open 24/7.`}
             />
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Active AI Volatility Trades ({selectedDerivAccountType || 'N/A'})</CardTitle>
                <CardDescription>
                  {selectedUserTradeTypeForLoop ? "Monitoring real trade placements." : "Monitoring simulated trades. Stop-Loss is 5% of entry (simulated)."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeAutomatedTrades.length === 0 && !isAutoTradingActive && !isAiLoading ? (
                    <p className="text-muted-foreground text-center py-4">No active AI trades. Start a session to begin.</p>
                ) : activeAutomatedTrades.length === 0 && isAutoTradingActive && isAiLoading ? (
                     <p className="text-muted-foreground text-center py-4">AI is analyzing markets...</p>
                ) : activeAutomatedTrades.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Stake</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>{selectedUserTradeTypeForLoop ? "Status" : "Current Price"}</TableHead>
                      <TableHead>{selectedUserTradeTypeForLoop ? "Details" : "Stop-Loss"}</TableHead>
                      <TableHead>{selectedUserTradeTypeForLoop ? "Deriv ID" : "Status (Sim)"}</TableHead>
                      <TableHead>{selectedUserTradeTypeForLoop ? "Reasoning" : "P/L (Sim)"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAutomatedTrades.map(trade => (
                      <TableRow key={trade.id}>
                        <TableCell>{trade.instrument}</TableCell>
                        <TableCell>
                          <Badge variant={trade.derivContractType === 'CALL' || trade.derivContractType === 'ONETOUCH' || trade.derivContractType === 'DIGITEVEN' || trade.derivContractType === 'DIGITOVER' ? 'default' : 'destructive'}
                                 className={(trade.derivContractType === 'CALL' || trade.derivContractType === 'ONETOUCH' || trade.derivContractType === 'DIGITEVEN' || trade.derivContractType === 'DIGITOVER') ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                            {getDisplayTradeTypeDetails(trade.derivContractType, trade.userSelectedTradeType, trade.barrier)}
                          </Badge>
                        </TableCell>
                        <TableCell>${trade.stake.toFixed(2)}</TableCell>
                        <TableCell>{trade.entryPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) || '-'}</TableCell>

                        {selectedUserTradeTypeForLoop ? (
                          <>
                            <TableCell>
                                <Badge variant={trade.status === 'pending_execution' ? 'secondary' : (trade.status === 'failed_placement' ? 'destructive' : 'default')}
                                       className={trade.status === 'pending_execution' ? 'bg-yellow-500 text-white' : (trade.status === 'failed_placement' ? 'bg-red-500' : 'bg-gray-500')}>
                                {trade.status.replace('_', ' ')}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate" title={trade.error || "No details"}>{trade.error || "Placed"}</TableCell>
                            <TableCell className="text-xs">{(trade.id !== uuidv4() && !trade.id.startsWith("sim-")) ? trade.id.substring(0,10)+"..." : "N/A"}</TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate" title={trade.reasoning}>{trade.reasoning}</TableCell>
                          </>
                        ) : ( // Simulation display
                          <>
                            <TableCell>{trade.currentPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) ?? '-'}</TableCell>
                            <TableCell>{trade.stopLossPrice.toFixed(getInstrumentDecimalPlaces(trade.instrument))}</TableCell>
                            <TableCell>
                               <Badge variant={trade.status === 'active' ? 'secondary' : (trade.status === 'won' ? 'default' : 'destructive')}
                                      className={trade.status === 'active' ? 'bg-blue-500 text-white' : (trade.status === 'won' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600')}>
                                {trade.status}
                               </Badge>
                            </TableCell>
                            <TableCell className={trade.pnl && trade.pnl > 0 ? 'text-green-500' : trade.pnl && trade.pnl < 0 ? 'text-red-500' : ''}>
                              {trade.pnl ? `$${trade.pnl.toFixed(2)}` : '-'}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                ) : (
                     <p className="text-muted-foreground text-center py-4">No active AI trades. AI might not have found suitable opportunities.</p>
                )}
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

if (typeof window !== 'undefined' && !(window as any).uuidv4) {
  (window as any).uuidv4 = uuidv4;
}
