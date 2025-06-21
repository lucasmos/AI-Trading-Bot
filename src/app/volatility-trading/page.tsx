'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BalanceDisplay } from '@/components/dashboard/balance-display';
import { TradingChart } from '@/components/dashboard/trading-chart'; 
import type { VolatilityInstrumentType, TradingMode, ActiveAutomatedVolatilityTrade, ProfitsClaimable, PriceTick, InstrumentType } from '@/types/index'; // Removed PaperTradingMode
import { generateVolatilityTradingStrategy, type VolatilityTradingStrategyInput } from '@/ai/flows/volatility-trading-strategy-flow';
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
import { getInstrumentDecimalPlaces } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { Bot, DollarSign, Play, Square, Briefcase, UserCheck, Activity } from 'lucide-react'; 
import { VOLATILITY_INSTRUMENTS } from "../../config/instruments";
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateEMA, calculateATR, calculateFullRSI, calculateFullMACD, calculateFullBollingerBands, calculateFullEMA, calculateFullATR } from '@/lib/technical-analysis';
import { AI_TRADING_STRATEGIES, DEFAULT_AI_STRATEGY_ID } from '@/config/ai-strategies';
import { useRouter } from 'next/navigation';
import { DerivBalanceListener, type ListenerStatus } from '@/services/deriv-balance-listener'; // Added ListenerStatus

const DEFAULT_PAPER_BALANCE = 10000; // Fallback if context value is null for demo
const DEFAULT_LIVE_BALANCE = 0;    // Fallback if context value is null for real


