'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';

import { BalanceDisplay } from '@/components/dashboard/balance-display';
import { TradingChart } from '@/components/dashboard/trading-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { getCandles, getContractStatus } from '@/services/deriv';
import { getInstrumentDecimalPlaces, getDisplayTradeTypeDetails, getTradeTypeDisplayName } from '@/lib/utils';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateEMA,
  calculateATR,
  calculateStochastic,
  calculateWilliamsR,
  calculateCCI
} from '@/lib/technical-analysis';

import {
  executeVolatilityAiTradeLoop,
  type VolatilityTradeExecutionResult,
  type VolatilityTradeOptions
} from '@/app/actions/trade-execution-actions';
import { getUpdatedUserBalances } from '@/app/actions/balance-actions';

import type {
  VolatilityInstrumentType,
  TradingMode,
  ActiveAutomatedVolatilityTrade,
  ProfitsClaimable,
  InstrumentType
} from '@/types/index';
import { UserTradeType as UserTradeTypeValue } from '@/types/ai-shared-types';

import { Bot, Square, Briefcase, UserCheck, Activity, DollarSign } from 'lucide-react';
import { VOLATILITY_INSTRUMENTS } from '@/config/instruments';
import { AI_TRADING_STRATEGIES, DEFAULT_AI_STRATEGY_ID } from '@/config/ai-strategies';
import { generateVolatilityTradingStrategy, type VolatilityTradingStrategyInput } from '@/ai/flows/volatility-trading-strategy-flow';
import type { PriceTick } from '@/types';

// Helper function to get clean display names for chart tabs
function getChartTabLabel(instrument: string): string {
  switch (instrument) {
    case 'Volatility 10 Index': return 'V10';
    case 'Volatility 25 Index': return 'V25';
    case 'Volatility 50 Index': return 'V50';
    case 'Volatility 75 Index': return 'V75';
    case 'Volatility 100 Index': return 'V100';
    case 'Volatility 10 (1s) Index': return 'V10 (1s)';
    case 'Volatility 25 (1s) Index': return 'V25 (1s)';
    case 'Volatility 50 (1s) Index': return 'V50 (1s)';
    case 'Volatility 75 (1s) Index': return 'V75 (1s)';
    case 'Volatility 100 (1s) Index': return 'V100 (1s)';
    default: return instrument;
  }
}
import { DerivBalanceListener, type ListenerStatus } from '@/services/deriv-balance-listener';

const DEFAULT_PAPER_BALANCE = 10000;
const DEFAULT_LIVE_BALANCE = 0;

