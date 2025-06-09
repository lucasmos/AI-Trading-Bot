'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { TradingChart } from '@/components/dashboard/trading-chart';
import { TradeControls } from '@/components/dashboard/trade-controls';
import { AiRecommendationCard } from '@/components/dashboard/ai-recommendation-card';
import type { TradingMode, TradeDuration, AiRecommendation, PaperTradingMode, ActiveAutomatedTrade, ProfitsClaimable, PriceTick, ForexCryptoCommodityInstrumentType, VolatilityInstrumentType, AuthStatus, MarketSentimentParams, InstrumentType } from '@/types';
import {
    getCandles,
    getTradeProposal,
    buyContract,
    instrumentToDerivSymbol,
    getContractUpdateInfo, // Import for trade monitoring
    type DerivProposalRequest,
    type DerivBuyRequest,
    type DerivOpenContractResponse // Import for trade monitoring
} from '@/services/deriv';
import { analyzeMarketSentiment, type AnalyzeMarketSentimentInput } from '@/ai/flows/analyze-market-sentiment';
import { explainAiReasoning } from '@/ai/flows/explain-ai-reasoning';
import { generateAutomatedTradingStrategy, AutomatedTradingStrategyInput } from '@/ai/flows/automated-trading-strategy-flow';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
// Removed duplicate getCandles import that was present in earlier versions
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

// Define OpenTrade interface locally
interface OpenTrade {
  contract_id: number;
  instrument: InstrumentType;
  action: 'CALL' | 'PUT';
  stake: number;
  entryPrice: number;
  purchaseTime: number; // Unix epoch (seconds)
  durationSeconds: number;
  loginidUsed: string;
  status: 'open'; // Will be updated by monitoring
  shortcode?: string;
  databaseId?: string; // Optional: to store DB id after logging
}

// Type guard to check if user is authenticated (remains from previous state)
function isAuthenticated(status: AuthStatus, mode: PaperTradingMode): boolean {
  return status === 'authenticated' || mode === 'paper';
}

// Helper function to validate trade parameters (remains from previous state)
function validateTradeParameters(stake: number, balance: number, mode: PaperTradingMode): string | null {
  if (stake > balance) {
    return `Insufficient ${mode === 'paper' ? 'Demo' : 'Real'} Balance: Stake $${stake.toFixed(2)} exceeds available balance.`;
  }
  if (stake <= 0) {
    return "Invalid Stake: Stake amount must be greater than zero.";
  }
  return null;
}