export default function VolatilityTradingPage() {
  const router = useRouter();
  const { 
    authStatus, 
    userInfo,
    // paperBalance, // Removed
    // setPaperBalance, // Removed
    // liveBalance, // Removed
    // setLiveBalance, // Removed
    selectedDerivAccountType,
    derivDemoBalance,
    derivLiveBalance, // This is the 'real' balance from context
    derivDemoAccountId,
    derivRealAccountId,
    updateSelectedDerivAccountType,
  } = useAuth();
  
  const [currentVolatilityInstrument, setCurrentVolatilityInstrument] = useState<VolatilityInstrumentType>(VOLATILITY_INSTRUMENTS[0]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  // const [paperTradingMode, setPaperTradingMode] = useState<PaperTradingMode>('paper'); // Removed, will use selectedDerivAccountType
  const [selectedAiStrategyId, setSelectedAiStrategyId] = useState<string>(DEFAULT_AI_STRATEGY_ID);
  
  const [autoTradeTotalStake, setAutoTradeTotalStake] = useState<number>(100);
  const [isAutoTradingActive, setIsAutoTradingActive] = useState(false);
  const [activeAutomatedTrades, setActiveAutomatedTrades] = useState<ActiveAutomatedVolatilityTrade[]>([]);
  const [profitsClaimable, setProfitsClaimable] = useState<ProfitsClaimable>({
    totalNetProfit: 0,
    tradeCount: 0,
    winningTrades: 0,
    losingTrades: 0,
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const tradeIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const [consecutiveAiCallCount, setConsecutiveAiCallCount] = useState(0);
  const [lastAiCallTimestamp, setLastAiCallTimestamp] = useState<number | null>(null);
  const AI_COOLDOWN_DURATION_MS = 2 * 60 * 1000; // 2 minutes

  // const router = useRouter(); // already added above
  const { toast } = useToast();

  // States for DerivBalanceListener
  const [freshDemoBalance, setFreshDemoBalance] = useState<number | null>(null);
  const [freshRealBalance, setFreshRealBalance] = useState<number | null>(null);
  const [isLoadingDemoBalance, setIsLoadingDemoBalance] = useState<boolean>(false);
  const [isLoadingRealBalance, setIsLoadingRealBalance] = useState<boolean>(false);
  const [demoSyncStatus, setDemoSyncStatus] = useState<ListenerStatus>('idle');
  const [realSyncStatus, setRealSyncStatus] = useState<ListenerStatus>('idle');
  const demoBalanceListenerRef = useRef<DerivBalanceListener | null>(null);
  const realBalanceListenerRef = useRef<DerivBalanceListener | null>(null);


  // Adjusted currentBalance and displayAccountId logic
  const currentBalance = useMemo(() => {
    if (authStatus === 'pending' || !userInfo) return null;

    if (authStatus === 'authenticated') { // Removed userInfo.derivAccessToken check, as selection implies link
      if (selectedDerivAccountType === 'demo') {
        if (isLoadingDemoBalance && freshDemoBalance === null) return null;
        if (freshDemoBalance !== null) return freshDemoBalance;
        return derivDemoBalance ?? 0; // Default to 0 if derivDemoBalance is null
      } else if (selectedDerivAccountType === 'real') {
        if (isLoadingRealBalance && freshRealBalance === null) return null;
        if (freshRealBalance !== null) return freshRealBalance;
        return derivLiveBalance ?? 0; // Default to 0 if derivLiveBalance is null
      }
    }
    // Fallback for guest or non-Deriv user (though UI might prevent this state for this page)
    // Or if selectedDerivAccountType is somehow null despite being authenticated.
    // Provide a sensible default or null to show loading/unavailable in BalanceDisplay.
    return selectedDerivAccountType === 'demo' ? (derivDemoBalance ?? 0) : (derivLiveBalance ?? 0);
  }, [
    authStatus, userInfo, selectedDerivAccountType,
    derivDemoBalance, derivLiveBalance,
    freshDemoBalance, freshRealBalance,
    isLoadingDemoBalance, isLoadingRealBalance
  ]);

  const currentDisplayAccountId = useMemo(() => {
    if (!userInfo) return null;
    return selectedDerivAccountType === 'demo' ? derivDemoAccountId : derivRealAccountId;
  }, [userInfo, selectedDerivAccountType, derivDemoAccountId, derivRealAccountId]);

  const currentSyncStatus = useMemo(() => {
    return selectedDerivAccountType === 'demo' ? demoSyncStatus : realSyncStatus;
  }, [selectedDerivAccountType, demoSyncStatus, realSyncStatus]);


  useEffect(() => {
    // Ensure localStorage keys are based on selectedDerivAccountType for consistency
    const accountTypeKey = selectedDerivAccountType === 'real' ? 'live' : 'paper'; // 'paper' for demo
    const profitsKey = `volatilityProfitsClaimable_${accountTypeKey}`;
    const storedProfits = localStorage.getItem(profitsKey);
    if (storedProfits) {
      try {
        setProfitsClaimable(JSON.parse(storedProfits));
      } catch (error) {
        console.error("Error parsing volatility profits from localStorage:", error);
        setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });
      }
    } else {
      setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });
    }
  }, [selectedDerivAccountType]); // Depends on selectedDerivAccountType now

  useEffect(() => {
    const accountTypeKey = selectedDerivAccountType === 'real' ? 'live' : 'paper';
    const profitsKey = `volatilityProfitsClaimable_${accountTypeKey}`;
    localStorage.setItem(profitsKey, JSON.stringify(profitsClaimable));
  }, [profitsClaimable, selectedDerivAccountType]); // Depends on selectedDerivAccountType now

  const handleInstrumentChange = (instrument: string) => {
    if (VOLATILITY_INSTRUMENTS.includes(instrument as VolatilityInstrumentType)) {
      setCurrentVolatilityInstrument(instrument as VolatilityInstrumentType);
    }
  };

  // Listener setup effects (similar to DashboardPage)
  useEffect(() => {
    return () => { // Top-level cleanup
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
    if (!isNaN(value) && value >= 0) {
      setAutoTradeTotalStake(value);
    } else if (event.target.value === "") {
      setAutoTradeTotalStake(0);
    }
  };

  const handleAccountTypeSwitch = async (newTypeFromControl: 'demo' | 'real' | null) => {
    // Ensure newTypeFromControl is correctly 'demo' or 'real'
    const newApiType = newTypeFromControl; // Assuming the control passes 'demo' or 'real' directly
    if (!newApiType || (newApiType !== 'demo' && newApiType !== 'real')) {
        toast({ title: "Invalid Selection", description: "Please select a valid account type.", variant: "destructive"});
        return;
    }

    if (!userInfo?.derivAccessToken && !(userInfo?.derivDemoApiToken && userInfo?.derivRealApiToken)) { // Check if any Deriv connection exists
        toast({ title: "Deriv Account Not Linked", description: "Please connect your Deriv account via Profile page to switch modes.", variant: "destructive" });
        return;
    }
    if (newApiType === selectedDerivAccountType) return; // Already selected
    try {
        await updateSelectedDerivAccountType(newApiType); // This is 'demo' or 'real'
        toast({ title: "Account Switched", description: `Switched to ${newApiType} account. Balances reflected.`, variant: "default" });
    } catch (error) {
        toast({ title: "Switch Failed", description: `Failed to switch to ${newApiType} account. Error: ${(error as Error).message}`, variant: "destructive" });
    }
  };


  const handleStartAiAutoTrade = useCallback(async () => {
    if (authStatus === 'unauthenticated') {
      toast({
        title: "Authentication Required",
        description: "Please log in to start AI auto-trading on volatility indices.",
        variant: "destructive"
      });
      router.push('/auth/login');
      return;
    }

    if (!selectedDerivAccountType) {
        toast({ title: "Account Not Selected", description: "Please select a Deriv account type (Demo/Real) first.", variant: "destructive" });
        return;
    }

    if (autoTradeTotalStake <= 0) {
      toast({ title: "Invalid Stake", description: "Please enter a valid total stake for AI trading.", variant: "destructive" });
      return;
    }

    // Ensure currentBalance is not null for the check
    const balanceToCheck = currentBalance ?? 0; // currentBalance already uses useMemo and defaults
    if (autoTradeTotalStake > balanceToCheck) {
        toast({ title: `Insufficient ${selectedDerivAccountType === 'demo' ? 'Demo' : 'Real'} Balance`, description: `Total stake $${autoTradeTotalStake.toFixed(2)} exceeds available balance of $${balanceToCheck.toFixed(2)}.`, variant: "destructive" });
        return;
    }

    if (consecutiveAiCallCount >= 2) {
      if (lastAiCallTimestamp && (Date.now() - lastAiCallTimestamp) < AI_COOLDOWN_DURATION_MS) {
        const remainingTimeSeconds = Math.ceil((AI_COOLDOWN_DURATION_MS - (Date.now() - lastAiCallTimestamp)) / 1000);
        const remainingMinutes = Math.ceil(remainingTimeSeconds / 60);
        toast({ title: "AI Cooldown", description: `AI is cooling down. Please wait ${remainingMinutes} minutes before starting a new auto-trade session.`, variant: "default" });
        return;
      } else {
        setConsecutiveAiCallCount(0); // Cooldown expired, reset count
      }
    }

    setIsAiLoading(true); 
    setIsAutoTradingActive(true);
    setActiveAutomatedTrades([]); 
    // setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 }); // This is handled by useEffect on account change now


    try {
      const instrumentTicksData: Record<VolatilityInstrumentType, PriceTick[]> = {} as Record<VolatilityInstrumentType, PriceTick[]>;
      const instrumentIndicatorsData: Record<VolatilityInstrumentType, any> = {} as Record<VolatilityInstrumentType, any>; // Adjust 'any' to a more specific type if available
      
      for (const inst of VOLATILITY_INSTRUMENTS as VolatilityInstrumentType[]) {
        try {
          const candles = await getCandles(inst, 60); // Fetch 60 candles for indicator calculation
          if (candles && candles.length > 0) {
            instrumentTicksData[inst] = candles.map(candle => ({
              epoch: candle.epoch,
              price: candle.close,
              time: candle.time,
            }));

            const closePrices = candles.map(c => c.close);
            const highPrices = candles.map(c => c.high);
            const lowPrices = candles.map(c => c.low);

            // Calculate latest values for each indicator
            const rsi = calculateRSI(closePrices);
            const macd = calculateMACD(closePrices);
            const bb = calculateBollingerBands(closePrices);
            const ema = calculateEMA(closePrices);
            const atr = calculateATR(highPrices, lowPrices, closePrices);

            instrumentIndicatorsData[inst] = {
              ...(rsi !== undefined && { rsi }),
              ...(macd && { macd }), // macd itself is an object { macd, signal, histogram } or undefined
              ...(bb && { bollingerBands: bb }), // bb itself is an object { upper, middle, lower } or undefined
              ...(ema !== undefined && { ema }),
              ...(atr !== undefined && { atr }),
            };

          } else {
            instrumentTicksData[inst] = [];
            instrumentIndicatorsData[inst] = {}; // No data for indicators
            toast({title: `Data Error ${inst}`, description: `Could not fetch sufficient candle data for ${inst}. AI may exclude it or work with limited info.`, variant: 'destructive', duration: 4000});
          }
        } catch (err) {
          instrumentTicksData[inst] = []; 
          instrumentIndicatorsData[inst] = {}; // Error fetching data
          toast({title: `Data Error ${inst}`, description: `Could not fetch price data for ${inst}. AI may exclude it.`, variant: 'destructive', duration: 4000});
        }
      }
      
      const strategyInput: VolatilityTradingStrategyInput = {
        totalStake: autoTradeTotalStake,
        instruments: VOLATILITY_INSTRUMENTS as VolatilityInstrumentType[],
        tradingMode: tradingMode,
        aiStrategyId: selectedAiStrategyId,
        instrumentTicks: instrumentTicksData,
        instrumentIndicators: instrumentIndicatorsData,
      };
      const strategyResult = await generateVolatilityTradingStrategy(strategyInput);

      if (!strategyResult || strategyResult.tradesToExecute.length === 0) {
        const reason = strategyResult?.overallReasoning || "AI determined no optimal trades at this moment for volatility indices.";
        toast({ title: "AI Auto-Trade Update (Volatility)", description: `AI analysis complete. ${reason}`, duration: 7000 });
        setIsAutoTradingActive(false); 
        return;
      }
      
      toast({ title: "AI Auto-Trade Strategy Initiated (Volatility)", description: `AI proposes ${strategyResult.tradesToExecute.length} trade(s) for ${selectedDerivAccountType} account on volatility indices. ${strategyResult.overallReasoning}`, duration: 7000});
      setConsecutiveAiCallCount(prev => prev + 1); // Increment AI call count
      setLastAiCallTimestamp(Date.now()); // Update last AI call timestamp

      const newTrades: ActiveAutomatedVolatilityTrade[] = [];
      let currentAllocatedStake = 0;

      for (const proposal of strategyResult.tradesToExecute) {
        if (currentAllocatedStake + proposal.stake > autoTradeTotalStake) continue; 
        currentAllocatedStake += proposal.stake;

        const currentTicks = instrumentTicksData[proposal.instrument as VolatilityInstrumentType];
        if (!currentTicks || currentTicks.length === 0) {
          toast({ title: "Auto-Trade Skipped (Volatility)", description: `No price data for ${proposal.instrument} to initiate AI trade.`, variant: "destructive"});
          continue;
        }
        const entryPrice = currentTicks[currentTicks.length - 1].price;
        
        let stopLossPrice;
        const stopLossPercentage = 0.05; 
        if (proposal.action === 'CALL') stopLossPrice = entryPrice * (1 - stopLossPercentage);
        else stopLossPrice = entryPrice * (1 + stopLossPercentage);
        
        stopLossPrice = parseFloat(stopLossPrice.toFixed(getInstrumentDecimalPlaces(proposal.instrument as InstrumentType)));

        const tradeId = uuidv4();
        newTrades.push({
          id: tradeId,
          instrument: proposal.instrument as VolatilityInstrumentType,
          action: proposal.action,
          stake: proposal.stake,
          durationSeconds: proposal.durationSeconds,
          reasoning: proposal.reasoning,
          entryPrice,
          stopLossPrice, 
          startTime: Date.now(),
          status: 'active',
          currentPrice: entryPrice,
        });
      }

      if (newTrades.length === 0) {
        toast({ title: "AI Auto-Trade Update (Volatility)", description: "No valid volatility trades could be initiated based on AI proposals and current data.", duration: 7000 });
        setIsAutoTradingActive(false);
      }
      setActiveAutomatedTrades(newTrades);


    } catch (error) {
      toast({ title: "AI Auto-Trade Failed (Volatility)", description: `Could not execute volatility trading strategy: ${(error as Error).message}`, variant: "destructive" });
      setIsAutoTradingActive(false);
    } finally {
      setIsAiLoading(false); 
    }
  }, [autoTradeTotalStake, tradingMode, toast, paperTradingMode, currentBalance, authStatus, setCurrentBalance, setProfitsClaimable, userInfo, selectedAiStrategyId]);

  const handleStopAiAutoTrade = () => {
    setIsAutoTradingActive(false); 
    tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
    tradeIntervals.current.clear();

    // No direct balance update here; rely on listeners or next fetch for AuthContext update.
    // const setCurrentBalance = selectedDerivAccountType === 'demo' ? setFreshDemoBalance : setFreshRealBalance; // This is not how it works.

    setActiveAutomatedTrades(prevTrades => 
      prevTrades.map(trade => {
        if (trade.status === 'active') {
          const pnl = -trade.stake; 

          if (userInfo?.id) {
            console.log('[VolatilityDashboard] Storing manually stopped automated trade in database for user:', userInfo.id);
            fetch('/api/trades', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: userInfo.id,
                email: userInfo.email, 
                name: userInfo.name, 
                symbol: trade.instrument,
                type: trade.action === 'CALL' ? 'buy' : 'sell',
                amount: trade.stake,
                price: trade.entryPrice,
                aiStrategyId: selectedAiStrategyId,
                metadata: {
                  mode: tradingMode,
                  duration: `${trade.durationSeconds}s`,
                  accountType: selectedDerivAccountType, // Use selectedDerivAccountType
                  automated: true,
                  manualStop: true,
                  tradeCategory: 'volatility',
                  reasoning: (trade.reasoning || "") + " Manually stopped."
                }
              }),
            })
            .then(response => response.json())
            .then(createdTrade => {
              if (createdTrade && createdTrade.id) {
                console.log('[VolatilityDashboard] Manual stop trade created, now closing:', createdTrade.id);
                return fetch(`/api/trades/${createdTrade.id}/close`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    exitPrice: trade.currentPrice, 
                    metadata: {
                      outcome: 'closed_manual',
                      pnl: pnl,
                      reason: "Manually stopped automated trade"
                    }
                  }),
                });
              }
              throw new Error('Failed to create trade in DB for manual stop');
            })
            .then(response => response?.json())
            .then(closedTrade => {
              if (closedTrade) {
                console.log('[VolatilityDashboard] Manual stop trade closed successfully:', closedTrade.id);
              } else {
                 console.warn('[VolatilityDashboard] Failed to close manually stopped trade in DB or no trade to close.');
              }
            })
            .catch(error => {
              console.error("[VolatilityDashboard] Error processing manually stopped trade in database:", error);
            });
          }
          
          // Update profits claimable, balance will be updated by listener or next context sync
          setProfitsClaimable(prevProfits => ({
            totalNetProfit: prevProfits.totalNetProfit + pnl,
            tradeCount: prevProfits.tradeCount + 1,
            winningTrades: prevProfits.winningTrades,
            losingTrades: prevProfits.losingTrades + 1,
          }));
          return { ...trade, status: 'lost_duration', pnl, reasoning: (trade.reasoning || "") + " Manually stopped." };
        }
        return trade;
      })
    );
    toast({ title: "AI Volatility Trading Stopped", description: `Automated trading session for ${selectedDerivAccountType} account has been stopped.`});
  };
  
  useEffect(() => {
    if (isAutoTradingActive && activeAutomatedTrades.length === 0 && !isAiLoading) {
      setIsAutoTradingActive(false);
    }

    if (!isAutoTradingActive || activeAutomatedTrades.length === 0) { 
      tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
      tradeIntervals.current.clear();
      return; 
    }
    
    activeAutomatedTrades.forEach(trade => {
      if (trade.status === 'active' && !tradeIntervals.current.has(trade.id)) {
        const intervalId = setInterval(() => {
          setActiveAutomatedTrades(prevTrades => {
            let allTradesConcluded = true;
            const updatedTrades = prevTrades.map(currentTrade => {
              if (currentTrade.id !== trade.id || currentTrade.status !== 'active') {
                if(currentTrade.status === 'active') allTradesConcluded = false;
                return currentTrade;
              }

              let newStatus: ActiveAutomatedVolatilityTrade['status'] = currentTrade.status;
              let pnl = currentTrade.pnl ?? 0;
              let newCurrentPrice = currentTrade.currentPrice ?? currentTrade.entryPrice;
              const decimalPlaces = getInstrumentDecimalPlaces(currentTrade.instrument);

              const priceChangeFactor = (Math.random() - 0.5) * (currentTrade.instrument.includes("100") ? 0.005 : 0.0005); 
              newCurrentPrice += priceChangeFactor * newCurrentPrice; 
              newCurrentPrice = parseFloat(newCurrentPrice.toFixed(decimalPlaces));

              if (currentTrade.action === 'CALL' && newCurrentPrice <= currentTrade.stopLossPrice) {
                newStatus = 'lost_stoploss'; pnl = -currentTrade.stake;
              } else if (currentTrade.action === 'PUT' && newCurrentPrice >= currentTrade.stopLossPrice) {
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
                
                if (userInfo?.id) {
                  console.log('[VolatilityDashboard] Storing automated trade in database for user:', userInfo.id);
                  fetch('/api/trades', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      userId: userInfo.id,
                      email: userInfo.email,
                      name: userInfo.name,
                      symbol: currentTrade.instrument,
                      type: currentTrade.action === 'CALL' ? 'buy' : 'sell',
                      amount: currentTrade.stake,
                      price: currentTrade.entryPrice,
                      aiStrategyId: selectedAiStrategyId,
                      metadata: {
                        mode: tradingMode,
                        duration: `${currentTrade.durationSeconds}s`,
                      accountType: selectedDerivAccountType, // Use selectedDerivAccountType
                        automated: true,
                        tradeCategory: 'volatility',
                        reasoning: currentTrade.reasoning
                      }
                    }),
                  })
                  .then(response => response.json())
                  .then(createdTrade => {
                    if (createdTrade && createdTrade.id) {
                      console.log('[VolatilityDashboard] Automated trade created, now closing:', createdTrade.id);
                      return fetch(`/api/trades/${createdTrade.id}/close`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          exitPrice: newCurrentPrice,
                          metadata: {
                            outcome: newStatus,
                            pnl: pnl,
                            reason: "Automated trade completed"
                          }
                        }),
                      });
                    }
                    throw new Error('Failed to create automated trade in DB');
                  })
                  .then(response => response?.json())
                  .then(closedTrade => {
                     if (closedTrade) {
                        console.log('[VolatilityDashboard] Automated trade closed successfully:', closedTrade.id);
                     } else {
                        console.warn('[VolatilityDashboard] Failed to close automated trade in DB or no trade to close.');
                     }
                  })
                  .catch(error => {
                    console.error("[VolatilityDashboard] Error processing automated trade in database:", error);
                  });
                }
                
                // Update profits claimable, balance will be updated by listener or next context sync
                setProfitsClaimable(prevProfits => ({
                  totalNetProfit: prevProfits.totalNetProfit + pnl,
                  tradeCount: prevProfits.tradeCount + 1,
                  winningTrades: newStatus === 'won' ? prevProfits.winningTrades + 1 : prevProfits.winningTrades,
                  losingTrades: (newStatus === 'lost_duration' || newStatus === 'lost_stoploss') ? prevProfits.losingTrades + 1 : prevProfits.losingTrades,
                }));

                toast({
                  title: `Auto-Trade Ended (Volatility - ${selectedDerivAccountType}): ${currentTrade.instrument}`,
                  description: `Status: ${newStatus}, P/L: $${pnl.toFixed(2)}`,
                  variant: pnl > 0 ? "default" : "destructive"
                });
              } else {
                allTradesConcluded = false; 
              }
              return { ...currentTrade, status: newStatus, pnl, currentPrice: newCurrentPrice };
            });

            if (allTradesConcluded && isAutoTradingActive) { 
                 setTimeout(() => { 
                    setIsAutoTradingActive(false);
                    toast({ title: "AI Volatility Trading Session Complete", description: `All volatility trades for ${selectedDerivAccountType} account concluded.`});
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
  }, [activeAutomatedTrades, isAutoTradingActive, selectedDerivAccountType, setProfitsClaimable, toast, isAiLoading, userInfo, selectedAiStrategyId, tradingMode]); // Added selectedDerivAccountType, tradingMode and removed setCurrentBalance


  return (
    <div className="container mx-auto py-2 space-y-6">
      <BalanceDisplay
        balance={currentBalance ?? DEFAULT_PAPER_BALANCE} // Provide a fallback if currentBalance is null
        selectedAccountType={selectedDerivAccountType}
        displayAccountId={currentDisplayAccountId}
        syncStatus={currentSyncStatus} // Pass the determined sync status
      />
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Activity className="h-8 w-8 text-primary" />AI Volatility Index Trading</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><Bot className="mr-2 h-6 w-6 text-primary" />AI Auto-Trading Controls</CardTitle>
              <CardDescription>Configure and manage automated AI trading sessions for Volatility Indices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="volatility-trading-mode">Trading Mode</Label>
                <Select value={tradingMode} onValueChange={(value) => setTradingMode(value as TradingMode)}>
                  <SelectTrigger id="volatility-trading-mode">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                  </Select>
                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                  <p><strong>Conservative:</strong> Focuses on capital preservation with lower risk.</p>
                  <p><strong>Balanced:</strong> Aims for a moderate balance between risk and reward.</p>
                  <p><strong>Aggressive:</strong> Seeks higher potential returns, accepting higher risk.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="volatility-ai-strategy">AI Strategy</Label>
                <Select value={selectedAiStrategyId} onValueChange={setSelectedAiStrategyId} disabled={isAutoTradingActive || isAiLoading}>
                  <SelectTrigger id="volatility-ai-strategy">
                    <SelectValue placeholder="Select AI Strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_TRADING_STRATEGIES.map((strategy) => (
                      <SelectItem key={strategy.id} value={strategy.id}>
                        {strategy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                  </Select>
                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                  <p><strong>Dynamic Adaptive:</strong> Flexible strategy, adapts to market changes.</p>
                  <p><strong>Trend Rider:</strong> Follows strong market trends.</p>
                  <p><strong>Range Negotiator:</strong> For sideways-moving markets.</p>
                  <p><em>Risk for all strategies is set by your chosen Trading Mode.</em></p>
                </div>
              </div>
              <div>
                <Label htmlFor="vol-account-mode">Deriv Account Type</Label>
                <Select
                  value={selectedDerivAccountType || ''} // Handle null case for initial render if needed
                  onValueChange={(val) => handleAccountTypeSwitch(val as 'demo' | 'real')}
                  disabled={isAutoTradingActive || isAiLoading || authStatus !== 'authenticated' || !userInfo}
                >
                  <SelectTrigger id="vol-account-mode" className="mt-1">
                    <SelectValue placeholder="Select Deriv Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo" disabled={!userInfo?.derivDemoAccountId}>
                      <UserCheck className="mr-2 h-4 w-4 inline-block text-blue-500"/>Demo Account {userInfo?.derivDemoAccountId ? `(${userInfo.derivDemoAccountId.substring(0,3)}...${userInfo.derivDemoAccountId.slice(-3)})` : '(Not Linked)'}
                    </SelectItem>
                    <SelectItem value="real" disabled={!userInfo?.derivRealAccountId}>
                      <Briefcase className="mr-2 h-4 w-4 inline-block text-green-500"/>Real Account {userInfo?.derivRealAccountId ? `(${userInfo.derivRealAccountId.substring(0,3)}...${userInfo.derivRealAccountId.slice(-3)})` : '(Not Linked)'}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {authStatus === 'authenticated' && !userInfo?.derivDemoAccountId && !userInfo?.derivRealAccountId && (
                     <p className="text-xs text-muted-foreground mt-1">Link your Deriv accounts in Profile to enable selection.</p>
                )}
              </div>
              <div>
                <Label htmlFor="vol-auto-stake">Total Stake for Session ($)</Label>
                <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    id="vol-auto-stake"
                    type="number"
                    value={autoTradeTotalStake}
                    onChange={handleAutoStakeChange}
                    placeholder="e.g., 100"
                    className="w-full pl-8"
                    min="10"
                    disabled={isAutoTradingActive || isAiLoading}
                    />
                </div>
                {autoTradeTotalStake > currentBalance && !isAutoTradingActive && !isAiLoading && (
                    <p className="text-xs text-destructive mt-1">Stake exceeds available balance.</p>
                )}
              </div>
              {isAutoTradingActive ? (
                <Button
                    onClick={handleStopAiAutoTrade}
                    className="w-full bg-red-600 hover:bg-red-700 text-primary-foreground"
                    disabled={isAiLoading && !isAutoTradingActive} 
                >
                    <Square className="mr-2 h-5 w-5" />
                    Stop AI Volatility Trading
                </Button>
                ) : (
                <Button
                    onClick={handleStartAiAutoTrade}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-primary-foreground"
                    disabled={isAiLoading || autoTradeTotalStake <=0 || autoTradeTotalStake > currentBalance}
                >
                    <Bot className="mr-2 h-5 w-5" /> 
                    {isAiLoading ? 'Initializing AI Trades...' : 'Start AI Volatility Trading'}
                </Button>
              )}
              <p className="text-xs text-muted-foreground text-center">
                Volatility Index trading involves high risk. AI strategies are experimental. All trading is simulated.
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
                <CardTitle>Active AI Volatility Trades ({selectedDerivAccountType === 'real' ? 'Real' : (selectedDerivAccountType === 'demo' ? 'Demo' : 'N/A')})</CardTitle>
                <CardDescription>Monitoring automated volatility trades. Stop-Loss is 5% of entry.</CardDescription>
              </CardHeader>
              <CardContent>
                {activeAutomatedTrades.length === 0 && !isAutoTradingActive && !isAiLoading ? (
                    <p className="text-muted-foreground text-center py-4">No active AI volatility trades. Start a session to begin.</p>
                ) : activeAutomatedTrades.length === 0 && isAutoTradingActive && isAiLoading ? (
                     <p className="text-muted-foreground text-center py-4">AI is analyzing markets for volatility trades...</p>
                ) : activeAutomatedTrades.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Stake</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Stop-Loss</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>P/L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAutomatedTrades.map(trade => (
                      <TableRow key={trade.id}>
                        <TableCell>{trade.instrument}</TableCell>
                        <TableCell>
                          <Badge variant={trade.action === 'CALL' ? 'default' : 'destructive'} 
                                 className={trade.action === 'CALL' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                            {trade.action}
                          </Badge>
                        </TableCell>
                        <TableCell>${trade.stake.toFixed(2)}</TableCell>
                        <TableCell>{trade.entryPrice.toFixed(getInstrumentDecimalPlaces(trade.instrument))}</TableCell>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                ) : (
                     <p className="text-muted-foreground text-center py-4">No active AI volatility trades. AI might not have found suitable opportunities.</p>
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
