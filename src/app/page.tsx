'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { TradingChart } from '@/components/dashboard/trading-chart';
import { TradeControls } from '@/components/dashboard/trade-controls';
import { AiRecommendationCard } from '@/components/dashboard/ai-recommendation-card';
import type { TradingMode, TradeDuration, AiRecommendation, PaperTradingMode, ActiveAutomatedTrade, ProfitsClaimable, PriceTick, ForexCryptoCommodityInstrumentType, VolatilityInstrumentType, AuthStatus, MarketSentimentParams, InstrumentType } from '@/types';
import { analyzeMarketSentiment, type AnalyzeMarketSentimentInput } from '@/ai/flows/analyze-market-sentiment';
import { explainAiReasoning } from '@/ai/flows/explain-ai-reasoning';
import { generateAutomatedTradingStrategy, AutomatedTradingStrategyInput } from '@/ai/flows/automated-trading-strategy-flow';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getCandles, placeTrade, instrumentToDerivSymbol, getTradingDurations, type PlaceTradeResponse } from '@/services/deriv';
import { v4 as uuidv4 } from 'uuid'; 
import { getInstrumentDecimalPlaces } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateEMA, calculateATR } from '@/lib/technical-analysis';
import { 
  SUPPORTED_INSTRUMENTS, 
  DEFAULT_INSTRUMENT,
  FOREX_CRYPTO_COMMODITY_INSTRUMENTS
} from "@/config/instruments";
import { getMarketStatus } from '@/lib/market-hours';
import { DEFAULT_AI_STRATEGY_ID } from '@/config/ai-strategies';
import { BalanceDisplay } from '@/components/dashboard/balance-display';

const DEFAULT_PAPER_BALANCE = 10000; // Fallback if context value is null
const DEFAULT_LIVE_BALANCE = 0;    // Fallback if context value is null

// Define local TradeRecord interface to avoid import issues
interface TradeRecord {
  id: string;
  timestamp: number;
  instrument: InstrumentType;
  action: 'CALL' | 'PUT' | 'BUY' | 'SELL';
  duration?: string;
  stake: number;
  entryPrice: number;
  exitPrice?: number | null;
  pnl: number;
  status: string;
  accountType: 'demo' | 'real'; // Updated to match selectedDerivAccountType
  tradeCategory: 'forexCrypto' | 'volatility' | 'mt5';
  reasoning?: string;
  isDbFallback?: boolean;
}

// Helper function to validate trade parameters
function validateTradeParameters(stake: number, balance: number, accountType: 'demo' | 'real' | null): string | null {
  if (stake > balance) {
    return `Insufficient ${accountType === 'demo' ? 'Demo' : 'Real'} Balance: Stake $${stake.toFixed(2)} exceeds available balance.`;
  }
  if (stake <= 0) {
    return "Invalid Stake: Stake amount must be greater than zero.";
  }
  return null;
}

/**
 * Renders the main trading dashboard page with manual and AI-assisted trading features for Forex, Crypto, and Commodity instruments.
 *
 * Provides real-time balance display, instrument selection, trading controls, AI recommendations, and automated trading session management. Integrates with Deriv API for trade execution and AI services for market sentiment analysis and strategy generation. Manages state for active trades, profits, and user notifications.
 *
 * @returns The trading dashboard React component.
 */
