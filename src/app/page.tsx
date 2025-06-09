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
import { getCandles } from '@/services/deriv';
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
  accountType: PaperTradingMode;
  tradeCategory: 'forexCrypto' | 'volatility' | 'mt5';
  reasoning?: string;
  isDbFallback?: boolean;
}

// Type guard to check if user is authenticated
function isAuthenticated(status: AuthStatus, mode: PaperTradingMode): boolean {
  return status === 'authenticated' || mode === 'paper';
}

// Helper function to validate trade parameters
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
    // setPaperBalance, // Direct setPaperBalance from context might not be used here now
    liveBalance, 
    // setLiveBalance, // Direct setLiveBalance from context might not be used here now
    selectedDerivAccountType,
    switchToDerivDemo,
    switchToDerivLive,
    currentAuthMethod,
  } = useAuth();
  
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType>(FOREX_CRYPTO_COMMODITY_INSTRUMENTS[0]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [selectedAiStrategyId, setSelectedAiStrategyId] = useState<string>(DEFAULT_AI_STRATEGY_ID);
  const [tradeDuration, setTradeDuration] = useState<TradeDuration>('5m');
  // const [paperTradingMode, setPaperTradingMode] = useState<PaperTradingMode>('paper'); // Removed local state
  const [stakeAmount, setStakeAmount] = useState<number>(10);

  const paperTradingModeForControls: PaperTradingMode =
    (currentAuthMethod === 'deriv-credentials' && selectedDerivAccountType === 'live')
    ? 'live'
    : 'paper';

  const handleAccountTypeChangeFromControls = (newMode: PaperTradingMode) => {
    if (currentAuthMethod === 'deriv-credentials') {
      if (newMode === 'live') {
        switchToDerivLive();
      } else { // 'paper'
        switchToDerivDemo();
      }
    } else {
      console.warn(`[DashboardPage] Account type switch attempted for non-Deriv user to ${newMode}. No action taken in AuthContext.`);
      // Handle local paper/live for non-Deriv if needed in future
    }
  };

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
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  const [isAiLoading, setIsAiLoading] = useState(false);

  const [consecutiveAiCallCount, setConsecutiveAiCallCount] = useState(0);
  const [lastAiCallTimestamp, setLastAiCallTimestamp] = useState<number | null>(null);
  const AI_COOLDOWN_DURATION_MS = 2 * 60 * 1000; // 2 minutes

  // const currentBalance = paperTradingMode === 'paper' ? paperBalance : liveBalance; // Replaced by currentBalanceToDisplay
  // const setCurrentBalance = paperTradingMode === 'paper' ? setPaperBalance : setLiveBalance; // Commented out, balance updates need refactor

  const currentBalanceToDisplay = useMemo(() => {
    if (currentAuthMethod === 'deriv-credentials') {
      return selectedDerivAccountType === 'live' ? liveBalance : paperBalance;
    }
    // Fallback for non-Deriv users or if AuthContext isn't fully synced yet.
    return paperTradingModeForControls === 'live' ? liveBalance : paperBalance;
  }, [currentAuthMethod, selectedDerivAccountType, liveBalance, paperBalance, paperTradingModeForControls]);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const profitsKey = `forexCryptoProfitsClaimable_${paperTradingModeForControls}`; // Updated dependency
    const storedProfits = localStorage.getItem(profitsKey);
    if (storedProfits) {
      try {
        setProfitsClaimable(JSON.parse(storedProfits));
      } catch (error) {
        console.error("Error parsing forex/crypto profits from localStorage:", error);
        setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });
      }
    } else {
      setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });
    }
  }, [paperTradingModeForControls]); // Updated dependency

  useEffect(() => {
    const profitsKey = `forexCryptoProfitsClaimable_${paperTradingModeForControls}`; // Updated dependency
    localStorage.setItem(profitsKey, JSON.stringify(profitsClaimable));
  }, [profitsClaimable, paperTradingModeForControls]); // Updated dependency

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
    if (authStatus === 'unauthenticated') {
      toast({ 
        title: "Authentication Required",
        description: "Please log in to execute trades.",
        variant: "destructive" 
      });
      router.push('/auth/login');
      return;
    }

    const { isOpen, statusMessage } = getMarketStatus(currentInstrument);
    if (!isOpen && (FOREX_CRYPTO_COMMODITY_INSTRUMENTS.includes(currentInstrument as ForexCryptoCommodityInstrumentType) && !['BTC/USD', 'ETH/USD'].includes(currentInstrument as string))) {
      toast({ 
        title: "Market Closed",
        description: statusMessage,
        variant: "destructive" 
      });
      return;
    }

    // The new check `if (authStatus === 'unauthenticated')` is more comprehensive.
    // The old `if (!isAuthenticated(authStatus, paperTradingMode))` might still be relevant if paper trading by unauthenticated users is allowed
    // but live trading is not. The new check blocks ALL actions if unauthenticated.
    // For now, let's remove the old one as per instruction "Remove or adjust... if it becomes redundant".
    // if (!isAuthenticated(authStatus, paperTradingModeForControls)) { // Updated
    //   toast({
    //     title: "Login Required",
    //     description: "Please login with your Deriv account to use Real Account features.",
    //     variant: "destructive"
    //   });
    //   return;
    // }

    const validationError = validateTradeParameters(stakeAmount, currentBalanceToDisplay, paperTradingModeForControls); // Updated
    if (validationError) {
      toast({ 
        title: validationError.split(':')[0], 
        description: validationError.split(':')[1].trim(), 
        variant: "destructive" 
      });
      return;
    }

    if (!userInfo?.id) {
      console.error('[Dashboard] Cannot execute trade: No user ID available');
      toast({ 
        title: "Authentication Error", 
        description: "Your user ID is not available. Please try logging in again.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      console.log('[Dashboard] Ensuring user exists in database:', userInfo.id);
      
      const handleUserResponse = await fetch('/api/auth/handle-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userInfo.id,
          email: userInfo.email || `user-${userInfo.id}@example.com`,
          name: userInfo.name || 'User'
        }),
      });

      if (!handleUserResponse.ok) {
        console.error('[Dashboard] Error ensuring user exists:', await handleUserResponse.text());
        toast({ 
          title: "User Error", 
          description: "Could not validate your user account. The trade will still be saved locally.", 
          variant: "destructive" 
        });
      } else {
        const userData = await handleUserResponse.json();
        console.log('[Dashboard] User validation successful:', userData.message);
      }
      
      const ticks = await getCandles(currentInstrument, 60);
      if (ticks.length === 0) {
        toast({ 
          title: "Price Error", 
          description: `Could not fetch entry price for ${currentInstrument}. Trade not placed.`, 
          variant: "destructive" 
        });
        return;
      }

      const entryPrice = ticks[ticks.length - 1].close;
      const decimals = getInstrumentDecimalPlaces(currentInstrument);
      const priceChange = entryPrice * 0.001; 
      
      console.log(`[Dashboard] Executing ${action} trade for ${currentInstrument} with duration ${tradeDuration} and stake ${stakeAmount} in ${tradingMode} mode. Account: ${paperTradingModeForControls}. Entry: ${entryPrice}`); // Updated
      
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userInfo.id,
          email: userInfo.email, 
          name: userInfo.name,   
          symbol: currentInstrument,
          type: action === 'CALL' ? 'buy' : 'sell',
          amount: stakeAmount,
          price: entryPrice,
          metadata: {
            mode: tradingMode,
            duration: tradeDuration,
            accountType: paperTradingModeForControls // Updated
          }
        }),
      });

      let dbTradeCreated = false;
      let trade: any = null; 
      
      if (response.ok) {
        trade = await response.json();
        console.log('[Dashboard] Trade created successfully in database:', trade);
        dbTradeCreated = true;
      } else {
        console.error('[Dashboard] Database error:', await response.text());
      }
      
      const localTradeId = crypto.randomUUID();
      const localStorageTrade = {
        id: dbTradeCreated ? trade.id : localTradeId,
        userId: userInfo.id,
        symbol: currentInstrument,
        type: action === 'CALL' ? 'buy' : 'sell',
        amount: stakeAmount,
        price: entryPrice,
        status: 'open',
        openTime: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          mode: tradingMode,
          duration: tradeDuration,
              accountType: paperTradingModeForControls, // Updated
          source: dbTradeCreated ? 'database-backup' : 'local-only'
        }
      };
      
      setTimeout(() => {
        const potentialProfit = stakeAmount * 0.85; 
        const outcome = Math.random() > 0.4 ? "won" : "lost"; 
        const pnl = outcome === "won" ? potentialProfit : -stakeAmount;
        
        let exitPrice: number;
        if (action === 'CALL') {
          exitPrice = outcome === "won" ? entryPrice + priceChange : entryPrice - priceChange;
        } else { 
          exitPrice = outcome === "won" ? entryPrice - priceChange : entryPrice - priceChange;
        }
        exitPrice = parseFloat(exitPrice.toFixed(decimals));
        
        if (dbTradeCreated && trade?.id) {
          console.log('[Dashboard] Closing trade in database:', trade.id);
          fetch(`/api/trades/${trade.id}/close`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              exitPrice,
              metadata: {
                outcome,
                pnl,
                duration: tradeDuration
              }
            }),
          })
          .then(res => {
            if (!res.ok) {
              console.error(`[Dashboard] Error closing trade: ${res.status} ${res.statusText}`);
              return;
            }
            return res.json();
          })
          .then((closedTrade: any) => {
            if (closedTrade) {
              console.log('[Dashboard] Trade closed successfully:', closedTrade);
            }
          })
          .catch(err => {
            console.error('[Dashboard] Error closing trade:', err);
          });
        } else {
          console.warn("[Dashboard] Database trade not created or ID missing, cannot close in DB. Trade outcome simulated locally only.");
        }
        
        // setCurrentBalance(prev => parseFloat((prev + pnl).toFixed(2))); // Needs refactor for AuthContext
        console.warn("[DashboardPage] setCurrentBalance after trade needs refactor to update AuthContext balances.");
        toast({
          title: `Trade ${outcome === "won" ? "Won" : "Lost"}`,
          description: `P/L: $${pnl.toFixed(2)}`,
          variant: outcome === "won" ? "default" : "destructive",
        });
      }, 2000);
    } catch (error) {
      console.error('[Dashboard] Trade execution error:', error);
      toast({
        title: "Trade Error",
        description: error instanceof Error ? error.message : "Failed to execute trade. Please try again.",
        variant: "destructive"
      });
    }
  };

  const fetchAndSetAiRecommendation = useCallback(async () => {
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

    // The new check `if (authStatus === 'unauthenticated')` is more comprehensive.
    // The old `if (authStatus === 'unauthenticated' && paperTradingModeForControls === 'live')` is now covered. // Updated
    // if (authStatus === 'unauthenticated' && paperTradingModeForControls === 'live') { // Updated
    //   toast({title: "Login Required", description: "AI Recommendation for Live Account requires login.", variant: "destructive"});
    //   setAiRecommendation(null);
    //   return;
    // }
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
  }, [currentInstrument, tradingMode, toast, authStatus, paperTradingModeForControls, selectedAiStrategyId, router]); // Added router and paperTradingModeForControls

  const logAutomatedTradingEvent = (message: string) => {
    console.log(`[AutoTrade] ${message}`);
    setAutomatedTradingLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const startAutomatedTradingSession = useCallback(async () => {
    if (authStatus === 'unauthenticated') {
      toast({
        title: "Authentication Required",
        description: "Please log in to start AI auto-trading.",
        variant: "destructive"
      });
      router.push('/auth/login');
      return;
    }

    // The new check `if (authStatus === 'unauthenticated')` is more comprehensive.
    // The old `if (authStatus !== 'authenticated' && paperTradingModeForControls === 'live')` is now covered. // Updated
    // if (authStatus !== 'authenticated' && paperTradingModeForControls === 'live') { // Updated
    //   toast({
    //     title: "Authentication Required for Live Trading",
    //     description: "Please log in to start live auto-trading.",
    //     variant: "destructive",
    //   });
    //   return;
    // }
    if (autoTradeTotalStake <= 0) {
      toast({ title: "Set Stake", description: "Please set a total stake for auto-trading.", variant: "default" });
      return;
    }
    if (autoTradeTotalStake > currentBalanceToDisplay) { // Updated
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
        setConsecutiveAiCallCount(0); // Cooldown expired, reset count
      }
    }

    setIsPreparingAutoTrades(true);
    setIsAutoTradingActive(true);
    setActiveAutomatedTrades([]);
    setAutomatedTradingLog([]);
    logAutomatedTradingEvent(`Initializing AI Auto-Trading session with $${autoTradeTotalStake} in ${paperTradingModeForControls} mode using strategy ${selectedAiStrategyId}.`); // Updated

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
          description: `AI proposes ${strategyResult.tradesToExecute.length} trade(s) for ${paperTradingModeForControls} account. ${strategyResult.overallReasoning || 'Executing strategy.'}`, // Updated
          duration: 7000 
        });
      }
      setConsecutiveAiCallCount(prev => prev + 1); // Increment AI call count
      setLastAiCallTimestamp(Date.now()); // Update last AI call timestamp
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
  }, [authStatus, paperTradingModeForControls, autoTradeTotalStake, currentBalanceToDisplay, tradingMode, toast, logAutomatedTradingEvent, selectedAiStrategyId, selectedStopLossPercentage, userInfo, router]); // Added router, paperTradingModeForControls, currentBalanceToDisplay


  const handleStopAiAutoTrade = () => {
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
                  accountType: paperTradingModeForControls, // Updated
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
            // setCurrentBalance(prevBal => parseFloat((prevBal + pnl).toFixed(2))); // Needs refactor for AuthContext
            console.warn("[DashboardPage] setCurrentBalance after manual stop needs refactor to update AuthContext balances.");
            setProfitsClaimable(prevProfits => ({
              totalNetProfit: prevProfits.totalNetProfit + pnl,
              tradeCount: prevProfits.tradeCount + 1,
              winningTrades: prevProfits.winningTrades, 
              losingTrades: prevProfits.losingTrades + 1, 
            }));
            
            toast({
              title: `Auto-Trade Ended (${paperTradingModeForControls}): ${trade.instrument}`, // Updated
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
    toast({ title: "AI Auto-Trading Stopped", description: `Automated Forex/Crypto/Commodity trading session for ${paperTradingModeForControls} account has been manually stopped.`}); // Updated
  };
  
  useEffect(() => {
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
                    accountType: paperTradingModeForControls, // Updated
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
                  // setCurrentBalance(prevBal => parseFloat((prevBal + pnl).toFixed(2))); // Needs refactor for AuthContext
                  console.warn("[DashboardPage] setCurrentBalance after auto-trade needs refactor to update AuthContext balances.");
                  setProfitsClaimable(prevProfits => ({
                    totalNetProfit: prevProfits.totalNetProfit + pnl,
                    tradeCount: prevProfits.tradeCount + 1,
                    winningTrades: newStatus === 'won' ? prevProfits.winningTrades + 1 : prevProfits.winningTrades,
                    losingTrades: (newStatus === 'lost_duration' || newStatus === 'lost_stoploss') ? prevProfits.losingTrades + 1 : prevProfits.losingTrades,
                  }));
                  
                  toast({
                    title: `Auto-Trade Ended (${paperTradingModeForControls}): ${currentTrade.instrument}`, // Updated
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
                    toast({ title: "AI Auto-Trading Session Complete", description: `All Forex/Crypto/Commodity trades for ${paperTradingModeForControls} account concluded.`}); // Updated
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
  }, [activeAutomatedTrades, isAutoTradingActive, paperTradingModeForControls, toast, isPreparingAutoTrades, userInfo, tradingMode, selectedAiStrategyId]); // Removed setCurrentBalance, setProfitsClaimable, added paperTradingModeForControls


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