// Map Deriv API contract statuses to local trade statuses
const mapDerivStatusToLocal = (derivStatus?: string): ActiveAutomatedVolatilityTrade['status'] => {
  if (!derivStatus) return 'pending_execution';
  switch (derivStatus) {
    case 'open': return 'pending_execution';
    case 'sold': return 'closed_manual';
    case 'won': return 'won';
    case 'lost': return 'lost_duration';
    case 'cancelled': return 'failed_placement';
    default:
      console.warn(`[VolatilityPage] Unknown Deriv contract status: ${derivStatus}`);
      return 'pending_execution';
  }
};

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

  // New state variables for the updated controls
  const [executionMode, setExecutionMode] = useState<'turbo' | 'safe'>('safe');
  const [numberOfBulkTrades, setNumberOfBulkTrades] = useState<number>(1);

  // State for Over/Under digit selection
  const [selectedOverDigit, setSelectedOverDigit] = useState<number | null>(null);
  const [selectedUnderDigit, setSelectedUnderDigit] = useState<number | null>(null);



  // State for real-time price streaming for trade type cards
  const [currentStreamingPrice, setCurrentStreamingPrice] = useState<number>(0);
  const [priceSequence, setPriceSequence] = useState<Array<{price: number, digit: number, timestamp: number}>>([]);

  // Legacy state variables (keeping for backward compatibility)
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [selectedAiStrategyId, setSelectedAiStrategyId] = useState<string>(DEFAULT_AI_STRATEGY_ID);

  const [selectedUserTradeTypeForLoop, setSelectedUserTradeTypeForLoop] = useState<UserTradeTypeValue>('DigitsEvenOdd');

  const [autoTradeTotalStake, setAutoTradeTotalStake] = useState<number>(10);
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
  const realTradeMonitoringInterval = useRef<NodeJS.Timeout | null>(null);

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
    { value: 'DigitsOverUnder', label: 'Over/Under' },
    { value: 'DigitsEvenOdd', label: 'Even/Odd' },
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
      catch (error) { console.error("Error parsing volatility profits from localStorage:", error); setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 }); }
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

  useEffect(() => {
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

  const refreshBalance = useCallback(async () => {
    if (!userInfo) return;

    try {
      console.log('[VolatilityPage] Refreshing balance after trade completion');
      const freshBalances = await getUpdatedUserBalances({
        userId: userInfo.id,
        demoAccountId: userInfo.derivDemoAccountId,
        demoApiToken: userInfo.derivDemoApiToken,
        realAccountId: userInfo.derivRealAccountId,
        realApiToken: userInfo.derivRealApiToken,
      });

      if (selectedDerivAccountType === 'demo' && freshBalances.derivDemoBalance !== undefined) {
        setFreshDemoBalance(freshBalances.derivDemoBalance);
        console.log(`[VolatilityPage] Updated demo balance: ${freshBalances.derivDemoBalance}`);
      } else if (selectedDerivAccountType === 'real' && freshBalances.derivRealBalance !== undefined) {
        setFreshRealBalance(freshBalances.derivRealBalance);
        console.log(`[VolatilityPage] Updated real balance: ${freshBalances.derivRealBalance}`);
      }
    } catch (error) {
      console.error('[VolatilityPage] Error refreshing balance:', error);
    }
  }, [userInfo, selectedDerivAccountType]);

  const handleAccountTypeSwitch = async (newTypeFromControl: 'demo' | 'real' | null) => {
    const newApiType = newTypeFromControl;
    if (!newApiType || (newApiType !== 'demo' && newApiType !== 'real')) {
        toast({ title: "Invalid Selection", description: "Please select a valid account type.", variant: "destructive"});
        return;
    }
    if (!userInfo?.derivDemoAccountId && !userInfo?.derivRealAccountId ) {
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
     if (autoTradeTotalStake <= 0 && selectedUserTradeTypeForLoop) {
      toast({ title: "Invalid Stake", description: "Please enter a valid total stake for the AI session.", variant: "destructive" });
      return;
    }
    if (autoTradeTotalStake <= 0 && !selectedUserTradeTypeForLoop) {
      toast({ title: "Invalid Stake", description: "Please enter a valid total stake for AI simulation.", variant: "destructive" });
      return;
    }

    const balanceToCheck = currentBalance ?? 0;
    if (autoTradeTotalStake > balanceToCheck) {
      toast({ title: `Insufficient ${selectedDerivAccountType} Balance`, description: `Total stake $${autoTradeTotalStake.toFixed(2)} exceeds available balance of $${balanceToCheck.toFixed(2)}.`, variant: "destructive" });
      return;
    }
    if (selectedUserTradeTypeForLoop && autoTradeTotalStake < 0.35 * VOLATILITY_INSTRUMENTS.length && VOLATILITY_INSTRUMENTS.length > 0) {
        toast({ title: "Low Stake", description: `Total stake $${autoTradeTotalStake.toFixed(2)} might be too low to apportion effectively across multiple instruments (min $0.35 per trade often applies).`, variant: "warning" });
    }

    if (consecutiveAiCallCount >= 2 && lastAiCallTimestamp && (Date.now() - lastAiCallTimestamp) < AI_COOLDOWN_DURATION_MS) {
      const remainingMinutes = Math.ceil((AI_COOLDOWN_DURATION_MS - (Date.now() - lastAiCallTimestamp)) / 1000 / 60);
      toast({ title: "AI Cooldown", description: `Please wait ${remainingMinutes} min.`, variant: "default" });
      return;
    } else if (consecutiveAiCallCount >=2 ) {
        setConsecutiveAiCallCount(0);
    }

    setIsAiLoading(true);
    setIsAutoTradingActive(true);
    setActiveAutomatedTrades([]);

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
                autoTradeTotalStake,
                {
                  executionMode,
                  numberOfBulkTrades,
                  selectedInstrument: currentVolatilityInstrument
                }
            );

            setConsecutiveAiCallCount(prev => prev + 1);
            setLastAiCallTimestamp(Date.now());
            console.log(`[VolatilityPage] Real trade loop results:`, loopResults);

            const newUiTrades: ActiveAutomatedVolatilityTrade[] = loopResults.map(result => ({
                // Use the actual Deriv contract ID for real trades, fallback to UUID for failed trades
                id: result.success && result.tradeResponse?.contract_id
                    ? result.tradeResponse.contract_id.toString()
                    : (result.dbTradeId || uuidv4()),
                instrument: result.instrument,

                // New Deriv-style fields
                tradeType: getTradeTypeDisplayName(selectedUserTradeTypeForLoop, result.tradeParams?.contract_type),
                entryPrice: result.tradeResponse?.entry_spot || 0,
                buyPrice: result.tradeParams?.amount || 0,
                profitLoss: undefined, // Will be set when trade completes

                // Legacy fields for backward compatibility
                derivContractType: result.tradeParams?.contract_type || 'N/A',
                userSelectedTradeType: selectedUserTradeTypeForLoop,
                stake: result.tradeParams?.amount || 0,
                durationSeconds: result.tradeParams?.duration || 0,
                reasoning: result.aiReasoning || (result.error ? 'Placement Error' : 'N/A'),
                stopLossPrice: 0,
                startTime: result.tradeResponse?.purchase_time ? result.tradeResponse.purchase_time * 1000 : Date.now(),
                status: result.success ? 'pending_execution' : 'failed_placement',
                currentPrice: result.tradeResponse?.entry_spot || 0,
                pnl: 0,
                barrier: result.tradeParams?.barrier,
                error: result.error
            }));
            setActiveAutomatedTrades(newUiTrades);

            const successfulPlacements = loopResults.filter(r => r.success).length;
            toast({
                title: 'Volatility AI Loop Concluded',
                description: `Trade placements: ${successfulPlacements} successful, ${loopResults.length - successfulPlacements} failed.`,
                duration: 7000
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            toast({ title: "Volatility AI Loop Error", description: `Failed to execute trading loop: ${errorMessage}`, variant: "destructive" });
            console.error("[VolatilityPage] Error in real trade loop: ", error);
        } finally {
            console.log("[VolatilityPage] Real trade loop finally: Resetting isAiLoading to false. Keeping isAutoTradingActive true until trades complete.");
            setIsAiLoading(false);
            // Don't set isAutoTradingActive to false immediately - let it stay active until trades are monitored
        }
    } else {
        console.log(`[VolatilityPage] Initiating SIMULATED trade session. User: ${userInfo.id}, Account Type: ${selectedDerivAccountType}, Total Stake: ${autoTradeTotalStake}`);
        toast({ title: "AI Simulation Starting...", description: `Simulating trades for Volatility Indices.` });
        try {
            const instrumentTicksData: Record<VolatilityInstrumentType, PriceTick[]> = {} as Record<VolatilityInstrumentType, PriceTick[]>;
            const instrumentIndicatorsData: Record<VolatilityInstrumentType, Record<string, unknown>> = {};

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
                    ...(calculateStochastic(highPrices, lowPrices, closePrices) && { stochastic: calculateStochastic(highPrices, lowPrices, closePrices) }),
                    ...(calculateWilliamsR(highPrices, lowPrices, closePrices) !== undefined && { williamsR: calculateWilliamsR(highPrices, lowPrices, closePrices) }),
                    ...(calculateCCI(highPrices, lowPrices, closePrices) !== undefined && { cci: calculateCCI(highPrices, lowPrices, closePrices) }),
                  };
                } else { throw new Error("No candle data"); }
              } catch (err) {
                instrumentTicksData[inst] = []; instrumentIndicatorsData[inst] = {};
                toast({title: `Data Error ${inst}`, description: `Sim: Could not fetch price data for ${inst}.`, variant: "destructive", duration: 3000});
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
              toast({ title: "AI Sim Update", description: strategyResult?.overallReasoning || 'AI sim: no trades.', duration: 7000 });
              setIsAutoTradingActive(false);
              setIsAiLoading(false);
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
              const actionDirection = proposal.action === 'CALL' ? 'CALL' : 'PUT';
              const stopLossPrice = actionDirection === 'CALL' ? entryPrice * (1 - stopLossPercentage) : entryPrice * (1 + stopLossPercentage);

              newTrades.push({
                id: uuidv4(),
                instrument: proposal.instrument as VolatilityInstrumentType,

                // New Deriv-style fields
                tradeType: getTradeTypeDisplayName("RiseFall", proposal.action),
                entryPrice,
                buyPrice: proposal.stake,
                profitLoss: undefined, // Will be set when trade completes

                // Legacy fields for backward compatibility
                derivContractType: proposal.action,
                userSelectedTradeType: "RiseFall",
                actionDirection: actionDirection,
                stake: proposal.stake,
                durationSeconds: proposal.durationSeconds,
                reasoning: proposal.reasoning,
                stopLossPrice: parseFloat(stopLossPrice.toFixed(getInstrumentDecimalPlaces(proposal.instrument as InstrumentType))),
                startTime: Date.now(),
                status: 'active',
                currentPrice: entryPrice,
              });
            }
            if (newTrades.length === 0) {
              toast({ title: "AI Sim Update", description: "No valid sim trades initiated.", duration: 7000 });
              setIsAutoTradingActive(false);
            } else {
              setActiveAutomatedTrades(newTrades);
            }
      } catch (error) {
        toast({ title: "AI Sim Failed", description: `Sim strategy error: ${(error as Error).message}`, variant: "destructive" });
        setIsAutoTradingActive(false);
      } finally {
        console.log("[VolatilityPage] Sim logic finally: Resetting isAiLoading to false. isAutoTradingActive is:", isAutoTradingActive);
        setIsAiLoading(false);
      }
    }
  }, [
    authStatus, userInfo, selectedDerivAccountType, autoTradeTotalStake, currentBalance,
    consecutiveAiCallCount, lastAiCallTimestamp, router, toast,
    selectedUserTradeTypeForLoop,
    executionMode, numberOfBulkTrades, currentVolatilityInstrument,
    tradingMode, selectedAiStrategyId
]);

  const handleStopAiAutoTrade = () => {
    console.log("[VolatilityPage] handleStopAiAutoTrade called. Resetting isAutoTradingActive and isAiLoading.");
    setIsAutoTradingActive(false);
    setIsAiLoading(false);
    tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
    tradeIntervals.current.clear();

    // Clear real trade monitoring interval
    if (realTradeMonitoringInterval.current) {
      clearInterval(realTradeMonitoringInterval.current);
      realTradeMonitoringInterval.current = null;
    }

    setActiveAutomatedTrades(prevTrades =>
      prevTrades.map(trade => {
        if (trade.status === 'active' || trade.status === 'pending_execution') {
          const pnl = -(trade.stake || trade.buyPrice || 0);
          if (userInfo?.id && !selectedUserTradeTypeForLoop) {
            console.log('[VolatilityPage] Storing manually stopped SIMULATED trade for user:', userInfo.id);
            fetch('/api/trades', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', },
              body: JSON.stringify({
                userId: userInfo.id,
                email: userInfo.email,
                name: userInfo.name,
                symbol: trade.instrument,
                type: trade.actionDirection === 'CALL' ? 'buy' : 'sell',
                amount: trade.stake || trade.buyPrice || 0,
                price: trade.entryPrice,
                aiStrategyId: selectedAiStrategyId,
                metadata: {
                  mode: tradingMode,
                  duration: `${trade.durationSeconds}s`,
                  accountType: selectedDerivAccountType,
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
                return fetch(`/api/trades/${createdTrade.id}/close`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', },
                  body: JSON.stringify({
                    exitPrice: trade.currentPrice,
                    profitLoss: pnl,
                    metadata: { outcome: 'closed_manual', pnl: pnl, profitLoss: pnl, reason: "Manually stopped automated trade" }
                  }),
                });
              }
              throw new Error('Failed to create trade in DB for manual stop');
            })
            .then(response => response?.json())
            .then(closedTrade => console.log('[VolatilityPage] Manual stop sim trade closed:', closedTrade?.id))
            .catch(error => console.error("[VolatilityPage] Error processing manually stopped sim trade:", error));
          }

          // Update profits immediately without setTimeout
          setProfitsClaimable(prevProfits => ({
            totalNetProfit: prevProfits.totalNetProfit + pnl,
            tradeCount: prevProfits.tradeCount + 1,
            winningTrades: prevProfits.winningTrades,
            losingTrades: prevProfits.losingTrades + 1,
          }));
          return { 
            ...trade, 
            status: 'closed_manual', 
            pnl, 
            profitLoss: pnl, // Update both legacy and new fields
            reasoning: (trade.reasoning || "") + " Manually stopped.", 
            endTime: Date.now(), // Add end time for proper record keeping
            exitPrice: trade.currentPrice // Set exit price to current price for proper display
          };
        }
        return trade;
      })
    );
    toast({ title: "AI Trading Stopped", description: `Session for ${selectedDerivAccountType} account has been stopped.`});
  };

  // Real trade monitoring useEffect (for backend trades)
  useEffect(() => {
    if (!selectedUserTradeTypeForLoop || !isAutoTradingActive || activeAutomatedTrades.length === 0 || isAiLoading) {
      if (realTradeMonitoringInterval.current) {
        clearInterval(realTradeMonitoringInterval.current);
        realTradeMonitoringInterval.current = null;
      }
      return;
    }

    const currentToken = selectedDerivAccountType === 'demo' ? userInfo?.derivDemoApiToken : userInfo?.derivRealApiToken;
    const currentAccountId = selectedDerivAccountType === 'demo' ? userInfo?.derivDemoAccountId : userInfo?.derivRealAccountId;

    if (!currentToken || !currentAccountId) {
      console.error('[VolatilityPage] Missing token or account ID for real trade monitoring');
      return;
    }

    console.log(`[VolatilityPage] Starting real trade monitoring for ${activeAutomatedTrades.length} trades`);

    realTradeMonitoringInterval.current = setInterval(async () => {
      console.log('[VolatilityPage] Monitoring real trades...');

      let tradesUpdated = false;
      const updatedTrades = await Promise.all(
        activeAutomatedTrades.map(async (trade) => {
          // Only monitor trades that are not settled and have valid contract IDs
          if (trade.status === 'failed_placement' || trade.status === 'won' || trade.status === 'lost_duration' || trade.status === 'closed_manual') {
            return trade;
          }

          // Skip trades without valid numeric contract IDs
          if (!trade.id || isNaN(Number(trade.id)) || trade.id.length < 5) {
            console.log(`[VolatilityPage] Skipping monitoring for trade with invalid contract ID: ${trade.id}`);
            return trade;
          }

          try {
            console.log(`[VolatilityPage] Checking status for contract ID: ${trade.id}`);
            const contractStatusData = await getContractStatus(Number(trade.id), currentToken, currentAccountId);
            tradesUpdated = true;

            const newLocalStatus = mapDerivStatusToLocal(contractStatusData.status);
            const isSettled = newLocalStatus === 'won' || newLocalStatus === 'lost_duration' || newLocalStatus === 'closed_manual';

            const updatedTrade: ActiveAutomatedVolatilityTrade = {
              ...trade,
              status: newLocalStatus,
              currentPrice: contractStatusData.current_spot ?? trade.currentPrice,

              // Update new Deriv-style fields
              exitPrice: isSettled ? contractStatusData.current_spot : undefined,
              profitLoss: isSettled ? contractStatusData.profit : undefined,
              endTime: isSettled ? Date.now() : undefined,

              // Legacy field for backward compatibility
              pnl: isSettled ? contractStatusData.profit : undefined,
            };

            if (isSettled) {
              console.log(`[VolatilityPage] Trade ${trade.id} settled with status: ${newLocalStatus}, P/L: ${contractStatusData.profit}`);

              // Enhanced logging for Higher/Lower and Touch/No Touch trades
              if (trade.userSelectedTradeType === 'HigherLower') {
                console.log(`[VolatilityPage] Higher/Lower trade completed:`, {
                  instrument: trade.instrument,
                  contractType: trade.derivContractType,
                  entryPrice: trade.entryPrice,
                  exitPrice: contractStatusData.current_spot,
                  barrier: contractStatusData.barrier,
                  duration: trade.durationSeconds,
                  pnl: contractStatusData.profit,
                  status: newLocalStatus
                });
              } else if (trade.userSelectedTradeType === 'TouchNoTouch') {
                console.log(`[VolatilityPage] Touch/No Touch trade completed:`, {
                  instrument: trade.instrument,
                  contractType: trade.derivContractType,
                  entryPrice: trade.entryPrice,
                  exitPrice: contractStatusData.current_spot,
                  barrier: contractStatusData.barrier,
                  highBarrier: contractStatusData.high_barrier,
                  lowBarrier: contractStatusData.low_barrier,
                  duration: trade.durationSeconds,
                  pnl: contractStatusData.profit,
                  status: newLocalStatus,
                  barrierTouched: contractStatusData.is_expired ? 'Contract expired' : 'Check barrier status'
                });
              }

              // Update profits
              const pnl = contractStatusData.profit || 0;
              setProfitsClaimable(prevProfits => ({
                totalNetProfit: prevProfits.totalNetProfit + pnl,
                tradeCount: prevProfits.tradeCount + 1,
                winningTrades: newLocalStatus === 'won' ? prevProfits.winningTrades + 1 : prevProfits.winningTrades,
                losingTrades: newLocalStatus === 'lost_duration' ? prevProfits.losingTrades + 1 : prevProfits.losingTrades,
              }));

              toast({
                title: `Real Trade Ended (${selectedDerivAccountType}): ${trade.instrument}`,
                description: `Status: ${newLocalStatus}, P/L: $${pnl.toFixed(2)}`,
                variant: pnl > 0 ? "default" : "destructive"
              });
            }

            return updatedTrade;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[VolatilityPage] Error monitoring trade ${trade.id}:`, errorMessage);
            return trade; // Return unchanged trade on error
          }
        })
      );

      if (tradesUpdated) {
        setActiveAutomatedTrades(updatedTrades);
      }

      // Check if all trades are settled to stop the session
      const allSettled = updatedTrades.every(t =>
        t.status === 'won' || t.status === 'lost_duration' || t.status === 'lost_stoploss' || t.status === 'closed_manual' || t.status === 'failed_placement'
      );

      if (allSettled && updatedTrades.length > 0) {
        console.log('[VolatilityPage] All real trades settled, stopping session');
        setIsAutoTradingActive(false);
        if (realTradeMonitoringInterval.current) {
          clearInterval(realTradeMonitoringInterval.current);
          realTradeMonitoringInterval.current = null;
        }

        // Refresh balance after all trades are completed
        console.log('[VolatilityPage] Refreshing balance after trade completion');

        // Force immediate balance refresh through the listener
        if (selectedDerivAccountType === 'demo' && demoBalanceListenerRef.current) {
          demoBalanceListenerRef.current.forceBalanceRefresh();
        } else if (selectedDerivAccountType === 'real' && realBalanceListenerRef.current) {
          realBalanceListenerRef.current.forceBalanceRefresh();
        }

        // Also refresh through the API as backup
        refreshBalance();

        // Calculate session summary
        const settledTrades = updatedTrades.filter(t =>
          t.status === 'won' || t.status === 'lost_duration' || t.status === 'lost_stoploss' || t.status === 'closed_manual'
        );
        const totalPnL = settledTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        const winCount = settledTrades.filter(t => t.status === 'won').length;
        const lossCount = settledTrades.filter(t => t.status === 'lost_duration').length;
        const winRate = settledTrades.length > 0 ? ((winCount / settledTrades.length) * 100).toFixed(1) : '0';

        toast({
          title: "AI Session Complete",
          description: `${settledTrades.length} trades • ${winCount}W/${lossCount}L (${winRate}%) • P/L: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`,
          variant: totalPnL >= 0 ? "default" : "destructive",
          duration: 6000,
        });
      }
    }, 5000); // Check every 5 seconds

    return () => {
      if (realTradeMonitoringInterval.current) {
        clearInterval(realTradeMonitoringInterval.current);
        realTradeMonitoringInterval.current = null;
      }
    };
  }, [
    selectedUserTradeTypeForLoop, isAutoTradingActive, activeAutomatedTrades, isAiLoading,
    userInfo, selectedDerivAccountType, setProfitsClaimable, toast, refreshBalance, 
    demoBalanceListenerRef, realBalanceListenerRef
  ]);

  // Simulation trade monitoring useEffect (for page simulations)
  useEffect(() => {
    if (selectedUserTradeTypeForLoop || !isAutoTradingActive || activeAutomatedTrades.length === 0 || isAiLoading) {
      if(!selectedUserTradeTypeForLoop && !isAutoTradingActive && tradeIntervals.current.size > 0) {
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
                if(currentTrade.status === 'active' || currentTrade.status === 'pending_execution') allSimulatedTradesConcluded = false;
                return currentTrade;
              }

              let newStatus: ActiveAutomatedVolatilityTrade['status'] = currentTrade.status;
              let pnl = currentTrade.pnl ?? 0;
              let newCurrentPrice = currentTrade.currentPrice ?? currentTrade.entryPrice;
              const decimalPlaces = getInstrumentDecimalPlaces(currentTrade.instrument);
              const priceChangeFactor = (Math.random() - 0.5) * (currentTrade.instrument.includes("100") ? 0.005 : 0.0005);
              newCurrentPrice += priceChangeFactor * newCurrentPrice;
              newCurrentPrice = parseFloat(newCurrentPrice.toFixed(decimalPlaces));

              // Calculate running P/L for active trades
              if (newStatus === 'active') {
                if (currentTrade.actionDirection === 'CALL') {
                  pnl = newCurrentPrice > currentTrade.entryPrice ?
                    (newCurrentPrice - currentTrade.entryPrice) / currentTrade.entryPrice * currentTrade.stake * 0.85 :
                    -(currentTrade.entryPrice - newCurrentPrice) / currentTrade.entryPrice * currentTrade.stake * 0.5;
                } else { // PUT
                  pnl = newCurrentPrice < currentTrade.entryPrice ?
                    (currentTrade.entryPrice - newCurrentPrice) / currentTrade.entryPrice * currentTrade.stake * 0.85 :
                    -(newCurrentPrice - currentTrade.entryPrice) / currentTrade.entryPrice * currentTrade.stake * 0.5;
                }
                pnl = parseFloat(pnl.toFixed(2));
              }

              if (currentTrade.actionDirection === 'CALL' && newCurrentPrice <= currentTrade.stopLossPrice) {
                newStatus = 'lost_stoploss'; pnl = -currentTrade.stake;
              } else if (currentTrade.actionDirection === 'PUT' && newCurrentPrice >= currentTrade.stopLossPrice) {
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
                  console.log('[VolatilityPage] Storing SIMULATED trade outcome for user:', userInfo.id);
                  fetch('/api/trades', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({
                      userId: userInfo.id,
                      email: userInfo.email, name: userInfo.name,
                      symbol: currentTrade.instrument,

                      // New Deriv-style fields
                      tradeType: currentTrade.tradeType || (currentTrade.actionDirection === 'CALL' ? 'Rise/Fall' : 'Rise/Fall'),
                      entryPrice: currentTrade.entryPrice,
                      buyPrice: currentTrade.buyPrice || currentTrade.stake,

                      // Legacy fields for backward compatibility
                      type: currentTrade.actionDirection === 'CALL' ? 'buy' : 'sell',
                      amount: currentTrade.stake,
                      price: currentTrade.entryPrice,

                      aiStrategyId: selectedAiStrategyId,
                      metadata: {
                        mode: tradingMode,
                        duration: `${currentTrade.durationSeconds}s`,
                        accountType: selectedDerivAccountType,
                        automated: true,
                        tradeCategory: 'volatility',
                        reasoning: currentTrade.reasoning
                      }
                    }),
                  })
                  .then(response => response.json())
                  .then(createdTrade => {
                    if (createdTrade && createdTrade.id) {
                      return fetch(`/api/trades/${createdTrade.id}/close`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', },
                        body: JSON.stringify({
                          exitPrice: newCurrentPrice,
                          profitLoss: pnl,
                          metadata: {
                            outcome: newStatus,
                            pnl: pnl,
                            profitLoss: pnl,
                            reason: "Automated simulation completed",
                            completedAt: new Date().toISOString()
                          }
                        }),
                      });
                    }
                    throw new Error('Failed to create sim trade in DB');
                  })
                  .then(response => response?.json())
                  .then(closedTrade => console.log('[VolatilityPage] Sim trade closed:', closedTrade?.id))
                  .catch(error => console.error("[VolatilityPage] Error processing sim trade DB:", error));
                }

                // Update profits immediately without setTimeout
                setProfitsClaimable(prevProfits => ({
                  totalNetProfit: prevProfits.totalNetProfit + pnl,
                  tradeCount: prevProfits.tradeCount + 1,
                  winningTrades: newStatus === 'won' ? prevProfits.winningTrades + 1 : prevProfits.winningTrades,
                  losingTrades: (newStatus === 'lost_duration' || newStatus === 'lost_stoploss') ? prevProfits.losingTrades + 1 : prevProfits.losingTrades,
                }));
                toast({
                  title: `Sim Trade Ended (${selectedDerivAccountType}): ${currentTrade.instrument}`,
                  description: `Status: ${newStatus}, P/L: $${pnl.toFixed(2)}`,
                  variant: pnl > 0 ? "default" : "destructive"
                });
              } else {
                allSimulatedTradesConcluded = false;
              }
              return { ...currentTrade, status: newStatus, pnl, currentPrice: newCurrentPrice };
            });

            if (allSimulatedTradesConcluded && isAutoTradingActive) {
              console.log('[VolatilityPage] Simulation useEffect: All SIMULATED trades concluded, isAutoTradingActive set to false.');
              setIsAutoTradingActive(false);
              toast({ title: "AI Simulation Session Complete", description: `All simulated trades for ${selectedDerivAccountType} account concluded.`});
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
  }, [activeAutomatedTrades, isAutoTradingActive, selectedDerivAccountType, toast, isAiLoading, userInfo, selectedAiStrategyId, tradingMode, selectedUserTradeTypeForLoop]);

  // Real-time price streaming for trade type cards
  useEffect(() => {
    if (!selectedUserTradeTypeForLoop || (selectedUserTradeTypeForLoop !== 'DigitsEvenOdd' && selectedUserTradeTypeForLoop !== 'DigitsOverUnder')) {
      return;
    }

    // Allow Over/Under cards to show even without digit selection

    let priceStreamInterval: NodeJS.Timeout;
    let lastPrice = 0;
    let isInitialized = false;

    const streamPrices = async () => {
      try {
        // Get initial price from API only once
        if (!isInitialized) {
          const candles = await getCandles(currentVolatilityInstrument, 60);
          if (candles && candles.length > 0) {
            lastPrice = candles[candles.length - 1].close;
            isInitialized = true;
          }
        }

        if (lastPrice > 0) {
          // Simulate real-time price movements like Deriv
          const decimalPlaces = getInstrumentDecimalPlaces(currentVolatilityInstrument);
          const volatility = currentVolatilityInstrument.includes('100') ? 0.003 :
                            currentVolatilityInstrument.includes('75') ? 0.002 :
                            currentVolatilityInstrument.includes('50') ? 0.0015 :
                            currentVolatilityInstrument.includes('25') ? 0.001 :
                            currentVolatilityInstrument.includes('10') ? 0.0008 : 0.001;

          const priceChange = (Math.random() - 0.5) * volatility * lastPrice;
          const newPrice = lastPrice + priceChange;
          const adjustedPrice = parseFloat(newPrice.toFixed(decimalPlaces));

          lastPrice = adjustedPrice;
          const priceStr = adjustedPrice.toFixed(decimalPlaces);
          const lastDigit = parseInt(priceStr.charAt(priceStr.length - 1));

          setCurrentStreamingPrice(adjustedPrice);

          // Add to sequence with real-time updates
          const now = Date.now();
          setPriceSequence(prev => {
            const newSequence = [...prev, {
              price: adjustedPrice,
              digit: lastDigit,
              timestamp: now
            }];
            // Keep only last 50 items for performance
            return newSequence.slice(-50);
          });
        }
      } catch (error) {
        console.error('Error streaming prices for trade type cards:', error);
      }
    };

    // Initial load
    streamPrices();

    // Update every 500ms to match Deriv's real-time speed (like per-tick updates)
    priceStreamInterval = setInterval(streamPrices, 500);

    return () => {
      if (priceStreamInterval) {
        clearInterval(priceStreamInterval);
      }
    };
  }, [selectedUserTradeTypeForLoop, currentVolatilityInstrument]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Clear all intervals on unmount
      tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
      tradeIntervals.current.clear();
      if (realTradeMonitoringInterval.current) {
        clearInterval(realTradeMonitoringInterval.current);
        realTradeMonitoringInterval.current = null;
      }
    };
  }, []);


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
              {/* 1. Select Volatility Index */}
              <div className="space-y-2">
                <Label htmlFor="volatility-index-select">Select Volatility Index</Label>
                <Select
                  value={currentVolatilityInstrument}
                  onValueChange={(value) => setCurrentVolatilityInstrument(value as VolatilityInstrumentType)}
                  disabled={isAutoTradingActive || isAiLoading}
                >
                  <SelectTrigger id="volatility-index-select">
                    <SelectValue placeholder="Select volatility index" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Volatility 10 Index">10</SelectItem>
                    <SelectItem value="Volatility 10 (1s) Index">10 (1s)</SelectItem>
                    <SelectItem value="Volatility 25 Index">25</SelectItem>
                    <SelectItem value="Volatility 25 (1s) Index">25 (1s)</SelectItem>
                    <SelectItem value="Volatility 50 Index">50</SelectItem>
                    <SelectItem value="Volatility 50 (1s) Index">50 (1s)</SelectItem>
                    <SelectItem value="Volatility 75 Index">75</SelectItem>
                    <SelectItem value="Volatility 75 (1s) Index">75 (1s)</SelectItem>
                    <SelectItem value="Volatility 100 Index">100</SelectItem>
                    <SelectItem value="Volatility 100 (1s) Index">100 (1s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Execution Mode */}
              <div className="space-y-3">
                <Label htmlFor="execution-mode">Execution Mode</Label>
                <div className="flex space-x-2">
                  <Button
                    variant={executionMode === 'turbo' ? 'default' : 'outline'}
                    onClick={() => setExecutionMode('turbo')}
                    disabled={isAutoTradingActive || isAiLoading}
                    className="flex-1"
                  >
                    Turbo
                  </Button>
                  <Button
                    variant={executionMode === 'safe' ? 'default' : 'outline'}
                    onClick={() => setExecutionMode('safe')}
                    disabled={isAutoTradingActive || isAiLoading}
                    className="flex-1"
                  >
                    Safe
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
                  <div className="font-medium mb-2">Mode Explanation:</div>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Turbo:</span> Trades only one tick when execution starts. Entry and exit prices are the same for all contracts (e.g., 4567.76 → 4567.76).
                    </div>
                    <div>
                      <span className="font-medium">Safe:</span> Trades each tick during execution. Each contract has different entry and exit prices (e.g., 1st: 4567.76 → 4567.76, 2nd: 4668.90 → 4668.90).
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Number of Bulk Trades */}
              <div className="space-y-2">
                <Label htmlFor="bulk-trades">Number of Bulk Trades</Label>
                <Input
                  id="bulk-trades"
                  type="number"
                  min="1"
                  max="20"
                  value={numberOfBulkTrades}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value >= 1 && value <= 20) {
                      setNumberOfBulkTrades(value);
                    }
                  }}
                  disabled={isAutoTradingActive || isAiLoading}
                  className="text-center"
                  placeholder="Enter number (1-20)"
                />
                <div className="text-xs text-muted-foreground">
                  Enter a number between 1 and 20 trades per session
                </div>
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

              <div className="space-y-3">
                <Label htmlFor="volatility-user-trade-type-loop">Select Trade Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {USER_TRADE_TYPES_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant={selectedUserTradeTypeForLoop === option.value ? 'default' : 'outline'}
                        onClick={() => {
                          setSelectedUserTradeTypeForLoop(option.value);
                          // Reset digit selections when changing trade types
                          if (option.value !== 'DigitsOverUnder') {
                            setSelectedOverDigit(null);
                            setSelectedUnderDigit(null);
                          }
                        }}
                      disabled={isAutoTradingActive || isAiLoading}
                      className="h-12 text-sm font-medium border-2"
                    >
                      {option.label}
                    </Button>
                  ))}
                  <Button
                    variant={selectedUserTradeTypeForLoop === undefined ? 'default' : 'outline'}
                    onClick={() => setSelectedUserTradeTypeForLoop(undefined)}
                    disabled={isAutoTradingActive || isAiLoading}
                    className="h-12 text-sm font-medium border-2 col-span-2"
                  >
                    Simulation Mode
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Select a trade type for real trading or use Simulation Mode for practice.</p>
              </div>

              <div>
                <Label htmlFor="vol-auto-stake">Total Stake for Session ($)</Label>
                <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="vol-auto-stake" type="number" value={autoTradeTotalStake} onChange={handleAutoStakeChange} placeholder="e.g., 10 for Real Loop / 100 for Sim" className="w-full pl-8" min="0.35" disabled={isAutoTradingActive || isAiLoading} />
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

          {/* Even/Odd Trade Type Card */}
          {selectedUserTradeTypeForLoop === 'DigitsEvenOdd' && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Even/Odd Analysis - {getChartTabLabel(currentVolatilityInstrument)}</CardTitle>
                <CardDescription>Real-time digit sequence for Even/Odd trading</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Current Price Display */}
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-2">Current Price</div>
                    <div className="text-2xl font-mono font-bold">
                      {currentStreamingPrice.toFixed(getInstrumentDecimalPlaces(currentVolatilityInstrument))}
                    </div>
                  </div>

                  {/* Even/Odd Sequence */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-center">Digit Sequence (Last 20 ticks)</div>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {priceSequence.slice(-20).map((item, index) => {
                        const isEven = item.digit % 2 === 0;
                        return (
                          <div
                            key={`${item.timestamp}-${index}`}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                              isEven ? 'bg-blue-500' : 'bg-red-500'
                            }`}
                          >
                            {isEven ? 'E' : 'O'}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex justify-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                      <span>Even (0,2,4,6,8)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-red-500"></div>
                      <span>Odd (1,3,5,7,9)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Over/Under Trade Type Card */}
          {selectedUserTradeTypeForLoop === 'DigitsOverUnder' && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Over/Under Analysis - {getChartTabLabel(currentVolatilityInstrument)}</CardTitle>
                <CardDescription>Select your digit and view real-time sequence</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Current Price Display */}
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-2">Current Price</div>
                    <div className="text-2xl font-mono font-bold">
                      {currentStreamingPrice.toFixed(getInstrumentDecimalPlaces(currentVolatilityInstrument))}
                    </div>
                  </div>

                  {/* Digit Selection */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Over Column */}
                    <div className="space-y-3">
                      <div className="text-center font-medium text-green-600">Over</div>
                      <div className="grid grid-cols-5 gap-2">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                          <button
                            key={`over-${digit}`}
                            onClick={() => {
                              // Allow selecting/deselecting from Over column without affecting Under column
                              setSelectedOverDigit(selectedOverDigit === digit ? null : digit);
                            }}
                            className={`w-10 h-10 rounded-full border-2 font-bold text-sm ${
                              selectedOverDigit === digit
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                            }`}
                          >
                            {digit}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Under Column */}
                    <div className="space-y-3">
                      <div className="text-center font-medium text-red-600">Under</div>
                      <div className="grid grid-cols-5 gap-2">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                          <button
                            key={`under-${digit}`}
                            onClick={() => {
                              // Allow selecting/deselecting from Under column without affecting Over column
                              setSelectedUnderDigit(selectedUnderDigit === digit ? null : digit);
                            }}
                            className={`w-10 h-10 rounded-full border-2 font-bold text-sm ${
                              selectedUnderDigit === digit
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                            }`}
                          >
                            {digit}
                          </button>
                        ))}
                      </div>

                      {/* Over/Under digit selection grid */}
                      {selectedUserTradeTypeForLoop === 'DigitsOverUnder' && (
                        <div className="mt-6">
                          <h3 className="text-lg font-medium mb-2">Digit Selection</h3>
                          <div className="grid grid-cols-2 gap-4">
                            {/* Over digits selection */}
                            <div className="border rounded-lg p-4">
                              <h4 className="font-medium mb-2 text-primary">Over</h4>
                              <div className="grid grid-cols-5 gap-2">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                                  <Button
                                    key={`over-${digit}`}
                                    variant={selectedOverDigit === digit ? "default" : "outline"}
                                    className={`h-12 w-12 ${selectedOverDigit === digit ? 'bg-primary text-primary-foreground' : ''}`}
                                    onClick={() => handleDigitSelection(digit, 'over')}
                                  >
                                    {digit}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            {/* Under digits selection */}
                            <div className="border rounded-lg p-4">
                              <h4 className="font-medium mb-2 text-destructive">Under</h4>
                              <div className="grid grid-cols-5 gap-2">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                                  <Button
                                    key={`under-${digit}`}
                                    variant={selectedUnderDigit === digit ? "default" : "outline"}
                                    className={`h-12 w-12 ${selectedUnderDigit === digit ? 'bg-destructive text-destructive-foreground' : ''}`}
                                    onClick={() => handleDigitSelection(digit, 'under')}
                                  >
                                    {digit}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Digit Sequence */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-center">
                      Last Digit Sequence (Last 20 ticks)
                      {(selectedOverDigit !== null || selectedUnderDigit !== null) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Selected: {[
                            selectedOverDigit !== null ? `Over ${selectedOverDigit}` : null,
                            selectedUnderDigit !== null ? `Under ${selectedUnderDigit}` : null
                          ].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {priceSequence.slice(-20).map((item, index) => {
                        let bgColor = 'bg-gray-300';
                        let isWinning = false;

                        // Handle both Over and Under selections simultaneously
                        if (selectedOverDigit !== null && selectedUnderDigit !== null) {
                          // Both selected: digit wins if it satisfies either condition
                          const overWin = item.digit > selectedOverDigit;
                          const underWin = item.digit < selectedUnderDigit;
                          isWinning = overWin || underWin;
                          bgColor = isWinning ? 'bg-green-500' : 'bg-red-500';
                        } else if (selectedOverDigit !== null) {
                          // Only Over selected: digits above selected digit are green (win)
                          isWinning = item.digit > selectedOverDigit;
                          bgColor = isWinning ? 'bg-green-500' : 'bg-red-500';
                        } else if (selectedUnderDigit !== null) {
                          // Only Under selected: digits below selected digit are green (win)
                          isWinning = item.digit < selectedUnderDigit;
                          bgColor = isWinning ? 'bg-green-500' : 'bg-red-500';
                        }

                        return (
                          <div
                            key={`${item.timestamp}-${index}`}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${bgColor}`}
                          >
                            {item.digit}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="text-xs text-muted-foreground text-center space-y-1">
                    <div>Select one digit from Over column, Under column, or both to see win/loss predictions</div>
                    <div>Click the same digit again to deselect it</div>
                    <div className="flex justify-center gap-4">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>Winning digits</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span>Losing digits</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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
                      <TableHead>Trade Type</TableHead>
                      <TableHead>Entry Point</TableHead>
                      <TableHead>Exit Point</TableHead>
                      <TableHead>Buy Price</TableHead>
                      <TableHead>Profit/Loss</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAutomatedTrades.map(trade => (
                      <TableRow key={trade.id}>
                        {/* Trade Type */}
                        <TableCell>
                          <Badge variant={trade.derivContractType === 'CALL' || trade.derivContractType === 'ONETOUCH' || trade.derivContractType === 'DIGITEVEN' || trade.derivContractType === 'DIGITOVER' ? 'default' : 'destructive'}
                                 className={(trade.derivContractType === 'CALL' || trade.derivContractType === 'ONETOUCH' || trade.derivContractType === 'DIGITEVEN' || trade.derivContractType === 'DIGITOVER') ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                            {trade.tradeType || getDisplayTradeTypeDetails(trade.derivContractType, trade.userSelectedTradeType, trade.barrier)}
                          </Badge>
                        </TableCell>

                        {/* Entry Point */}
                        <TableCell>{trade.entryPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) || '-'}</TableCell>

                        {/* Exit Point */}
                        <TableCell>{trade.exitPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) || (trade.currentPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument))) || '-'}</TableCell>

                        {/* Buy Price */}
                        <TableCell>${trade.buyPrice?.toFixed(2) || trade.stake?.toFixed(2) || '0.00'}</TableCell>

                        {/* Profit/Loss */}
                        <TableCell className={trade.profitLoss && trade.profitLoss > 0 ? 'text-green-500' : trade.profitLoss && trade.profitLoss < 0 ? 'text-red-500' : trade.pnl && trade.pnl > 0 ? 'text-green-500' : trade.pnl && trade.pnl < 0 ? 'text-red-500' : ''}>
                          {trade.profitLoss !== undefined ? `$${trade.profitLoss.toFixed(2)}` : (trade.pnl !== undefined ? `$${trade.pnl.toFixed(2)}` : '-')}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge variant={trade.status === 'active' || trade.status === 'pending_execution' ? 'secondary' : (trade.status === 'won' ? 'default' : 'destructive')}
                                 className={trade.status === 'active' || trade.status === 'pending_execution' ? 'bg-blue-500 text-white' : (trade.status === 'won' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600')}>
                            {trade.status === 'active' ? 'Active' :
                             trade.status === 'pending_execution' ? 'Pending' :
                             trade.status === 'failed_placement' ? 'Failed' :
                             trade.status === 'won' ? 'Won' :
                             trade.status === 'lost_duration' ? 'Lost' :
                             trade.status === 'lost_stoploss' ? 'Stop Loss' :
                             trade.status === 'closed_manual' ? 'Closed' :
                             trade.status}
                          </Badge>
                        </TableCell>

                        {/* Instrument */}
                        <TableCell>{trade.instrument}</TableCell>

                        {/* Details */}
                        <TableCell className="text-xs max-w-[150px] truncate" title={trade.reasoning || trade.error || "No details"}>
                          {selectedUserTradeTypeForLoop ? (trade.error || "Placed") : (trade.reasoning || "AI Trade")}
                        </TableCell>
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