export default function DashboardPage() {
  const { 
    authStatus, 
    userInfo,
    selectedDerivAccountType,
    derivDemoAccountId,
    derivRealAccountId,
    derivDemoBalance,
    derivLiveBalance,
    updateSelectedDerivAccountType,
  } = useAuth();
  
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType>(FOREX_CRYPTO_COMMODITY_INSTRUMENTS[0]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [selectedAiStrategyId, setSelectedAiStrategyId] = useState<string>(DEFAULT_AI_STRATEGY_ID);
  const [tradeDuration, setTradeDuration] = useState<TradeDuration>('5m');
  const [availableDurations, setAvailableDurations] = useState<string[]>(['5m', '10m', '15m', '30m', '1h']);
  const [isLoadingDurations, setIsLoadingDurations] = useState<boolean>(false);
  const [isTradeable, setIsTradeable] = useState<boolean>(true);
  const [stakeAmount, setStakeAmount] = useState<number>(10);

  const [isMarketOpenForSelected, setIsMarketOpenForSelected] = useState<boolean>(true);
  const [marketStatusMessage, setMarketStatusMessage] = useState<string | null>(null);

  const [aiRecommendation, setAiRecommendation] = useState<AiRecommendation | null>(null);
  const [isFetchingManualRecommendation, setIsFetchingManualRecommendation] = useState(false);
  const [isPreparingAutoTrades, setIsPreparingAutoTrades] = useState(false);

  const [autoTradeTotalStake, setAutoTradeTotalStake] = useState<number>(100);
  const [isAutoTradingActive, setIsAutoTradingActive] = useState(false);
  const [activeAutomatedTrades, setActiveAutomatedTrades] = useState<ActiveAutomatedTrade[]>([]);
  const [automatedTradingLog, setAutomatedTradingLog] = useState<string[]>([]);
  const tradeIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const [profitsClaimable, setProfitsClaimable] = useState<ProfitsClaimable>({
    totalNetProfit: 0,
    tradeCount: 0,
    winningTrades: 0,
    losingTrades: 0,
  });

  const [selectedStopLossPercentage, setSelectedStopLossPercentage] = useState<number>(5);
  const [stopLossValue, setStopLossValue] = useState<string>('');
  const [takeProfitValue, setTakeProfitValue] = useState<string>('');
  const [consecutiveAiCallCount, setConsecutiveAiCallCount] = useState(0);
  const [lastAiCallTimestamp, setLastAiCallTimestamp] = useState<number | null>(null);
  const AI_COOLDOWN_DURATION_MS = 2 * 60 * 1000;

  const currentBalance = useMemo(() => {
    if (authStatus === 'authenticated' && userInfo?.derivAccessToken) {
      if (selectedDerivAccountType === 'demo') {
        return derivDemoBalance ?? DEFAULT_PAPER_BALANCE;
      } else if (selectedDerivAccountType === 'real') {
        return derivLiveBalance ?? DEFAULT_LIVE_BALANCE;
      }
    }
    return DEFAULT_PAPER_BALANCE;
  }, [authStatus, userInfo, selectedDerivAccountType, derivDemoBalance, derivLiveBalance]);

  const router = useRouter();
  const { toast } = useToast();

  // Effect to load and initialize profitsClaimable from localStorage based on the selected account type.
  // This ensures that profit/loss tracking persists across sessions for each account type (demo/real).
  useEffect(() => {
    const accountTypeKey = selectedDerivAccountType === 'real' ? 'live' : 'paper'; // 'paper' for demo, 'live' for real
    const profitsKey = `forexCryptoProfitsClaimable_${accountTypeKey}`;
    const storedProfits = localStorage.getItem(profitsKey);
    if (storedProfits) {
      try {
        setProfitsClaimable(JSON.parse(storedProfits));
      } catch (error) {
        console.error("Error parsing forex/crypto profits from localStorage:", error);
        // Initialize with default if parsing fails
        setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });
      }
    } else {
      // Initialize with default if no stored profits found for the account type
      setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });
    }
  }, [selectedDerivAccountType]); // Re-run when the account type changes

  // Effect to save profitsClaimable to localStorage whenever it changes or account type changes.
  // This keeps the persistent storage updated with the latest P&L data.
  useEffect(() => {
    const accountTypeKey = selectedDerivAccountType === 'real' ? 'live' : 'paper';
    const profitsKey = `forexCryptoProfitsClaimable_${accountTypeKey}`;
    localStorage.setItem(profitsKey, JSON.stringify(profitsClaimable));
  }, [profitsClaimable, selectedDerivAccountType]); // Re-run if profitsClaimable or account type changes

  // Effect to update market status (open/closed) for the currently selected instrument.
  useEffect(() => {
    const { isOpen, statusMessage } = getMarketStatus(currentInstrument);
    setIsMarketOpenForSelected(isOpen);
    setMarketStatusMessage(statusMessage);
  }, [currentInstrument]); // Re-run when the current instrument changes

  const handleInstrumentChange = (instrument: InstrumentType) => {
    if (FOREX_CRYPTO_COMMODITY_INSTRUMENTS.includes(instrument as ForexCryptoCommodityInstrumentType)) {
        setCurrentInstrument(instrument as ForexCryptoCommodityInstrumentType);
    } else {
        setCurrentInstrument(FOREX_CRYPTO_COMMODITY_INSTRUMENTS[0] as ForexCryptoCommodityInstrumentType);
        toast({
            title: "Instrument Switch",
            description: `${instrument} is a Volatility Index. Switched to ${FOREX_CRYPTO_COMMODITY_INSTRUMENTS[0]}. Use Volatility Trading page for Volatility Indices.`,
            variant: "default",
            duration: 5000
        });
    }
    const { isOpen, statusMessage } = getMarketStatus(instrument);
    setIsMarketOpenForSelected(isOpen);
    setMarketStatusMessage(statusMessage);
    setAiRecommendation(null); 
  };

  useEffect(() => {
    const fetchDurations = async () => {
      if (!currentInstrument) return;
      setIsLoadingDurations(true);
      const derivSymbol = instrumentToDerivSymbol(currentInstrument);
      const token = userInfo?.derivApiToken?.access_token;

      try {
        const durations = await getTradingDurations(derivSymbol, token);
        if (durations && durations.length > 0) {
          setAvailableDurations(durations);
          setIsTradeable(true);
          if (!durations.includes(tradeDuration) || tradeDuration === '') {
            setTradeDuration(durations[0] as TradeDuration);
          }
        } else {
          setAvailableDurations([]);
          setTradeDuration('');
          setIsTradeable(false);
        }
      } catch (error) {
        console.error(`[DashboardPage] Error fetching trading durations for ${currentInstrument}:`, error);
        setAvailableDurations([]);
        setTradeDuration('');
        setIsTradeable(false);
        toast({ title: "Duration Load Error", description: "Could not load durations.", variant: "destructive" });
      } finally {
        setIsLoadingDurations(false);
      }
    };
    fetchDurations();
  }, [currentInstrument, userInfo?.derivApiToken?.access_token, toast, tradeDuration]); // Dependencies for fetching durations

  // Handles the execution of a manual trade (CALL or PUT).
  // Performs several checks: authentication, market status, trade parameters validation, API token, and account ID.
  // Then, constructs and sends the trade payload to the Deriv API via `placeTrade`.
  const handleExecuteTrade = async (action: 'CALL' | 'PUT') => {
    if (authStatus === 'unauthenticated') {
      toast({ title: "Authentication Required", description: "Please log in to execute trades.", variant: "destructive" });
      router.push('/auth/login');
      return;
    }

    // Check if the market for the selected instrument is open (some crypto might be 24/7).
    const { isOpen, statusMessage } = getMarketStatus(currentInstrument);
    if (!isOpen && (FOREX_CRYPTO_COMMODITY_INSTRUMENTS.includes(currentInstrument as ForexCryptoCommodityInstrumentType) && !['BTC/USD', 'ETH/USD'].includes(currentInstrument as string))) {
      toast({ title: "Market Closed", description: statusMessage, variant: "destructive" });
      return;
    }

    // Validate stake amount against balance and ensure it's positive.
    const validationError = validateTradeParameters(stakeAmount, currentBalance, selectedDerivAccountType);
    if (validationError) {
      toast({ title: validationError.split(':')[0], description: validationError.split(':')[1].trim(), variant: "destructive" });
      return;
    }

    const apiToken = userInfo?.derivApiToken?.access_token;
    if (!userInfo?.id || !apiToken) {
      toast({ title: "Authentication Error", description: "Deriv API token not found. Please re-login or connect your Deriv account.", variant: "destructive" });
      return;
    }

    const targetAccountId = selectedDerivAccountType === 'demo' ? derivDemoAccountId : derivRealAccountId;
    if (!targetAccountId) {
      toast({ title: "Deriv Account ID Missing", description: `Your selected Deriv ${selectedDerivAccountType} account ID is not available. Please check profile or re-login.`, variant: "destructive"});
      return;
    }

    const durationMatch = tradeDuration.match(/^(\d+)([smhdt])$/);
    if (!durationMatch) {
      toast({ title: "Invalid Duration", description: "Trade duration format is invalid.", variant: "destructive" });
      return;
    }
    const durationValue = parseInt(durationMatch[1], 10);
    const durationUnit = durationMatch[2] as "s" | "m" | "h" | "d" | "t";

    const slAmount = stopLossValue && !isNaN(parseFloat(stopLossValue)) ? parseFloat(stopLossValue) : undefined;
    const tpAmount = takeProfitValue && !isNaN(parseFloat(takeProfitValue)) ? parseFloat(takeProfitValue) : undefined;
    const derivSymbol = instrumentToDerivSymbol(currentInstrument);

    const tradePayload = {
      token: apiToken,
      symbol: derivSymbol,
      contract_type: action,
      duration: durationValue,
      duration_unit: durationUnit,
      amount: stakeAmount,
      currency: "USD",
      basis: "stake",
      stop_loss: slAmount,
      take_profit: tpAmount,
    };

    console.log(`[Dashboard] Attempting to place Deriv trade on account ${targetAccountId} with details:`, tradePayload);
    try {
      const tradeResult: PlaceTradeResponse = await placeTrade(tradePayload, targetAccountId);
      console.log(`[Dashboard] Deriv trade placed successfully on account ${targetAccountId}:`, tradeResult);
      toast({
        title: `Trade Placed on Deriv (${selectedDerivAccountType})`,
        description: `ID: ${tradeResult.contract_id}. Entry: ${tradeResult.entry_spot}, Buy: ${tradeResult.buy_price.toFixed(getInstrumentDecimalPlaces(currentInstrument))}`
      });

      // Attempt to refresh balance after successful trade
      if (selectedDerivAccountType) {
        console.log(`[Dashboard] Attempting post-trade balance refresh for ${selectedDerivAccountType} account.`);
        await updateSelectedDerivAccountType(selectedDerivAccountType);
        // Optional: toast for balance update success/failure can be handled in AuthContext or here
        // For now, relying on AuthContext's internal handling.
      }

    } catch (error) {
      console.error(`[Dashboard] Deriv trade placement error on account ${targetAccountId}:`, error);
      toast({
        title: `Deriv Trade Failed (${selectedDerivAccountType})`,
        description: error instanceof Error ? error.message : "Failed to execute trade. Please try again.",
        variant: "destructive"
      });
    }
  };

  const fetchAndSetAiRecommendation = useCallback(async () => {
    if (authStatus === 'unauthenticated') {
      toast({ title: "Authentication Required", description: "Please log in for AI recommendations.", variant: "destructive" });
      router.push('/auth/login');
      return;
    }
    if (!FOREX_CRYPTO_COMMODITY_INSTRUMENTS.includes(currentInstrument as ForexCryptoCommodityInstrumentType)){
      toast({title: "AI Support Note", description: `AI recommendations for ${currentInstrument} are on its specific trading page.`, variant: "default"});
      return;
    }

    setIsFetchingManualRecommendation(true);
    setAiRecommendation(null); 
    console.log(`[DashboardPage] Fetching AI recommendation for ${currentInstrument}, mode: ${tradingMode}, account: ${selectedDerivAccountType}`);
    try {
      const marketSentimentParams: MarketSentimentParams = {
        symbol: currentInstrument as string, 
        tradingMode: tradingMode,
        aiStrategyId: selectedAiStrategyId,
      };
      const token = userInfo?.derivApiToken?.access_token;
      const currentCandles = await getCandles(currentInstrument, 60, 60, token);
      const closePrices = currentCandles.map(candle => candle.close);
      const highPrices = currentCandles.map(candle => candle.high);
      const lowPrices = currentCandles.map(candle => candle.low);

      if (closePrices.length > 0) { 
        marketSentimentParams.rsi = calculateRSI(closePrices) ?? undefined;
        marketSentimentParams.macd = calculateMACD(closePrices) ?? undefined;
        marketSentimentParams.bollingerBands = calculateBollingerBands(closePrices) ?? undefined;
        marketSentimentParams.ema = calculateEMA(closePrices) ?? undefined;
        marketSentimentParams.atr = calculateATR(highPrices, lowPrices, closePrices) ?? undefined;
      } else {
        console.warn("[DashboardPage] Not enough candle data for AI recommendation.");
      }
      
      const sentimentResult = await analyzeMarketSentiment(marketSentimentParams);
      if (sentimentResult) {
        setAiRecommendation({ action: sentimentResult.action, reasoning: sentimentResult.reasoning, confidence: sentimentResult.confidence });
        toast({ title: "AI Analysis Complete", description: `Recommendation for ${currentInstrument} received.` });
      } else {
        toast({ title: "AI Analysis Failed", description: "Could not retrieve AI recommendation.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "AI Analysis Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsFetchingManualRecommendation(false);
    }
  }, [currentInstrument, tradingMode, selectedAiStrategyId, authStatus, selectedDerivAccountType, userInfo?.derivApiToken?.access_token, toast, router]);

  const logAutomatedTradingEvent = (message: string) => {
    setAutomatedTradingLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const startAutomatedTradingSession = useCallback(async () => {
    if (authStatus === 'unauthenticated') {
      toast({ title: "Authentication Required", description: "Please log in to start AI auto-trading.", variant: "destructive" });
      router.push('/auth/login');
      return;
    }
    if (autoTradeTotalStake <= 0 || autoTradeTotalStake > currentBalance) {
      toast({ title: "Invalid Stake", description: `Total stake $${autoTradeTotalStake} must be positive and within balance $${currentBalance.toFixed(2)}.`, variant: "destructive" });
      return;
    }
    if (consecutiveAiCallCount >= 2 && lastAiCallTimestamp && (Date.now() - lastAiCallTimestamp) < AI_COOLDOWN_DURATION_MS) {
      const remainingMinutes = Math.ceil((AI_COOLDOWN_DURATION_MS - (Date.now() - lastAiCallTimestamp)) / 60000);
      toast({ title: "AI Cooldown", description: `Please wait ${remainingMinutes} min.`, variant: "default" });
      return;
    } else if (consecutiveAiCallCount >=2) {
      setConsecutiveAiCallCount(0);
    }

    setIsPreparingAutoTrades(true);
    setIsAutoTradingActive(true); // Mark that auto-trading process has started
    setActiveAutomatedTrades([]); // Clear any previous automated trades
    setAutomatedTradingLog([]); // Clear previous logs
    logAutomatedTradingEvent(`Initializing AI Auto-Trading with $${autoTradeTotalStake} in ${selectedDerivAccountType || 'paper'} mode using strategy ${selectedAiStrategyId}.`);

    const token = userInfo?.derivApiToken?.access_token;
    // Filter instruments that are currently open for trading or are 24/7 (like BTC/USD, ETH/USD)
    const instrumentsToTrade = FOREX_CRYPTO_COMMODITY_INSTRUMENTS.filter(inst => getMarketStatus(inst).isOpen || ['BTC/USD', 'ETH/USD'].includes(inst as string));
    if (instrumentsToTrade.length === 0) {
        logAutomatedTradingEvent("No markets open for auto-trading at this time.");
        toast({ title: "Markets Closed", description: "No suitable markets currently open for auto-trading.", variant: "default" });
        setIsAutoTradingActive(false); setIsPreparingAutoTrades(false); return;
    }

    // Fetch market data (candles and indicators) for all tradeable instruments.
    const instrumentTicksData: Record<ForexCryptoCommodityInstrumentType, PriceTick[]> = {} as any;
    const instrumentIndicatorsData: Record<ForexCryptoCommodityInstrumentType, InstrumentIndicatorData> = {} as any;

    for (const inst of instrumentsToTrade) {
      try {
        const candles = await getCandles(inst as InstrumentType, 60, 60, token); // Fetch last 60 candles (1-minute interval assumed for calculation)
         if (candles && candles.length > 0) {
          instrumentTicksData[inst] = candles.map(c => ({ epoch: c.epoch, price: c.close, time: c.time }));
          const closePrices = candles.map(c => c.close);
          const highPrices = candles.map(c => c.high);
          const lowPrices = candles.map(c => c.low);
          // Calculate indicators for the AI strategy input
          instrumentIndicatorsData[inst] = {
            rsi: calculateRSI(closePrices) ?? undefined,
            macd: calculateMACD(closePrices) ?? undefined,
            bollingerBands: calculateBollingerBands(closePrices) ?? undefined,
            ema: calculateEMA(closePrices) ?? undefined,
            atr: calculateATR(highPrices, lowPrices, closePrices) ?? undefined,
          };
        } else {
          instrumentTicksData[inst] = []; // Ensure empty array if no data
          instrumentIndicatorsData[inst] = {}; // Ensure empty object
          logAutomatedTradingEvent(`No candle data for ${inst}. It will be excluded from this AI session.`);
        }
      } catch (err) {
          instrumentTicksData[inst] = [];
          instrumentIndicatorsData[inst] = {};
          logAutomatedTradingEvent(`Error fetching data for ${inst}: ${(err as Error).message}. It will be excluded.`);
      }
    }

    // Prepare input for the AI strategy generation flow.
    const strategyInput: AutomatedTradingStrategyInput = {
      totalStake: autoTradeTotalStake,
      // Only include instruments for which data was successfully fetched
      instruments: instrumentsToTrade.filter(inst => instrumentTicksData[inst] && instrumentTicksData[inst].length > 0),
      tradingMode,
      aiStrategyId: selectedAiStrategyId,
      stopLossPercentage: selectedStopLossPercentage,
      instrumentTicks: instrumentTicksData,
      instrumentIndicators: instrumentIndicatorsData,
     };

    try {
      // Call the AI flow to generate a trading strategy based on the prepared input.
      const strategyResult = await generateAutomatedTradingStrategy(strategyInput);
      logAutomatedTradingEvent(`AI strategy received. Proposed trades: ${strategyResult.tradesToExecute.length}. Overall Reasoning: ${strategyResult.overallReasoning}`);

      // AI call cooldown logic: Increment count and update timestamp.
      setConsecutiveAiCallCount(prev => prev + 1);
      setLastAiCallTimestamp(Date.now());
      setIsPreparingAutoTrades(false); // AI processing (strategy generation) is complete.

      if (!strategyResult || strategyResult.tradesToExecute.length === 0) {
        logAutomatedTradingEvent(strategyResult?.overallReasoning || "AI determined no optimal trades at this moment.");
        toast({ title: "AI Auto-Trade", description: strategyResult?.overallReasoning || "No optimal trades found by AI.", duration: 7000 });
        setIsAutoTradingActive(false); // Stop session if no trades proposed.
        return;
      }
      toast({ title: "AI Strategy Generated", description: `AI proposes ${strategyResult.tradesToExecute.length} trades for ${selectedDerivAccountType || 'paper'} account. Simulating execution...`, duration: 5000});

      // Map AI proposed trades to local ActiveAutomatedTrade structure for simulation.
      // Note: Entry price is based on the latest available tick at generation time. Stop-loss is not fully implemented in this simulation.
      const simulatedTrades: ActiveAutomatedTrade[] = strategyResult.tradesToExecute.map(p => ({
        id: uuidv4(), // Unique ID for each simulated trade
        instrument: p.instrument as ForexCryptoCommodityInstrumentType,
        action: p.action,
        stake: p.stake,
        durationSeconds: p.durationSeconds,
        reasoning: p.reasoning,
        entryPrice: instrumentTicksData[p.instrument as ForexCryptoCommodityInstrumentType]?.slice(-1)[0]?.price || 0, // Last known price as entry
        stopLossPrice: 0, // Placeholder for simulated stop-loss price
        startTime: Date.now(),
        status: 'active', // Initial status
        currentPrice: instrumentTicksData[p.instrument as ForexCryptoCommodityInstrumentType]?.slice(-1)[0]?.price || 0, // Initial current price
        pnl: 0, // Initial P&L
      }));
      setActiveAutomatedTrades(simulatedTrades); // Start the simulation with these trades

    } catch (error) {
      logAutomatedTradingEvent(`Error during AI strategy generation or processing: ${(error as Error).message}`);
      toast({ title: "AI Auto-Trading Error", description: (error as Error).message, variant: "destructive" });
      setIsAutoTradingActive(false); // Ensure session stops on error.
      setIsPreparingAutoTrades(false); // Reset preparation state.
    }
  }, [authStatus, selectedDerivAccountType, autoTradeTotalStake, currentBalance, tradingMode, selectedAiStrategyId, userInfo, consecutiveAiCallCount, lastAiCallTimestamp, toast, router, selectedStopLossPercentage]);

  // Stops the active AI auto-trading session and clears any running trade simulation intervals.
  const handleStopAiAutoTrade = () => {
    setIsAutoTradingActive(false); // Set flag to stop trading activity
    // Clear all active intervals used for simulating trade expirations
    tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
    tradeIntervals.current.clear();
    const accountTypeForLogging = selectedDerivAccountType || 'paper';

    // Update status of any trades that were 'active' to 'closed_manual'
    // This is part of the local simulation; real trades would be handled differently.
    setActiveAutomatedTrades(prevTrades =>
      prevTrades.map(trade => {
        // Example: Logging to DB would happen here if these were real trades being closed.
        // For simulation, we just update local state.
        return trade.status === 'active'
          ? ({ ...trade, status: 'closed_manual', pnl: -(trade.stake), reasoning: (trade.reasoning || "") + " Manually stopped." })
          : trade;
      })
    );
    toast({ title: "AI Auto-Trading Stopped", description: `Session for ${accountTypeForLogging} account stopped manually.`});
  };
  
  // This useEffect hook manages the simulation of active automated trades.
  // It sets up intervals for each 'active' trade to simulate its duration and outcome.
  // IMPORTANT: This is a client-side simulation for demonstration. Real automated trading would involve
  // server-side monitoring of actual trades placed via an API.
  useEffect(() => {
    // If auto-trading is not active or no trades are listed, clear all intervals and do nothing.
    if (!isAutoTradingActive || activeAutomatedTrades.length === 0) {
      tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
      tradeIntervals.current.clear();
      return;
    }

    activeAutomatedTrades.forEach(trade => {
      // For each trade that is 'active' and doesn't already have a running interval:
      if (trade.status === 'active' && !tradeIntervals.current.has(trade.id)) {
        // Create a new interval to simulate this trade's lifecycle.
        const intervalId = setInterval(() => {
          setActiveAutomatedTrades(prevTrades => {
            return prevTrades.map(currentTrade => {
              if (currentTrade.id !== trade.id || currentTrade.status !== 'active') {
                return currentTrade; // Only process the specific, active trade for this interval.
              }

              let newStatus = currentTrade.status as ActiveAutomatedTrade['status'];
              let pnl = currentTrade.pnl ?? 0;

              // Simulate trade expiry based on its duration.
              if (Date.now() >= currentTrade.startTime + currentTrade.durationSeconds * 1000) {
                // Simulate a win/loss outcome. In a real scenario, this would be determined by comparing exit price to entry price.
                newStatus = Math.random() > 0.5 ? 'won' : 'lost_duration'; // 50/50 chance for simulation
                pnl = newStatus === 'won' ? currentTrade.stake * 0.85 : -currentTrade.stake; // Simulated P&L (85% profit for win)

                // Clean up the interval for this trade as it has concluded.
                clearInterval(tradeIntervals.current.get(trade.id)!);
                tradeIntervals.current.delete(trade.id);

                // Update overall profits and notify user.
                // setTimeout ensures this state update doesn't conflict with the ongoing map iteration.
                setTimeout(() => {
                  setProfitsClaimable(prevProfits => ({
                    totalNetProfit: prevProfits.totalNetProfit + pnl,
                    tradeCount: prevProfits.tradeCount + 1,
                    winningTrades: newStatus === 'won' ? prevProfits.winningTrades + 1 : prevProfits.winningTrades,
                    losingTrades: newStatus !== 'won' ? prevProfits.losingTrades + 1 : prevProfits.losingTrades,
                  }));
                  toast({
                    title: `Auto-Trade Ended (${selectedDerivAccountType || 'paper'}): ${currentTrade.instrument}`,
                    description: `Status: ${newStatus}, P/L: $${pnl.toFixed(2)} (Simulated)`,
                    variant: pnl > 0 ? "default" : "destructive"
                  });
                }, 0);
              }
              // Note: In this simulation, `currentPrice` is not updated dynamically within the interval.
              // A real implementation would fetch current prices to show live P&L and handle stop-loss/take-profit.
              return { ...currentTrade, status: newStatus, pnl };
            });
          });
        }, 2000 + Math.random() * 1000); // Simulate trade updates at random intervals (2-3 seconds).
        tradeIntervals.current.set(trade.id, intervalId); // Store interval ID for cleanup.
      }
    });

    // Cleanup function for this effect: Clear all intervals when the component unmounts
    // or when dependencies (like `activeAutomatedTrades` or `isAutoTradingActive`) change.
    return () => {
      tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
      tradeIntervals.current.clear();
    };
  }, [activeAutomatedTrades, isAutoTradingActive, selectedDerivAccountType, toast, profitsClaimable]);

  const handleAccountTypeSwitch = async (newTypeFromControl: 'paper' | 'live' | 'demo' | 'real' | null) => {
    const newApiType = (newTypeFromControl === 'paper' || newTypeFromControl === 'demo') ? 'demo' : 'real';
    if (!userInfo?.derivAccessToken) {
        toast({ title: "Deriv Account Not Linked", description: "Please connect your Deriv account via Profile page to switch modes.", variant: "destructive" });
        return;
    }
    if (newApiType === selectedDerivAccountType) return;
    try {
        await updateSelectedDerivAccountType(newApiType);
        toast({ title: "Account Switched", description: `Switched to ${newApiType} account. Balances reflected.`, variant: "default" });
    } catch (error) {
        toast({ title: "Switch Failed", description: `Failed to switch to ${newApiType} account. Error: ${(error as Error).message}`, variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto py-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BalanceDisplay
            balance={currentBalance}
            selectedAccountType={selectedDerivAccountType}
            displayAccountId={selectedDerivAccountType === 'demo' ? derivDemoAccountId : derivRealAccountId}
          />
          <TradingChart 
                instrument={currentInstrument}
                onInstrumentChange={handleInstrumentChange}
                instrumentsToShow={FOREX_CRYPTO_COMMODITY_INSTRUMENTS}
                isMarketOpen={isMarketOpenForSelected}
                marketStatusMessage={marketStatusMessage}
            />
          {isAutoTradingActive && activeAutomatedTrades.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Active AI Trades ({selectedDerivAccountType === 'real' ? 'Real' : 'Demo'})</CardTitle>
                <CardDescription>Monitoring automated trades by the AI for Forex/Crypto/Commodities. Stop-Loss is {selectedStopLossPercentage}% of entry.</CardDescription>
              </CardHeader>
              <CardContent>
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Stake</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Stop-Loss ({selectedStopLossPercentage}%)</TableHead>
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
              </CardContent>
            </Card>
          )}
           {isAutoTradingActive && activeAutomatedTrades.length === 0 && !isPreparingAutoTrades && (
             <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>AI Auto-Trading ({selectedDerivAccountType === 'real' ? 'Real' : 'Demo'})</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-4">AI analysis complete. No suitable Forex/Crypto/Commodity trades found.</p>
                </CardContent>
             </Card>
           )}
            {isPreparingAutoTrades && (
             <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>AI Auto-Trading ({selectedDerivAccountType === 'real' ? 'Real' : 'Demo'})</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-4">AI is analyzing Forex/Crypto/Commodity markets...</p>
                </CardContent>
             </Card>
           )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <TradeControls
            tradingMode={tradingMode}
            onTradingModeChange={setTradingMode}
            selectedAiStrategyId={selectedAiStrategyId}
            onAiStrategyChange={setSelectedAiStrategyId}
            tradeDuration={tradeDuration}
            onTradeDurationChange={setTradeDuration}
            accountType={selectedDerivAccountType}
            onAccountTypeChange={handleAccountTypeSwitch}
            stakeAmount={stakeAmount}
            onStakeAmountChange={setStakeAmount}
            onExecuteTrade={handleExecuteTrade}
            onGetAiRecommendation={fetchAndSetAiRecommendation}
            isFetchingManualRecommendation={isFetchingManualRecommendation} 
            isPreparingAutoTrades={isPreparingAutoTrades} 
            autoTradeTotalStake={autoTradeTotalStake}
            onAutoTradeTotalStakeChange={setAutoTradeTotalStake}
            onStartAiAutoTrade={startAutomatedTradingSession}
            onStopAiAutoTrade={handleStopAiAutoTrade}
            isAutoTradingActive={isAutoTradingActive} 
            disableManualControls={isAutoTradingActive || isFetchingManualRecommendation || isPreparingAutoTrades} 
            currentBalance={currentBalance}
            supportedInstrumentsForManualAi={FOREX_CRYPTO_COMMODITY_INSTRUMENTS}
            currentSelectedInstrument={currentInstrument}
            isMarketOpenForSelected={isMarketOpenForSelected}
            marketStatusMessage={marketStatusMessage}
            stopLossPercentage={selectedStopLossPercentage}
            onStopLossPercentageChange={setSelectedStopLossPercentage}
            stopLossValue={stopLossValue}
            onStopLossChange={setStopLossValue}
            takeProfitValue={takeProfitValue}
            onTakeProfitChange={setTakeProfitValue}
            availableDurations={availableDurations}
            isLoadingDurations={isLoadingDurations}
            isTradeable={isTradeable}
          />
          <AiRecommendationCard recommendation={aiRecommendation} isLoading={isFetchingManualRecommendation} />
        </div>
      </div>
    </div>
  );
}

if (typeof window !== 'undefined' && !(window as any).uuidv4) {
  (window as any).uuidv4 = uuidv4;
}
// Cache busting comment
