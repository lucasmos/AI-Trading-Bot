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
    getContractUpdateInfo,
    type DerivProposalRequest,
    type DerivBuyRequest,
    type DerivOpenContractResponse
} from '@/services/deriv';
import { analyzeMarketSentiment, type AnalyzeMarketSentimentInput } from '@/ai/flows/analyze-market-sentiment';
import { explainAiReasoning } from '@/ai/flows/explain-ai-reasoning';
import { generateAutomatedTradingStrategy, AutomatedTradingStrategyInput } from '@/ai/flows/automated-trading-strategy-flow';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// Table related imports are used by TradeHistoryTable and OpenTradesTable, so keep if they are not self-contained.
// For this subtask, we assume they import their own UI table components if needed.
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid'; 
import { getInstrumentDecimalPlaces } from '@/lib/utils';
import { OpenTradesTable } from '@/components/dashboard/OpenTradesTable';
import { TradeHistoryTable } from '@/components/dashboard/TradeHistoryTable';
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
  status: 'open';
  shortcode?: string;
  databaseId?: string;
  metadata?: {
    automated?: boolean;
    aiStrategyId?: string;
    reasoning?: string;
    [key: string]: any;
  };
}

// Interface for historical trades
interface HistoricalTrade {
  id: string;
  symbol: InstrumentType | string;
  type: string;
  amount: number;
  price: number;
  exitPrice?: number | null;
  pnl?: number | null;
  status: string;
  purchaseTime?: Date | string | null;
  openTime?: Date | string | null;
  closeTime?: Date | string | null;
  derivContractId?: number | null;
  metadata?: any;
  createdAt: Date | string;
}

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
  const [tradeHistory, setTradeHistory] = useState<HistoricalTrade[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [automatedTradingLog, setAutomatedTradingLog] = useState<string[]>([]);
  // Removed: activeAutomatedTrades state
  // Removed: tradeIntervals ref

  const [profitsClaimable, setProfitsClaimable] = useState<ProfitsClaimable>({
    totalNetProfit: 0,
    tradeCount: 0,
    winningTrades: 0,
    losingTrades: 0,
  });

  const [selectedStopLossPercentage, setSelectedStopLossPercentage] = useState<number>(5);
  const [isAiLoading, setIsAiLoading] = useState(false);

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
        purchaseTime: purchase_time,
        durationSeconds,
        loginidUsed: loginidToUse,
        status: 'open',
        shortcode,
        metadata: { automated: false }
      };
      setOpenTrades(prevOpenTrades => [...prevOpenTrades, newOpenTrade]);

      if (paperTradingModeForControls === 'live') {
        setLiveBalance(prev => parseFloat((prev - stakeAmount).toFixed(2)));
      } else {
        setPaperBalance(prev => parseFloat((prev - stakeAmount).toFixed(2)));
      }

      toast({ title: "Trade Placed Successfully!", description: `Contract ID: ${contract_id}. ${shortcode}`, variant: "default" });

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
        purchaseTime: new Date(newOpenTrade.purchaseTime * 1000).toISOString(),
        durationSeconds: newOpenTrade.durationSeconds,
        loginidUsed: newOpenTrade.loginidUsed,
        metadata: newOpenTrade.metadata
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
    if (authStatus === 'unauthenticated') {
      toast({ title: "Authentication Required", description: "Please log in to get AI recommendations.", variant: "destructive" });
      router.push('/auth/login');
      setAiRecommendation(null); setIsFetchingManualRecommendation(false); return;
    }
    if (!FOREX_CRYPTO_COMMODITY_INSTRUMENTS.includes(currentInstrument as ForexCryptoCommodityInstrumentType)){
      toast({title: "AI Support Note", description: `AI recommendations for ${currentInstrument} are available on its specific trading page.`, variant: "default"});
      setAiRecommendation(null); return;
    }
    setIsFetchingManualRecommendation(true); setAiRecommendation(null);
    console.log(`[DashboardPage] Fetching AI recommendation for ${currentInstrument}, mode: ${tradingMode}`);
    try {
      const marketSentimentParams: MarketSentimentParams = { symbol: currentInstrument as string, tradingMode: tradingMode, aiStrategyId: selectedAiStrategyId };
      const currentCandles = await getCandles(currentInstrument, 60);
      const closePrices = currentCandles.map(candle => candle.close);
      const highPrices = currentCandles.map(candle => candle.high);
      const lowPrices = currentCandles.map(candle => candle.low);
      if (closePrices.length > 0) {
        const rsi = calculateRSI(closePrices); if (rsi !== undefined) marketSentimentParams.rsi = rsi;
        const macd = calculateMACD(closePrices); if (macd) marketSentimentParams.macd = macd;
        const bb = calculateBollingerBands(closePrices); if (bb) marketSentimentParams.bollingerBands = bb;
        const ema = calculateEMA(closePrices); if (ema !== undefined) marketSentimentParams.ema = ema;
        const atr = calculateATR(highPrices, lowPrices, closePrices); if (atr !== undefined) marketSentimentParams.atr = atr;
      } else { console.warn("[DashboardPage] Not enough candle data for indicators."); }
      const sentimentResult = await analyzeMarketSentiment(marketSentimentParams);
      setIsFetchingManualRecommendation(false);
      if (sentimentResult) {
        setAiRecommendation({ action: sentimentResult.action, reasoning: sentimentResult.reasoning, confidence: sentimentResult.confidence });
        toast({ title: "AI Analysis Complete", description: `Recommendation for ${currentInstrument} received.` });
      } else {
        toast({ title: "AI Analysis Failed", description: "Could not retrieve AI recommendation.", variant: "destructive" });
        setAiRecommendation(null);
      }
    } catch (error) {
      console.error("Error getting AI recommendation:", error);
      toast({ title: "AI Analysis Failed", description: (error as Error).message, variant: "destructive" });
      setAiRecommendation(null); setIsFetchingManualRecommendation(false);
    }
  }, [currentInstrument, tradingMode, toast, authStatus, paperTradingModeForControls, selectedAiStrategyId, router]);

  const logAutomatedTradingEvent = (message: string) => {
    console.log(`[AutoTrade] ${message}`);
    setAutomatedTradingLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`].slice(-100));
  };

  const startAutomatedTradingSession = useCallback(async () => {
    if (authStatus === 'unauthenticated' || !userInfo?.id ) {
      toast({ title: "Authentication Required", description: "Please log in to start AI auto-trading.", variant: "destructive" });
      if(authStatus === 'unauthenticated') router.push('/auth/login'); return;
    }
    if (autoTradeTotalStake <= 0) {
      toast({ title: "Set Stake", description: "Please set a total stake for auto-trading.", variant: "default" }); return;
    }
    if (autoTradeTotalStake > currentBalanceToDisplay) {
      toast({ title: "Insufficient Balance", description: "Auto-trade total stake exceeds available balance.", variant: "destructive" }); return;
    }
    if (consecutiveAiCallCount >= 2 && lastAiCallTimestamp && (Date.now() - lastAiCallTimestamp) < AI_COOLDOWN_DURATION_MS) {
      const remainingMinutes = Math.ceil((AI_COOLDOWN_DURATION_MS - (Date.now() - lastAiCallTimestamp)) / 60000);
      toast({ title: "AI Cooldown", description: `Please wait ${remainingMinutes}m.`, variant: "default" }); return;
    } else if (consecutiveAiCallCount >= 2) {
      setConsecutiveAiCallCount(0);
    }

    setIsPreparingAutoTrades(true); setIsAutoTradingActive(true);
    setAutomatedTradingLog([`${new Date().toLocaleTimeString()}: Initializing AI Auto-Trading session with $${autoTradeTotalStake} in ${paperTradingModeForControls} mode using strategy ${selectedAiStrategyId}.`]);

    try {
      const allPossibleInstruments = SUPPORTED_INSTRUMENTS.filter(inst => ['Forex', 'Crypto', 'Commodity'].includes(inst.type)).map(inst => inst.id as ForexCryptoCommodityInstrumentType);
      const instrumentsToTrade = allPossibleInstruments.filter(inst => getMarketStatus(inst).isOpen || ['BTC/USD', 'ETH/USD'].includes(inst));

      if (instrumentsToTrade.length === 0) {
        logAutomatedTradingEvent("No suitable instruments available for auto-trading. Session ending.");
        toast({ title: "Auto-Trading Halted", description: "No instruments available.", variant: "destructive" });
        setIsPreparingAutoTrades(false); setIsAutoTradingActive(false); return;
      }
      logAutomatedTradingEvent(`Selected instruments for session: ${instrumentsToTrade.join(', ')}`);

      const instrumentTicksData: Record<string, PriceTick[]> = {};
      const instrumentIndicatorsData: Record<string, any> = {};
      for (const inst of instrumentsToTrade) {
        try {
          const candles = await getCandles(inst, 60, 60, (userInfo as any).derivAccessToken);
          if (candles && candles.length > 0) {
            instrumentTicksData[inst] = candles.map(c => ({ epoch: c.epoch, price: c.close, time: c.time }));
            const closePrices = candles.map(c => c.close); const highPrices = candles.map(c => c.high); const lowPrices = candles.map(c => c.low);
            instrumentIndicatorsData[inst] = {
              rsi: calculateRSI(closePrices), macd: calculateMACD(closePrices),
              bollingerBands: calculateBollingerBands(closePrices), ema: calculateEMA(closePrices),
              atr: calculateATR(highPrices, lowPrices, closePrices)
            };
          } else { logAutomatedTradingEvent(`No candle data for ${inst}. Excluding.`); }
        } catch (err) { logAutomatedTradingEvent(`Error fetching data for ${inst}: ${(err as Error).message}. Excluding.`); }
      }

      const strategyInput: AutomatedTradingStrategyInput = {
        totalStake: autoTradeTotalStake, instruments: instrumentsToTrade.filter(i => instrumentTicksData[i]?.length > 0),
        tradingMode, aiStrategyId: selectedAiStrategyId, stopLossPercentage: selectedStopLossPercentage,
        instrumentTicks: instrumentTicksData, instrumentIndicators: instrumentIndicatorsData,
      };

      logAutomatedTradingEvent("Requesting AI trading strategy...");
      const strategyResult = await generateAutomatedTradingStrategy(strategyInput);
      logAutomatedTradingEvent(`AI strategy: ${strategyResult.tradesToExecute.length} trades. Reasoning: ${strategyResult.overallReasoning}`);

      setConsecutiveAiCallCount(prev => prev + 1); setLastAiCallTimestamp(Date.now());

      if (!strategyResult || strategyResult.tradesToExecute.length === 0) {
        logAutomatedTradingEvent(strategyResult?.overallReasoning || "AI found no optimal trades.");
        toast({ title: "AI Auto-Trade", description: strategyResult?.overallReasoning || "No trades proposed.", variant: "default" });
        setIsAutoTradingActive(false); setIsPreparingAutoTrades(false); return;
      }

      toast({ title: "AI Strategy Received", description: `Proposing ${strategyResult.tradesToExecute.length} trade(s). Executing...`, duration: 7000 });

      let tradesSuccessfullyPlaced = 0;
      for (const aiProposal of strategyResult.tradesToExecute) {
        logAutomatedTradingEvent(`AI Proposing: ${aiProposal.action} ${aiProposal.instrument} @ ${aiProposal.stake}. Reason: ${aiProposal.reasoning}`);
        if (currentAuthMethod !== 'deriv-credentials' || !(userInfo as any).derivAccessToken) {
          logAutomatedTradingEvent("Critical error: Deriv token missing."); continue;
        }
        const loginidToUse = paperTradingModeForControls === 'live' ? (userInfo as any).derivRealAccountId : (userInfo as any).derivDemoAccountId;
        if (!loginidToUse) { logAutomatedTradingEvent(`Deriv account ID for ${paperTradingModeForControls} missing. Skipping.`); continue; }

        let durationValue = aiProposal.durationSeconds; let durationUnit: 's' | 'm' | 'h' | 'd' = 's';
        if (aiProposal.durationSeconds >= 3600 && aiProposal.durationSeconds % 3600 === 0) { durationValue = aiProposal.durationSeconds / 3600; durationUnit = 'h'; }
        else if (aiProposal.durationSeconds >= 60 && aiProposal.durationSeconds % 60 === 0) { durationValue = aiProposal.durationSeconds / 60; durationUnit = 'm'; }

        const derivSymbol = instrumentToDerivSymbol(aiProposal.instrument as InstrumentType);
        const proposalRequestDetail: DerivProposalRequest = {
          proposal: 1, amount: aiProposal.stake, basis: 'stake', contract_type: aiProposal.action,
          currency: 'USD', symbol: derivSymbol, duration: durationValue, duration_unit: durationUnit, loginid: loginidToUse,
        };

        try {
          logAutomatedTradingEvent(`Getting Deriv proposal for ${aiProposal.instrument}`);
          const proposalResponse = await getTradeProposal((userInfo as any).derivAccessToken, proposalRequestDetail);
          if (proposalResponse.error || !proposalResponse.proposal) {
            logAutomatedTradingEvent(`Proposal failed for ${aiProposal.instrument}: ${proposalResponse.error?.message}`); continue;
          }

          const { id: proposalId, ask_price: proposedPrice } = proposalResponse.proposal;
          const buyRequestDetail: DerivBuyRequest = { buy: proposalId, price: proposedPrice, loginid: loginidToUse };

          logAutomatedTradingEvent(`Buying contract for ${aiProposal.instrument}`);
          const buyResponse = await buyContract((userInfo as any).derivAccessToken, buyRequestDetail);
          if (buyResponse.error || !buyResponse.buy) {
            logAutomatedTradingEvent(`Buy failed for ${aiProposal.instrument}: ${buyResponse.error?.message}`); continue;
          }

          const { contract_id, buy_price, purchase_time, shortcode } = buyResponse.buy;
          logAutomatedTradingEvent(`Placed AI trade for ${aiProposal.instrument}. ID: ${contract_id}`);
          const newOpenTrade: OpenTrade = {
            contract_id, instrument: aiProposal.instrument as InstrumentType, action: aiProposal.action,
            stake: aiProposal.stake, entryPrice: buy_price, purchaseTime: purchase_time,
            durationSeconds: aiProposal.durationSeconds, loginidUsed: loginidToUse, status: 'open', shortcode,
            metadata: { automated: true, aiStrategyId: selectedAiStrategyId, reasoning: aiProposal.reasoning }
          };
          setOpenTrades(prev => [...prev, newOpenTrade]);
          if (paperTradingModeForControls === 'live') setLiveBalance(prev => parseFloat((prev - aiProposal.stake).toFixed(2)));
          else setPaperBalance(prev => parseFloat((prev - aiProposal.stake).toFixed(2)));
          tradesSuccessfullyPlaced++;

          const tradeLogPayload = {
            userId: userInfo.id, email: (userInfo as any).email, name: (userInfo as any).name, symbol: newOpenTrade.instrument,
            type: newOpenTrade.action === 'CALL' ? 'buy' : 'sell', amount: newOpenTrade.stake, price: newOpenTrade.entryPrice,
            derivContractId: newOpenTrade.contract_id.toString(), status: 'open',
            purchaseTime: new Date(newOpenTrade.purchaseTime * 1000).toISOString(),
            durationSeconds: newOpenTrade.durationSeconds, loginidUsed: newOpenTrade.loginidUsed,
            aiStrategyId: selectedAiStrategyId, metadata: newOpenTrade.metadata
          };
          fetch('/api/trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tradeLogPayload) })
            .then(async logRes => {
              if (logRes.ok) { const lt = await logRes.json(); console.log('[AutoTrade] Logged AI trade:', lt.id); setOpenTrades(p => p.map(ot=>ot.contract_id===newOpenTrade.contract_id?{...ot,databaseId:lt.id}:ot));}
              else console.error('[AutoTrade] Failed to log AI trade:', await logRes.text());
            }).catch(err => console.error('[AutoTrade] Error logging AI trade:', err));
        } catch (tradeError) {
          logAutomatedTradingEvent(`Error processing AI trade for ${aiProposal.instrument}: ${(tradeError as Error).message}`);
          toast({ title: "AI Trade Error", description: `Error for ${aiProposal.instrument}: ${(tradeError as Error).message}`, variant: "destructive" });
        }
      }
      setIsPreparingAutoTrades(false);
      if (tradesSuccessfullyPlaced === 0) {
        logAutomatedTradingEvent("No AI trades placed.");
        if (strategyResult.tradesToExecute.length === 0) setIsAutoTradingActive(false);
      } else {
        toast({ title: "AI Auto-Trading Active", description: `${tradesSuccessfullyPlaced} AI trade(s) initiated.`, variant: "default" });
      }
    } catch (error) {
      logAutomatedTradingEvent(`Error in AI auto-trading session: ${(error as Error).message}`);
      console.error("AI Auto-Trading Session Error:", error);
      toast({ title: "AI Auto-Trading System Error", description: (error as Error).message, variant: "destructive" });
      setIsAutoTradingActive(false); setIsPreparingAutoTrades(false);
    }
  }, [authStatus, userInfo, autoTradeTotalStake, currentBalanceToDisplay, paperTradingModeForControls, tradingMode, selectedAiStrategyId, consecutiveAiCallCount, lastAiCallTimestamp, toast, router, setLiveBalance, setPaperBalance, setOpenTrades, logAutomatedTradingEvent, selectedStopLossPercentage]);

  const handleStopAiAutoTrade = () => {
    logAutomatedTradingEvent("AI Auto-Trading session manually stopped by user.");
    setIsAutoTradingActive(false); 
    // tradeIntervals.current.forEach(intervalId => clearInterval(intervalId)); // Already removed as tradeIntervals is removed
    // tradeIntervals.current.clear(); // Already removed

    toast({
      title: "AI Auto-Trading Stopped",
      description: `Automated trading session for ${paperTradingModeForControls} account has been stopped. Open AI trades will be monitored for outcome.`,
      duration: 5000
    });
  };

  // Removed old useEffect for simulating activeAutomatedTrades

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

  useEffect(() => {
    if (authStatus === 'authenticated' && userInfo?.id) {
      setIsLoadingHistory(true);
      fetch('/api/trades/history')
        .then(res => {
          if (!res.ok) {
            return res.json().then(errData => {
              throw new Error(errData.error || errData.details || `Failed to fetch trade history: ${res.statusText}`);
            }).catch(() => {
              throw new Error(`Failed to fetch trade history: ${res.statusText} (Status: ${res.status})`);
            });
          }
          return res.json();
        })
        .then((data: HistoricalTrade[]) => {
          setTradeHistory(data);
        })
        .catch(error => {
          console.error("Error fetching trade history:", error);
          toast({
            title: "Error Fetching History",
            description: (error as Error).message || "Could not load your trade history.",
            variant: "destructive",
          });
          setTradeHistory([]);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else if (authStatus === 'unauthenticated') {
      setTradeHistory([]);
      setIsLoadingHistory(false);
    }
  }, [authStatus, userInfo, toast]);

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

            {/* Display OpenTradesTable (from previous subtask, ensure it's correctly placed) */}
            {openTrades && openTrades.length > 0 && (
              <div className="mt-6">
                <OpenTradesTable openTrades={openTrades} />
              </div>
            )}

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

            {/* Display Trade History Table */}
            <div className="mt-6">
              {isLoadingHistory ? (
                <Card className="shadow-lg"><CardHeader><CardTitle>Trade History</CardTitle></CardHeader><CardContent><p className="text-center py-4 text-muted-foreground">Loading history...</p></CardContent></Card>
              ) : (
                <TradeHistoryTable tradeHistory={tradeHistory} />
              )}
            </div>
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

[end of src/app/page.tsx]

[end of src/app/page.tsx]