export default function DashboardPage() {
  const { 
    authStatus, 
    userInfo,
    paperBalance, 
    setPaperBalance,
    liveBalance, 
    setLiveBalance,
    selectedDerivAccountType,
    switchToDerivDemo,
    switchToDerivLive,
    currentAuthMethod,
  } = useAuth();
  
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType>(FOREX_CRYPTO_COMMODITY_INSTRUMENTS[0]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [selectedAiStrategyId, setSelectedAiStrategyId] = useState<string>(DEFAULT_AI_STRATEGY_ID);
  const [tradeDuration, setTradeDuration] = useState<TradeDuration>('5m');
  const [stakeAmount, setStakeAmount] = useState<number>(10);

  const paperTradingModeForControls: PaperTradingMode =
    (currentAuthMethod === 'deriv-credentials' && selectedDerivAccountType === 'live')
    ? 'live'
    : 'paper';

  const handleAccountTypeChangeFromControls = (newMode: PaperTradingMode) => {
    if (currentAuthMethod === 'deriv-credentials') {
      if (newMode === 'live') {
        switchToDerivLive();
      } else {
        switchToDerivDemo();
      }
    } else {
      console.warn(`[DashboardPage] Account type switch attempted for non-Deriv user to ${newMode}. No action taken in AuthContext.`);
    }
  };

  const [isMarketOpenForSelected, setIsMarketOpenForSelected] = useState<boolean>(true);
  const [marketStatusMessage, setMarketStatusMessage] = useState<string | null>(null);

  const [aiRecommendation, setAiRecommendation] = useState<AiRecommendation | null>(null);
  const [isFetchingManualRecommendation, setIsFetchingManualRecommendation] = useState(false);
  const [isPreparingAutoTrades, setIsPreparingAutoTrades] = useState(false);

  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [activeAutomatedTrades, setActiveAutomatedTrades] = useState<ActiveAutomatedTrade[]>([]); // Kept for existing auto-trade simulation
  const [automatedTradingLog, setAutomatedTradingLog] = useState<string[]>([]);
  const tradeIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const [profitsClaimable, setProfitsClaimable] = useState<ProfitsClaimable>({
    totalNetProfit: 0,
    tradeCount: 0,
    winningTrades: 0,
    losingTrades: 0,
  });

  const [selectedStopLossPercentage, setSelectedStopLossPercentage] = useState<number>(5);
  // currentPrice state can be removed if not used elsewhere, TradingChart might handle its own price display.
  // const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  const [isAiLoading, setIsAiLoading] = useState(false); // General AI loading state

  const [consecutiveAiCallCount, setConsecutiveAiCallCount] = useState(0);
  const [lastAiCallTimestamp, setLastAiCallTimestamp] = useState<number | null>(null);
  const AI_COOLDOWN_DURATION_MS = 2 * 60 * 1000;

  const currentBalanceToDisplay = useMemo(() => {
    if (currentAuthMethod === 'deriv-credentials') {
      return selectedDerivAccountType === 'live' ? liveBalance : paperBalance;
    }
    return paperTradingModeForControls === 'live' ? liveBalance : paperBalance;
  }, [currentAuthMethod, selectedDerivAccountType, liveBalance, paperBalance, paperTradingModeForControls]);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const profitsKey = `forexCryptoProfitsClaimable_${paperTradingModeForControls}`;
    const storedProfits = localStorage.getItem(profitsKey);
    if (storedProfits) {
      try {
        setProfitsClaimable(JSON.parse(storedProfits));
      } catch (error) {
        console.error("Error parsing profits from localStorage:", error);
        setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });
      }
    } else {
      setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });
    }
  }, [paperTradingModeForControls]);

  useEffect(() => {
    const profitsKey = `forexCryptoProfitsClaimable_${paperTradingModeForControls}`;
    localStorage.setItem(profitsKey, JSON.stringify(profitsClaimable));
  }, [profitsClaimable, paperTradingModeForControls]);

  useEffect(() => {
    const { isOpen, statusMessage } = getMarketStatus(currentInstrument);
    setIsMarketOpenForSelected(isOpen);
    setMarketStatusMessage(statusMessage);
  }, [currentInstrument]);

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

  const handleExecuteTrade = async (action: 'CALL' | 'PUT') => {
    if (authStatus === 'unauthenticated' || !userInfo?.id) {
      toast({ title: "Authentication Required", description: "Please log in to execute trades.", variant: "destructive" });
      if (authStatus === 'unauthenticated') router.push('/auth/login');
      return;
    }

    const { isOpen, statusMessage } = getMarketStatus(currentInstrument);
    if (!isOpen && (FOREX_CRYPTO_COMMODITY_INSTRUMENTS.includes(currentInstrument as ForexCryptoCommodityInstrumentType) && !['BTC/USD', 'ETH/USD'].includes(currentInstrument as string))) {
      toast({ title: "Market Closed", description: statusMessage, variant: "destructive" });
      return;
    }

    const validationError = validateTradeParameters(stakeAmount, currentBalanceToDisplay, paperTradingModeForControls);
    if (validationError) {
      toast({ title: validationError.split(':')[0], description: validationError.split(':')[1].trim(), variant: "destructive" });
      return;
    }

    if (currentAuthMethod !== 'deriv-credentials' || !(userInfo as any).derivAccessToken) {
      toast({ title: "Deriv Login Required", description: "Please log in with your Deriv account to place real trades.", variant: "destructive" });
      return;
    }

    const loginidToUse = selectedDerivAccountType === 'live'
      ? (userInfo as any).derivRealAccountId
      : (userInfo as any).derivDemoAccountId;

    if (!loginidToUse) {
      toast({ title: "Deriv Account Error", description: `Selected Deriv ${selectedDerivAccountType} account ID is not available.`, variant: "destructive" });
      return;
    }

    const durationMatch = tradeDuration.match(/^(\d+)([smhd])$/);
    if (!durationMatch) {
      toast({ title: "Invalid Duration", description: "Trade duration format is incorrect.", variant: "destructive" });
      return;
    }
    const durationValue = parseInt(durationMatch[1], 10);
    const durationUnit = durationMatch[2] as 's' | 'm' | 'h' | 'd';

    let durationSeconds = durationValue;
    if (durationUnit === 'm') durationSeconds *= 60;
    else if (durationUnit === 'h') durationSeconds *= 3600;
    else if (durationUnit === 'd') durationSeconds *= 86400;

    const derivSymbol = instrumentToDerivSymbol(currentInstrument);

    const proposalRequest: DerivProposalRequest = {
      proposal: 1,
      amount: stakeAmount,
      basis: 'stake',
      contract_type: action,
      currency: 'USD',
      symbol: derivSymbol,
      duration: durationValue,
      duration_unit: durationUnit,
      loginid: loginidToUse,
    };

    toast({ title: "Placing Trade...", description: `Requesting proposal for ${currentInstrument} ${action}.` });

    try {
      const proposalResponse = await getTradeProposal((userInfo as any).derivAccessToken, proposalRequest);

      if (proposalResponse.error || !proposalResponse.proposal) {
        console.error("Deriv Proposal Error:", proposalResponse.error);
        toast({ title: "Proposal Failed", description: proposalResponse.error?.message || "Could not get trade proposal from Deriv.", variant: "destructive" });
        return;
      }

      const { id: proposalId, ask_price: proposedPrice } = proposalResponse.proposal;
      
      const buyRequest: DerivBuyRequest = {
        buy: proposalId,
        price: proposedPrice,
        loginid: loginidToUse,
      };

      toast({ title: "Executing Trade...", description: `Buying contract for ${currentInstrument} ${action}.` });
      const buyResponse = await buyContract((userInfo as any).derivAccessToken, buyRequest);

      if (buyResponse.error || !buyResponse.buy) {
        console.error("Deriv Buy Error:", buyResponse.error);
        toast({ title: "Trade Execution Failed", description: buyResponse.error?.message || "Could not execute trade with Deriv.", variant: "destructive" });
        return;
      }

      const { contract_id, buy_price, purchase_time, shortcode } = buyResponse.buy;

      const newOpenTrade: OpenTrade = {
        contract_id,
        instrument: currentInstrument,
        action,
        stake: stakeAmount,
        entryPrice: buy_price,
        purchaseTime: purchase_time, // This is Unix epoch
        durationSeconds,
        loginidUsed: loginidToUse,
        status: 'open',
        shortcode,
      };
      setOpenTrades(prevOpenTrades => [...prevOpenTrades, newOpenTrade]);

      if (paperTradingModeForControls === 'live') {
        setLiveBalance(prev => parseFloat((prev - stakeAmount).toFixed(2)));
      } else {
        setPaperBalance(prev => parseFloat((prev - stakeAmount).toFixed(2)));
      }

      toast({ title: "Trade Placed Successfully!", description: `Contract ID: ${contract_id}. ${shortcode}`, variant: "default" });

      // Log the trade to the application's database
      const tradeLogPayload = {
        userId: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        symbol: newOpenTrade.instrument,
        type: newOpenTrade.action === 'CALL' ? 'buy' : 'sell',
        amount: newOpenTrade.stake,
        price: newOpenTrade.entryPrice,
        derivContractId: newOpenTrade.contract_id.toString(),
        status: 'open',
        purchaseTime: new Date(newOpenTrade.purchaseTime * 1000).toISOString(), // Convert Unix to ISO
        durationSeconds: newOpenTrade.durationSeconds,
        loginidUsed: newOpenTrade.loginidUsed,
        metadata: {
          mode: tradingMode,
          accountType: paperTradingModeForControls,
          automated: false,
          shortcode: newOpenTrade.shortcode,
        }
      };

      try {
        const logResponse = await fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tradeLogPayload),
        });

        if (logResponse.ok) {
          const loggedTrade = await logResponse.json();
          console.log('[DashboardPage] Deriv trade logged to DB:', loggedTrade);
          setOpenTrades(prev => prev.map(ot =>
            ot.contract_id === newOpenTrade.contract_id
              ? { ...ot, databaseId: loggedTrade.id }
              : ot
          ));
        } else {
          console.error('[DashboardPage] Failed to log Deriv trade to DB:', await logResponse.text());
          toast({
            title: 'DB Logging Error',
            description: 'Trade placed with Deriv, but failed to log to application database.',
            variant: 'destructive',
          });
        }
      } catch (dbError) {
        console.error('[DashboardPage] Error logging Deriv trade to DB:', dbError);
        toast({
          title: 'DB Logging Error',
          description: `Trade placed with Deriv, but encountered an error logging to application database: ${(dbError as Error).message}`,
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('[DashboardPage] Deriv API Trade execution error:', error);
      toast({
        title: "Deriv API Error",
        description: error instanceof Error ? error.message : "Failed to execute trade with Deriv. Please try again.",
        variant: "destructive"
      });
    }
  };

  const fetchAndSetAiRecommendation = useCallback(async () => {
    // ... (existing logic, no changes needed here based on prompt)
    if (authStatus === 'unauthenticated') {
      toast({
        title: "Authentication Required",
        description: "Please log in to get AI recommendations.",
        variant: "destructive"
      });
      router.push('/auth/login');
      setAiRecommendation(null);
      setIsFetchingManualRecommendation(false);
      return;
    }
    if (!FOREX_CRYPTO_COMMODITY_INSTRUMENTS.includes(currentInstrument as ForexCryptoCommodityInstrumentType)){
      toast({title: "AI Support Note", description: `AI recommendations for ${currentInstrument} are available on its specific trading page (e.g., Volatility Trading).`, variant: "default"});
      setAiRecommendation(null);
      return;
    }
    setIsFetchingManualRecommendation(true);
    setAiRecommendation(null); 
    console.log(`[DashboardPage] Fetching AI recommendation for ${currentInstrument}, mode: ${tradingMode}`);
    try {
      const marketSentimentParams: MarketSentimentParams = {
        symbol: currentInstrument as string, 
        tradingMode: tradingMode,
        aiStrategyId: selectedAiStrategyId,
      };
      const currentCandles = await getCandles(currentInstrument, 60);
      const closePrices = currentCandles.map(candle => candle.close);
      const highPrices = currentCandles.map(candle => candle.high);
      const lowPrices = currentCandles.map(candle => candle.low);
      let rsiValue: number | undefined = undefined; 
      let calculatedMacdFull: { macd: number; signal: number; histogram: number } | undefined = undefined;
      let calculatedBBFull: { upper: number; middle: number; lower: number } | undefined = undefined;
      let emaValue: number | undefined = undefined;
      let atrValue: number | undefined = undefined;
      if (closePrices.length > 0) { 
        const rsiCalc = calculateRSI(closePrices);
        if (rsiCalc !== undefined) rsiValue = rsiCalc;
        const macdCalc = calculateMACD(closePrices);
        if (macdCalc) calculatedMacdFull = macdCalc;
        const bbCalc = calculateBollingerBands(closePrices);
        if (bbCalc) calculatedBBFull = bbCalc;
        const emaCalc = calculateEMA(closePrices);
        if (emaCalc !== undefined) emaValue = emaCalc;
        const atrCalc = calculateATR(highPrices, lowPrices, closePrices);
        if (atrCalc !== undefined) atrValue = atrCalc;
      } else {
        console.warn("[DashboardPage] Not enough close prices to calculate indicators for AI recommendation.");
      }
      if (rsiValue !== undefined) marketSentimentParams.rsi = rsiValue;
      if (calculatedMacdFull) marketSentimentParams.macd = calculatedMacdFull;
      if (calculatedBBFull) marketSentimentParams.bollingerBands = calculatedBBFull;
      if (emaValue !== undefined) marketSentimentParams.ema = emaValue;
      if (atrValue !== undefined) marketSentimentParams.atr = atrValue;
      console.log("[DashboardPage] Market sentiment params for AI:", marketSentimentParams);
      const sentimentResult = await analyzeMarketSentiment(marketSentimentParams);
      setIsFetchingManualRecommendation(false);
      if (sentimentResult) {
        setAiRecommendation({
          action: sentimentResult.action,
          reasoning: sentimentResult.reasoning,
          confidence: sentimentResult.confidence,
        });
      } else {
        console.error("Error getting AI recommendation:", sentimentResult);
        toast({
          title: "AI Analysis Failed",
          description: "Could not retrieve AI recommendation. Please try again.",
          variant: "destructive",
        });
        setAiRecommendation(null);
      }
      toast({
        title: "AI Analysis Complete",
        description: `Recommendation for ${currentInstrument} received.`,
      });
    } catch (error) {
      console.error("Error getting AI recommendation:", error);
      toast({
        title: "AI Analysis Failed",
        description: "Could not retrieve AI recommendation. Please try again.",
        variant: "destructive",
      });
      setAiRecommendation(null);
    }
  }, [currentInstrument, tradingMode, toast, authStatus, paperTradingModeForControls, selectedAiStrategyId, router]);

  const logAutomatedTradingEvent = (message: string) => {
    console.log(`[AutoTrade] ${message}`);
    setAutomatedTradingLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const startAutomatedTradingSession = useCallback(async () => {
    // ... (existing logic, no changes needed here based on prompt)
    if (authStatus === 'unauthenticated') {
      toast({
        title: "Authentication Required",
        description: "Please log in to start AI auto-trading.",
        variant: "destructive"
      });
      router.push('/auth/login');
      return;
    }
    if (autoTradeTotalStake <= 0) {
      toast({ title: "Set Stake", description: "Please set a total stake for auto-trading.", variant: "default" });
      return;
    }
    if (autoTradeTotalStake > currentBalanceToDisplay) {
      toast({ title: "Insufficient Balance", description: "Auto-trade total stake exceeds available balance.", variant: "destructive" });
      return;
    }
    if (consecutiveAiCallCount >= 2) {
      if (lastAiCallTimestamp && (Date.now() - lastAiCallTimestamp) < AI_COOLDOWN_DURATION_MS) {
        const remainingTimeSeconds = Math.ceil((AI_COOLDOWN_DURATION_MS - (Date.now() - lastAiCallTimestamp)) / 1000);
        const remainingMinutes = Math.ceil(remainingTimeSeconds / 60);
        toast({ title: "AI Cooldown", description: `AI is cooling down. Please wait ${remainingMinutes} minutes before starting a new auto-trade session.`, variant: "default" });
        return;
      } else {
        setConsecutiveAiCallCount(0);
      }
    }
    setIsPreparingAutoTrades(true);
    setIsAutoTradingActive(true);
    setActiveAutomatedTrades([]);
    setAutomatedTradingLog([]);
    logAutomatedTradingEvent(`Initializing AI Auto-Trading session with $${autoTradeTotalStake} in ${paperTradingModeForControls} mode using strategy ${selectedAiStrategyId}.`);
    try {
      const allPossibleInstruments = SUPPORTED_INSTRUMENTS
        .filter((inst: { type: string; id: InstrumentType }) => inst.type === 'Forex' || inst.type === 'Crypto' || inst.type === 'Commodity') 
        .map((inst: { type: string; id: InstrumentType }) => inst.id as ForexCryptoCommodityInstrumentType); 
      const instrumentsToTrade: ForexCryptoCommodityInstrumentType[] = [];
      const instrumentsToSkip: string[] = [];
      for (const inst of allPossibleInstruments) {
        const { isOpen, statusMessage } = getMarketStatus(inst);
        if (isOpen || ['BTC/USD', 'ETH/USD'].includes(inst as string)) { 
            instrumentsToTrade.push(inst);
        } else {
            toast({ title: `Market Closed: ${inst}`, description: statusMessage, variant: "default", duration: 4000});
            instrumentsToSkip.push(inst);
        }
      }
      if (instrumentsToTrade.length === 0) {
        const msg = "No Forex/Crypto/Commodity instruments available for auto-trading (all relevant markets might be closed). Session not started.";
        logAutomatedTradingEvent(msg);
        toast({ title: "Auto-Trading Halted", description: msg, variant: "destructive", duration: 7000 });
        setIsPreparingAutoTrades(false);
        setIsAutoTradingActive(false);
        return;
      }
      if (instrumentsToSkip.length > 0) {
        logAutomatedTradingEvent(`Skipped instruments due to market closure: ${instrumentsToSkip.join(', ')}`);
      }
      logAutomatedTradingEvent(`Fetching data for open market instruments: ${instrumentsToTrade.join(', ')}`);
      const instrumentTicksData: Record<ForexCryptoCommodityInstrumentType, PriceTick[]> = {} as Record<ForexCryptoCommodityInstrumentType, PriceTick[]>;
      const instrumentIndicatorsData: Record<ForexCryptoCommodityInstrumentType, any> = {} as Record<ForexCryptoCommodityInstrumentType, any>; 
      for (const inst of instrumentsToTrade) {
        try {
          const candles = await getCandles(inst as InstrumentType, 60); 
          if (candles && candles.length > 0) {
            instrumentTicksData[inst] = candles.map(candle => ({
              epoch: candle.epoch,
              price: candle.close,
              time: candle.time,
            }));
            const closePrices = candles.map(c => c.close);
            const highPrices = candles.map(c => c.high);
            const lowPrices = candles.map(c => c.low);
            const rsi = calculateRSI(closePrices);
            const macd = calculateMACD(closePrices);
            const bb = calculateBollingerBands(closePrices);
            const ema = calculateEMA(closePrices);
            const atr = calculateATR(highPrices, lowPrices, closePrices);
            instrumentIndicatorsData[inst] = {
              ...(rsi !== undefined && { rsi }),
              ...(macd && { macd }),
              ...(bb && { bollingerBands: bb }),
              ...(ema !== undefined && { ema }),
              ...(atr !== undefined && { atr }),
            };
            logAutomatedTradingEvent(`Successfully fetched and processed indicators for ${inst}.`);
          } else {
            instrumentTicksData[inst] = [];
            instrumentIndicatorsData[inst] = {};
            const msg = `No candle data for ${inst}. It will be excluded from this AI session.`;
            logAutomatedTradingEvent(msg);
            toast({ title: `Data Error: ${inst}`, description: msg, variant: "destructive", duration: 4000 });
          }
        } catch (err) {
          instrumentTicksData[inst] = [];
          instrumentIndicatorsData[inst] = {};
          const errorMsg = `Error fetching data for ${inst}: ${(err as Error).message}. It will be excluded.`;
          logAutomatedTradingEvent(errorMsg);
          toast({ title: `Data Error: ${inst}`, description: errorMsg, variant: "destructive", duration: 4000 });
        }
      }
      const strategyInput: AutomatedTradingStrategyInput = {
        totalStake: autoTradeTotalStake,
        instruments: instrumentsToTrade,
        tradingMode,
        aiStrategyId: selectedAiStrategyId,
        stopLossPercentage: selectedStopLossPercentage,
        instrumentTicks: instrumentTicksData,
        instrumentIndicators: instrumentIndicatorsData,
      };
      logAutomatedTradingEvent("Requesting AI trading strategy from the flow...");
      const strategyResult = await generateAutomatedTradingStrategy(strategyInput);
      logAutomatedTradingEvent(`AI strategy received. Proposed trades: ${strategyResult.tradesToExecute.length}. Reasoning: ${strategyResult.overallReasoning}`);
      if (!strategyResult || strategyResult.tradesToExecute.length === 0) {
        const reason = strategyResult?.overallReasoning || "AI determined no optimal trades at this moment for Forex/Crypto/Commodities.";
        toast({ title: "AI Auto-Trade Update (F/C/C)", description: `AI analysis complete. ${reason}`, duration: 7000 });
      } else {
        toast({ 
          title: "AI Strategy Initiated (F/C/C)", 
          description: `AI proposes ${strategyResult.tradesToExecute.length} trade(s) for ${paperTradingModeForControls} account. ${strategyResult.overallReasoning || 'Executing strategy.'}`,
          duration: 7000 
        });
      }
      setConsecutiveAiCallCount(prev => prev + 1);
      setLastAiCallTimestamp(Date.now());
      setIsPreparingAutoTrades(false);
      if (!strategyResult || strategyResult.tradesToExecute.length === 0) {
        logAutomatedTradingEvent(strategyResult?.overallReasoning || "AI determined no optimal trades at this moment.");
        return;
      }
      const newTrades: ActiveAutomatedTrade[] = [];
      let currentAllocatedStake = 0;
      for (const proposal of strategyResult.tradesToExecute) {
        if (currentAllocatedStake + proposal.stake > autoTradeTotalStake) continue;
        currentAllocatedStake += proposal.stake;
        const currentTicks = instrumentTicksData[proposal.instrument as ForexCryptoCommodityInstrumentType];
        if (!currentTicks || currentTicks.length === 0) {
          logAutomatedTradingEvent(`No current price data for ${proposal.instrument} to initiate AI trade.`);
          continue;
        }
        const entryPrice = currentTicks[currentTicks.length - 1].price;
        let stopLossPriceValue; 
        const stopLossPercent = selectedStopLossPercentage / 100; 
        if (proposal.action === 'CALL') stopLossPriceValue = entryPrice * (1 - stopLossPercent);
        else stopLossPriceValue = entryPrice * (1 + stopLossPercent);
        stopLossPriceValue = parseFloat(stopLossPriceValue.toFixed(getInstrumentDecimalPlaces(proposal.instrument as InstrumentType))); 
        const tradeId = uuidv4();
        newTrades.push({
          id: tradeId,
          instrument: proposal.instrument as ForexCryptoCommodityInstrumentType,
          action: proposal.action,
          stake: proposal.stake,
          durationSeconds: proposal.durationSeconds,
          reasoning: proposal.reasoning,
          entryPrice,
          stopLossPrice: stopLossPriceValue, 
          startTime: Date.now(),
          status: 'active',
          currentPrice: entryPrice,
          pnl: 0,
        });
      }
      if (newTrades.length === 0) {
        logAutomatedTradingEvent("No valid trades could be initiated based on AI proposals and current data.");
        if (strategyResult && strategyResult.tradesToExecute.length > 0) {
            toast({ title: "AI Auto-Trade Update (F/C/C)", description: "No valid Forex/Crypto/Commodity trades could be initiated based on AI proposals and current data.", duration: 7000 });
        }
      } else {
        logAutomatedTradingEvent(`Initiating ${newTrades.length} automated trade(s).`);
      }
      setActiveAutomatedTrades(newTrades);
    } catch (error) {
      logAutomatedTradingEvent(`Error during AI auto-trading session: ${(error as Error).message}`);
      console.error("AI Auto-Trading Error:", error);
      toast({ title: "AI Auto-Trading Error", description: (error as Error).message, variant: "destructive" });
      setIsAutoTradingActive(false);
    }
  }, [authStatus, paperTradingModeForControls, autoTradeTotalStake, currentBalanceToDisplay, tradingMode, toast, logAutomatedTradingEvent, selectedAiStrategyId, selectedStopLossPercentage, userInfo, router]);

  const handleStopAiAutoTrade = () => {
    // ... (existing logic, no changes needed here based on prompt)
    setIsAutoTradingActive(false); 
    tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
    tradeIntervals.current.clear();
    setActiveAutomatedTrades(prevTrades => 
      prevTrades.map(trade => {
        if (trade.status === 'active') {
          const pnl = -trade.stake;
          if (userInfo?.id) {
            console.log('[Dashboard] Storing manually stopped automated trade in database for user:', userInfo.id);
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
                  accountType: paperTradingModeForControls,
                  automated: true,
                  manualStop: true
                }
              })
            })
            .then(response => {
              if (!response.ok) {
                console.error(`[Dashboard] Error creating manual stop trade: ${response.status} ${response.statusText}`);
                return response.json().then(err => Promise.reject(new Error(err.message || `Error ${response.status}`)));
              }
              return response.json();
            })
            .then((createdTrade: any) => {
              if (!createdTrade || !createdTrade.id) {
                console.warn('[Dashboard] Manual stop trade not created or ID missing.');
                throw new Error('Manual stop trade creation failed or returned invalid data.');
              }
              console.log('[Dashboard] Manual stop trade created successfully:', createdTrade.id);
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
              })
            .then(closeResponse => {
              if (!closeResponse) {
                console.warn('[Dashboard] No close response received, possibly due to an issue before the close operation.');
                return Promise.resolve(undefined);
              }
              if (!closeResponse.ok) {
                console.error(`[Dashboard] Error closing manual stop trade: ${closeResponse.status} ${closeResponse.statusText}`);
                return closeResponse.json().then(err => Promise.reject(new Error(err.message || `Error ${closeResponse.status}`)));
                }
              return closeResponse.json();
              })
              .then((closedTrade: any) => {
                if (closedTrade) {
                  console.log('[Dashboard] Manual stop trade closed successfully:', closedTrade.id);
                }
              })
              .catch(error => {
              console.error("[Dashboard] Error in manual stop trade database operation:", error);
              toast({
                title: "Database Error",
                description: "Could not save the manually stopped trade to the database. " + (error instanceof Error ? error.message : "Unknown error"),
                variant: "destructive"
              });
            });
          }
          setTimeout(() => {
            if (paperTradingModeForControls === 'live') {
              setLiveBalance(prevBal => parseFloat((prevBal + pnl).toFixed(2)));
            } else {
              setPaperBalance(prevBal => parseFloat((prevBal + pnl).toFixed(2)));
            }
            setProfitsClaimable(prevProfits => ({
              totalNetProfit: prevProfits.totalNetProfit + pnl,
              tradeCount: prevProfits.tradeCount + 1,
              winningTrades: prevProfits.winningTrades, 
              losingTrades: prevProfits.losingTrades + 1, 
            }));
            toast({
              title: `Auto-Trade Ended (${paperTradingModeForControls}): ${trade.instrument}`,
              description: `Status: closed_manual, P/L: $${pnl.toFixed(2)}`,
              variant: pnl > 0 ? "default" : "destructive"
            });
          }, 0);
          const updatedTrade: ActiveAutomatedTrade = {
            ...trade,
            status: 'closed_manual' as ActiveAutomatedTrade['status'],
            pnl,
            reasoning: (trade.reasoning || "") + " Manually stopped."
          };
          return updatedTrade;
        }
        return trade;
      })
    );
    toast({ title: "AI Auto-Trading Stopped", description: `Automated Forex/Crypto/Commodity trading session for ${paperTradingModeForControls} account has been manually stopped.`});
  };
  
  useEffect(() => {
    // ... (existing logic for automated trade simulation, no changes needed here based on prompt)
    if (isAutoTradingActive && activeAutomatedTrades.every(t => t.status !== 'active') && !isPreparingAutoTrades) {
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
            let allTradesConcludedThisTick = true;
            const updatedTrades = prevTrades.map(currentTrade => {
              if (currentTrade.id !== trade.id || currentTrade.status !== 'active') {
                if(currentTrade.status === 'active') allTradesConcludedThisTick = false;
                return currentTrade;
              }
              let newStatus: any = currentTrade.status;
              let pnl = currentTrade.pnl ?? 0;
              let newCurrentPrice = currentTrade.currentPrice ?? currentTrade.entryPrice;
              const decimalPlaces = getInstrumentDecimalPlaces(currentTrade.instrument);
              const priceChangeFactor = (Math.random() - 0.5) * (decimalPlaces <= 2 ? 0.01 : 0.00010); 
              newCurrentPrice += priceChangeFactor;
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
                  console.log('[Dashboard] Storing automated trade in database for user:', userInfo.id);
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
                    accountType: paperTradingModeForControls,
                        automated: true
                      }
                    }),
                  })
                  .then(response => {
                    if (!response.ok) {
                      console.error(`[Dashboard] Error creating automated trade: ${response.status} ${response.statusText}`);
                      return null;
                    }
                    return response.json();
                  })
                  .then((createdTrade: any) => {
                    if (!createdTrade) return;
                    console.log('[Dashboard] Automated trade created successfully:', createdTrade.id);
                    fetch(`/api/trades/${createdTrade.id}/close`, {
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
                    })
                    .then(response => {
                      if (!response.ok) {
                        console.error(`[Dashboard] Error closing automated trade: ${response.status} ${response.statusText}`);
                        return null;
                      }
                      return response.json();
                    })
                    .then((closedTrade: any) => {
                      if (closedTrade) {
                        console.log('[Dashboard] Automated trade closed successfully:', closedTrade.id);
                      }
                    })
                    .catch(error => console.error("[Dashboard] Error closing automated trade in database:", error));
                  })
                  .catch(error => {
                    console.error("[Dashboard] Error creating automated trade in database:", error);
                  });
                }
                setTimeout(() => { 
                  if (paperTradingModeForControls === 'live') {
                    setLiveBalance(prevBal => parseFloat((prevBal + pnl).toFixed(2)));
                  } else {
                    setPaperBalance(prevBal => parseFloat((prevBal + pnl).toFixed(2)));
                  }
                  setProfitsClaimable(prevProfits => ({
                    totalNetProfit: prevProfits.totalNetProfit + pnl,
                    tradeCount: prevProfits.tradeCount + 1,
                    winningTrades: newStatus === 'won' ? prevProfits.winningTrades + 1 : prevProfits.winningTrades,
                    losingTrades: (newStatus === 'lost_duration' || newStatus === 'lost_stoploss') ? prevProfits.losingTrades + 1 : prevProfits.losingTrades,
                  }));
                  toast({
                    title: `Auto-Trade Ended (${paperTradingModeForControls}): ${currentTrade.instrument}`,
                    description: `Status: ${newStatus}, P/L: $${pnl.toFixed(2)}`,
                    variant: pnl > 0 ? "default" : "destructive"
                  });
                }, 0);
              } else {
                allTradesConcludedThisTick = false; 
              }
              return { ...currentTrade, status: newStatus, pnl, currentPrice: newCurrentPrice };
            });
            const allTradesNowConcluded = updatedTrades.every(t => t.status !== 'active');
            if (allTradesNowConcluded && isAutoTradingActive) { 
                 setTimeout(() => { 
                    setIsAutoTradingActive(false); 
                    toast({ title: "AI Auto-Trading Session Complete", description: `All Forex/Crypto/Commodity trades for ${paperTradingModeForControls} account concluded.`});
                }, 100); 
            }
            return updatedTrades;
          });
        }, 2000); 
        tradeIntervals.current.set(trade.id, intervalId);
      }
    });
    return () => {
      tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
      tradeIntervals.current.clear();
    };
  }, [activeAutomatedTrades, isAutoTradingActive, paperTradingModeForControls, toast, isPreparingAutoTrades, userInfo, tradingMode, selectedAiStrategyId, setPaperBalance, setLiveBalance]);

  useEffect(() => {
    if (!userInfo || !(userInfo as any).derivAccessToken || openTrades.length === 0) {
      return;
    }

    const checkOpenTrades = async () => {
      const tradesToCheck = openTrades.filter(trade => trade.status === 'open');
      if (tradesToCheck.length === 0) return;

      console.log(`[TradeMonitor] Checking ${tradesToCheck.length} open trade(s).`);

      for (const trade of tradesToCheck) {
        const expectedEndTime = trade.purchaseTime * 1000 + (trade.durationSeconds * 1000); // purchaseTime is in seconds
        const bufferTime = 5000;

        if (Date.now() > expectedEndTime + bufferTime) {
          console.log(`[TradeMonitor] Contract ${trade.contract_id} exceeded duration. Fetching outcome...`);
          try {
            const response = await getContractUpdateInfo((userInfo as any).derivAccessToken, trade.contract_id);

            if (response.error || !response.proposal_open_contract) {
              toast({
                title: 'Contract Update Error',
                description: `Failed to get update for contract ${trade.contract_id}: ${response.error?.message || 'No contract data returned.'}`,
                variant: 'destructive',
              });
              continue;
            }

            const contractDetails = response.proposal_open_contract;
            console.log(`[TradeMonitor] Outcome for ${trade.contract_id}:`, contractDetails);

            if (contractDetails.status && ['sold', 'won', 'lost'].includes(contractDetails.status)) {
              const actualNetProfit = contractDetails.profit || 0;
              const exitPriceFromDeriv = contractDetails.sell_price;
              const sellTimeFromDeriv = contractDetails.sell_time;

              const settlementPayload = {
                derivContractId: trade.contract_id,
                finalStatus: contractDetails.status,
                pnl: actualNetProfit,
                exitPrice: exitPriceFromDeriv,
                sellTime: sellTimeFromDeriv ? new Date(sellTimeFromDeriv * 1000).toISOString() : new Date().toISOString(),
              };

              let dbSettledSuccessfully = false;
              try {
                const settleResponse = await fetch('/api/trades/settle-deriv-trade', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(settlementPayload),
                });

                if (settleResponse.ok) {
                  const settledTrade = await settleResponse.json();
                  console.log(`[TradeMonitor] Trade ${trade.contract_id} successfully settled in DB:`, settledTrade.id);
                  dbSettledSuccessfully = true;
                } else {
                  const errorText = await settleResponse.text();
                  console.error(`[TradeMonitor] Failed to settle trade ${trade.contract_id} in DB:`, errorText);
                  toast({
                    title: 'DB Record Error',
                    description: `Trade ${contractDetails.status}, P/L $${actualNetProfit.toFixed(2)}. Failed to update application database.`,
                    variant: 'destructive',
                    duration: 7000,
                  });
                }
              } catch (dbSettleError) {
                console.error(`[TradeMonitor] Error calling settlement API for ${trade.contract_id}:`, dbSettleError);
                toast({
                  title: 'DB Connection Error',
                  description: `Trade ${contractDetails.status}, P/L $${actualNetProfit.toFixed(2)}. Could not update application database. ${(dbSettleError as Error).message}`,
                  variant: 'destructive',
                  duration: 7000,
                });
              }

              const targetAccountType = trade.loginidUsed === (userInfo as any).derivRealAccountId ? 'live' : 'paper';

              console.log(`[TradeMonitor] Contract ${trade.contract_id} (${targetAccountType}) ${contractDetails.status}. P/L: ${actualNetProfit}. DB Settle: ${dbSettledSuccessfully}`);

              if (targetAccountType === 'live') {
                setLiveBalance(prev => parseFloat((prev + actualNetProfit).toFixed(2)));
              } else {
                setPaperBalance(prev => parseFloat((prev + actualNetProfit).toFixed(2)));
              }

              setProfitsClaimable(prevProfits => ({
                totalNetProfit: parseFloat((prevProfits.totalNetProfit + actualNetProfit).toFixed(2)),
                tradeCount: prevProfits.tradeCount + 1,
                winningTrades: contractDetails.status === 'won' ? prevProfits.winningTrades + 1 : prevProfits.winningTrades,
                losingTrades: contractDetails.status === 'lost' ? prevProfits.losingTrades + 1 : prevProfits.losingTrades,
              }));

              toast({
                title: `Trade ${contractDetails.status.toUpperCase()}`,
                description: `${trade.instrument} P/L: $${actualNetProfit.toFixed(2)} (Deriv ID: ${trade.contract_id})`,
                variant: actualNetProfit >= 0 ? 'default' : 'destructive',
              });

              setOpenTrades(prevOpen => prevOpen.filter(t => t.contract_id !== trade.contract_id));
            } else {
              console.log(`[TradeMonitor] Contract ${trade.contract_id} status is '${contractDetails.status}'. Will re-check if still open.`);
            }
          } catch (err) {
            console.error(`[TradeMonitor] Error fetching contract update for ${trade.contract_id}:`, err);
            toast({
              title: 'Contract Update Error',
              description: `Could not fetch status for contract ${trade.contract_id}. ${(err as Error).message}`,
              variant: 'destructive',
            });
          }
        }
      }
    };

    if (openTrades.some(t => t.status === 'open')) {
       const timerId = setTimeout(checkOpenTrades, 10000);
       return () => clearTimeout(timerId);
    }

  }, [openTrades, userInfo, setPaperBalance, setLiveBalance, toast, profitsClaimable]);

  return (
    <div className="container mx-auto py-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BalanceDisplay balance={currentBalanceToDisplay} accountType={paperTradingModeForControls} />
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
                <CardTitle>Active AI Trades ({paperTradingModeForControls === 'live' ? 'Real - Simulated' : 'Demo'})</CardTitle> {/* Updated */}
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
                          {/* @ts-ignore */}
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
                           {/* @ts-ignore */}
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
                    <CardTitle>AI Auto-Trading ({paperTradingModeForControls === 'live' ? 'Real - Simulated' : 'Demo'})</CardTitle> {/* Updated */}
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-4">AI analysis complete. No suitable Forex/Crypto/Commodity trades found at this moment.</p>
                </CardContent>
             </Card>
           )}
            {isPreparingAutoTrades && (
             <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>AI Auto-Trading ({paperTradingModeForControls === 'live' ? 'Real - Simulated' : 'Demo'})</CardTitle> {/* Updated */}
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-4">AI is analyzing Forex/Crypto/Commodity markets and preparing trades...</p>
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
            paperTradingMode={paperTradingModeForControls} // Updated
            onPaperTradingModeChange={handleAccountTypeChangeFromControls} // Updated
            stakeAmount={stakeAmount}
            onStakeAmountChange={setStakeAmount}
            onExecuteTrade={handleExecuteTrade} // Note: handleExecuteTrade internal balance logic needs future refactor
            onGetAiRecommendation={fetchAndSetAiRecommendation}
            isFetchingManualRecommendation={isFetchingManualRecommendation} 
            isPreparingAutoTrades={isPreparingAutoTrades} 
            autoTradeTotalStake={autoTradeTotalStake}
            onAutoTradeTotalStakeChange={setAutoTradeTotalStake}
            onStartAiAutoTrade={startAutomatedTradingSession}
            onStopAiAutoTrade={handleStopAiAutoTrade}
            isAutoTradingActive={isAutoTradingActive} 
            disableManualControls={isAutoTradingActive || isFetchingManualRecommendation || isPreparingAutoTrades} 
            currentBalance={currentBalanceToDisplay} // Updated
            supportedInstrumentsForManualAi={FOREX_CRYPTO_COMMODITY_INSTRUMENTS}
            currentSelectedInstrument={currentInstrument}
            isMarketOpenForSelected={isMarketOpenForSelected}
            marketStatusMessage={marketStatusMessage}
            stopLossPercentage={selectedStopLossPercentage}
            onStopLossPercentageChange={setSelectedStopLossPercentage}
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

[end of src/app/page.tsx]
