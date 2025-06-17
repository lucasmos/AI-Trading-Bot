'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { TradingChart } from '@/components/dashboard/trading-chart';
import { TradeControls } from '@/components/dashboard/trade-controls';
import { AiRecommendationCard } from '@/components/dashboard/ai-recommendation-card';
import type { TradingMode, TradeDuration, AiRecommendation, PaperTradingMode, ActiveAutomatedTrade, ProfitsClaimable, PriceTick, ForexCryptoCommodityInstrumentType, VolatilityInstrumentType, AuthStatus, MarketSentimentParams, InstrumentType, InstrumentIndicatorData, AutomatedTradingStrategyInput as TypesAutomatedTradingStrategyInput } from '@/types'; // Renamed to avoid conflict
import { analyzeMarketSentiment, type AnalyzeMarketSentimentInput } from '@/ai/flows/analyze-market-sentiment';
import { explainAiReasoning } from '@/ai/flows/explain-ai-reasoning';
import { generateAutomatedTradingStrategy, AutomatedTradingStrategyInput as FlowAutomatedTradingStrategyInput } from '@/ai/flows/automated-trading-strategy-flow'; // Renamed to avoid conflict
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getCandles, placeTrade, instrumentToDerivSymbol, getTradingDurations, type PlaceTradeResponse, type DerivContractStatusData, getContractStatus, sellContract, getContractOfferings, type DerivContractOffering } from '@/services/deriv';
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
import { DerivBalanceListener } from '@/services/deriv-balance-listener';

const DEFAULT_PAPER_BALANCE = 10000; // Fallback if context value is null
const DEFAULT_LIVE_BALANCE = 0;    // Fallback if context value is null

const MAX_MONITORING_RETRIES = 3;

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

function parseDurationToSeconds(durationString?: string): number {
  if (!durationString) return 0;
  const value = parseInt(durationString);
  if (isNaN(value)) return 0; // Handle cases where parseInt fails, e.g., "unknown"

  if (durationString.endsWith('s')) return value;
  if (durationString.endsWith('m')) return value * 60;
  if (durationString.endsWith('h')) return value * 60 * 60;
  if (durationString.endsWith('d')) return value * 24 * 60 * 60;

  // Fallback for if unit is missing but it's a number (treat as seconds)
  // This might be too lenient, adjust if strict format adherence is required
  if (!isNaN(parseInt(durationString))) return parseInt(durationString);

  console.warn(`[parseDurationToSeconds] Unknown duration format: ${durationString}`);
  return 0;
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

  const [freshDemoBalance, setFreshDemoBalance] = useState<number | null>(null);
  const [freshRealBalance, setFreshRealBalance] = useState<number | null>(null);
  const [isLoadingDemoBalance, setIsLoadingDemoBalance] = useState<boolean>(false);
  const [isLoadingRealBalance, setIsLoadingRealBalance] = useState<boolean>(false);
  const [demoSyncStatus, setDemoSyncStatus] = useState<ListenerStatus>('idle');
  const [realSyncStatus, setRealSyncStatus] = useState<ListenerStatus>('idle');

  const router = useRouter();
  const { toast } = useToast();

  const demoBalanceListenerRef = useRef<DerivBalanceListener | null>(null);
  const realBalanceListenerRef = useRef<DerivBalanceListener | null>(null);

function mapDerivStatusToLocal(derivStatus?: DerivContractStatusData['status']): ActiveAutomatedTrade['status'] {
  if (!derivStatus) return 'open'; // Default if undefined
  switch (derivStatus) {
    case 'open': return 'open';
    case 'sold': return 'sold';
    case 'won': return 'won';
    case 'lost': return 'lost';
    case 'cancelled': return 'cancelled';
    default:
      console.warn(`Unknown Deriv contract status encountered: ${derivStatus}`);
      return 'open'; // Fallback for unknown statuses
  }
}

  // Top-level cleanup for listeners on component unmount
  useEffect(() => {
    return () => {
      if (demoBalanceListenerRef.current) {
        demoBalanceListenerRef.current.close();
        demoBalanceListenerRef.current = null;
      }
      if (realBalanceListenerRef.current) {
        realBalanceListenerRef.current.close();
        realBalanceListenerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const demoToken = userInfo?.derivDemoApiToken;
    if (demoToken && derivDemoAccountId) {
      if (demoBalanceListenerRef.current) {
        demoBalanceListenerRef.current.close();
      }
      setFreshDemoBalance(prev => prev ?? derivDemoBalance ?? DEFAULT_PAPER_BALANCE);
      setIsLoadingDemoBalance(true);

      demoBalanceListenerRef.current = new DerivBalanceListener(
        demoToken,
        derivDemoAccountId,
        (balanceData) => {
          setFreshDemoBalance(balanceData.balance);
          // setIsLoadingDemoBalance(false); // Status change will handle this
        },
        (error) => {
          console.error('[DashboardPage] Demo Balance Listener Error:', error);
          // Toast is now handled by onStatusChange for 'error'
        },
        (status, message) => { // onStatusChange callback
          setDemoSyncStatus(status);
          if (message) console.log(`[DashboardPage] Demo Listener Status: ${status} - ${message}`);
          if (status === 'error' && message) {
            toast({ title: 'Demo Balance Sync Issue', description: message, variant: 'destructive'});
          }
          // Manage loading state based on status
          if (status === 'connected' || status === 'error' || status === 'disconnected' || status === 'idle') {
            setIsLoadingDemoBalance(false);
          } else {
            setIsLoadingDemoBalance(true);
          }
        },
        (closeEvent) => { // onClose callback
          console.log(`[DashboardPage] Demo Balance Listener Closed. Code: ${closeEvent.code}, Clean: ${closeEvent.wasClean}`);
          // if (!closeEvent.wasClean) setIsLoadingDemoBalance(false); // Covered by onStatusChange
        }
      );
    } else {
       if (demoBalanceListenerRef.current) {
          demoBalanceListenerRef.current.close();
          demoBalanceListenerRef.current = null;
       }
       setFreshDemoBalance(derivDemoBalance ?? DEFAULT_PAPER_BALANCE); // Fallback if no token/ID
       setIsLoadingDemoBalance(false);
    }
    // This effect's cleanup is implicitly handled by the next run creating a new listener and closing the old one,
    // and the main unmount cleanup.
  }, [userInfo?.derivDemoApiToken, derivDemoAccountId, toast, derivDemoBalance, userInfo?.derivAccessToken]); // Added userInfo.derivDemoApiToken

  useEffect(() => {
    const realToken = userInfo?.derivRealApiToken;
    if (realToken && derivRealAccountId) {
      if (realBalanceListenerRef.current) {
        realBalanceListenerRef.current.close();
      }
      setFreshRealBalance(prev => prev ?? derivLiveBalance ?? DEFAULT_LIVE_BALANCE);
      setIsLoadingRealBalance(true);

      realBalanceListenerRef.current = new DerivBalanceListener(
        realToken,
        derivRealAccountId,
        (balanceData) => {
          setFreshRealBalance(balanceData.balance);
          // setIsLoadingRealBalance(false);
        },
        (error) => {
          console.error('[DashboardPage] Real Balance Listener Error:', error);
          // Toast handled by onStatusChange
        },
        (status, message) => { // onStatusChange callback
          setRealSyncStatus(status);
          if (message) console.log(`[DashboardPage] Real Listener Status: ${status} - ${message}`);
          if (status === 'error' && message) {
            toast({ title: 'Real Balance Sync Issue', description: message, variant: 'destructive'});
          }
          if (status === 'connected' || status === 'error' || status === 'disconnected' || status === 'idle') {
            setIsLoadingRealBalance(false);
          } else {
            setIsLoadingRealBalance(true);
          }
        },
        (closeEvent) => { // onClose callback
          console.log(`[DashboardPage] Real Balance Listener Closed. Code: ${closeEvent.code}, Clean: ${closeEvent.wasClean}`);
          // if (!closeEvent.wasClean) setIsLoadingRealBalance(false); // Covered by onStatusChange
        }
      );
    } else {
      if (realBalanceListenerRef.current) {
          realBalanceListenerRef.current.close();
          realBalanceListenerRef.current = null;
      }
      setFreshRealBalance(derivLiveBalance ?? DEFAULT_LIVE_BALANCE); // Fallback
      setIsLoadingRealBalance(false);
    }
  }, [userInfo?.derivRealApiToken, derivRealAccountId, toast, derivLiveBalance, userInfo?.derivAccessToken]); // Added userInfo.derivRealApiToken

  const fetchBalanceForAccount = useCallback(async (accountId: string, type: 'demo' | 'real') => {
    // This function relies on a backend API. Ensure the backend uses the correct token for the given accountId.
    // Consider refactoring to call deriv.ts service directly with specific token if issues arise.
    console.warn("[DashboardPage/fetchBalanceForAccount] This function relies on a backend API. Ensure the backend uses the correct token for the given accountId. Consider refactoring to call deriv.ts service directly with specific token if issues arise.");
    if (!accountId) { // Removed direct token check here as it's backend handled
      console.warn(`[DashboardPage] fetchBalanceForAccount: Missing accountId ('${accountId}'). Cannot fetch.`);
      return;
    }

    if (type === 'demo') setIsLoadingDemoBalance(true);
    if (type === 'real') setIsLoadingRealBalance(true);

    console.log(`[DashboardPage] Fetching ${type} balance for account ${accountId}`);
    try {
      const response = await fetch(`/api/deriv/account-balance?accountId=${accountId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch ${type} balance`);
      }
      const data = await response.json(); // Expects { balance: number, currency: string, loginid: string }

      if (type === 'demo') {
        setFreshDemoBalance(data.balance);
        console.log(`[DashboardPage] Fetched demo balance: ${data.balance}`);
      } else if (type === 'real') {
        setFreshRealBalance(data.balance);
        console.log(`[DashboardPage] Fetched real balance: ${data.balance}`);
      }
    } catch (error) {
      console.error(`[DashboardPage] Error fetching ${type} balance for ${accountId}:`, error);
      toast({ title: `Balance Error (${type})`, description: (error as Error).message, variant: "destructive" });
      if (type === 'demo') setFreshDemoBalance(null);
      if (type === 'real') setFreshRealBalance(null);
    } finally {
      if (type === 'demo') setIsLoadingDemoBalance(false);
      if (type === 'real') setIsLoadingRealBalance(false);
    }
  }, [userInfo?.derivAccessToken, toast, setIsLoadingDemoBalance, setIsLoadingRealBalance, setFreshDemoBalance, setFreshRealBalance]); // Keep state setters in useCallback deps

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

  // The useEffect that previously called fetchBalanceForAccount for initial load is now removed.
  // DerivBalanceListener handles initial and subsequent updates.

  const currentBalance = useMemo(() => {
    if (authStatus === 'authenticated' && userInfo?.derivAccessToken) {
      if (selectedDerivAccountType === 'demo') {
        // Prioritize freshly fetched balance if available and not loading, else use context's value or default
        return isLoadingDemoBalance ? (derivDemoBalance ?? DEFAULT_PAPER_BALANCE) : (freshDemoBalance ?? derivDemoBalance ?? DEFAULT_PAPER_BALANCE);
      } else if (selectedDerivAccountType === 'real') {
        return isLoadingRealBalance ? (derivLiveBalance ?? DEFAULT_LIVE_BALANCE) : (freshRealBalance ?? derivLiveBalance ?? DEFAULT_LIVE_BALANCE);
      }
    }
    return DEFAULT_PAPER_BALANCE; // Default for guests or before anything loads
  }, [
    authStatus, userInfo, selectedDerivAccountType,
    derivDemoBalance, derivLiveBalance,
    freshDemoBalance, freshRealBalance,
    isLoadingDemoBalance, isLoadingRealBalance
  ]);

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
      if (!currentInstrument || !userInfo) return; // Added userInfo check
      setIsLoadingDurations(true);
      const derivSymbol = instrumentToDerivSymbol(currentInstrument);

      let currentToken: string | undefined | null = null;
      if (selectedDerivAccountType === 'demo') {
        currentToken = userInfo.derivDemoApiToken;
      } else if (selectedDerivAccountType === 'real') {
        currentToken = userInfo.derivRealApiToken;
      } else {
        // Fallback or use a general token if applicable, for now, assume one must be selected for this operation
        currentToken = userInfo.derivAccessToken; // Or the primary one if no specific type is selected
      }

      if (!currentToken) {
        toast({ title: "Token Missing", description: `API token for ${selectedDerivAccountType || 'selected'} account not found. Cannot fetch durations.`, variant: "destructive" });
        setIsLoadingDurations(false);
        setIsTradeable(false);
        setAvailableDurations([]);
        return;
      }

      try {
        const durations = await getTradingDurations(derivSymbol, currentToken);
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
  }, [currentInstrument, userInfo, selectedDerivAccountType, toast, tradeDuration]); // Updated deps

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

    let currentToken: string | undefined | null = null;
    let currentTargetAccountId: string | undefined | null = null;

    if (selectedDerivAccountType === 'demo') {
      currentToken = userInfo?.derivDemoApiToken;
      currentTargetAccountId = derivDemoAccountId;
    } else if (selectedDerivAccountType === 'real') {
      currentToken = userInfo?.derivRealApiToken;
      currentTargetAccountId = derivRealAccountId;
    }

    if (!currentToken || !currentTargetAccountId) {
      toast({ title: "Account Error", description: `Selected ${selectedDerivAccountType} account token or ID is missing.`, variant: "destructive" });
      return;
    }
    if (!userInfo?.id) { // Redundant with currentToken check if tokens imply user.id
        toast({ title: "Authentication Error", description: "User ID not found.", variant: "destructive" });
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
      token: currentToken,
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

    console.log(`[Dashboard] Attempting to place Deriv trade on account ${currentTargetAccountId} with details:`, tradePayload);
    try {
      const tradeResult: PlaceTradeResponse = await placeTrade(tradePayload, currentTargetAccountId);
      console.log(`[Dashboard] Deriv trade placed successfully on account ${currentTargetAccountId}:`, tradeResult);
      toast({
        title: `Trade Placed on Deriv (${selectedDerivAccountType})`,
        description: `ID: ${tradeResult.contract_id}. Entry: ${tradeResult.entry_spot}, Buy: ${tradeResult.buy_price.toFixed(getInstrumentDecimalPlaces(currentInstrument))}`
      });

      // Attempt to refresh balance after successful trade
      if (selectedDerivAccountType && currentTargetAccountId) {
        console.log(`[DashboardPage] Post-trade: Attempting balance refresh for ${selectedDerivAccountType} account ${currentTargetAccountId}.`);
        fetchBalanceForAccount(currentTargetAccountId, selectedDerivAccountType);
      }

    } catch (error) {
      console.error(`[Dashboard] Deriv trade placement error on account ${currentTargetAccountId}:`, error);
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

      let currentToken: string | undefined | null = null;
      if (selectedDerivAccountType === 'demo') {
        currentToken = userInfo?.derivDemoApiToken;
      } else if (selectedDerivAccountType === 'real') {
        currentToken = userInfo?.derivRealApiToken;
      } else {
        currentToken = userInfo?.derivAccessToken; // Fallback if needed, though UI should enforce selection
      }

      if (!currentToken) {
        toast({ title: "Token Missing", description: `API token for ${selectedDerivAccountType || 'selected'} account not found for AI recommendation.`, variant: "destructive" });
        setIsFetchingManualRecommendation(false);
        return;
      }

      const currentCandles = await getCandles(currentInstrument, 60, 60, currentToken);
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
  }, [currentInstrument, tradingMode, selectedAiStrategyId, authStatus, selectedDerivAccountType, userInfo, toast, router, setIsFetchingManualRecommendation, setAiRecommendation]); // Added userInfo

  const logAutomatedTradingEvent = (message: string) => {
    setAutomatedTradingLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const startAutomatedTradingSession = useCallback(async () => {
    if (authStatus === 'unauthenticated') {
      toast({ title: "Authentication Required", description: "Please log in to start AI auto-trading.", variant: "destructive" });
      router.push('/auth/login');
      return;
    }

    let currentToken: string | undefined | null = null;
    let currentTargetAccountId: string | undefined | null = null;

    if (selectedDerivAccountType === 'demo') {
      currentToken = userInfo?.derivDemoApiToken;
      currentTargetAccountId = derivDemoAccountId;
    } else if (selectedDerivAccountType === 'real') {
      currentToken = userInfo?.derivRealApiToken;
      currentTargetAccountId = derivRealAccountId;
    }

    if (!currentToken || !currentTargetAccountId) {
      toast({ title: "Account Not Ready", description: `The ${selectedDerivAccountType} account token or ID is missing. Please check your profile.`, variant: "destructive" });
      setIsPreparingAutoTrades(false); // Reset preparation state
      setIsAutoTradingActive(false); // Ensure session doesn't stay active
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
    } else if (consecutiveAiCallCount >= 2) {
      setConsecutiveAiCallCount(0); // Reset after cooldown period passes
    }

    setIsPreparingAutoTrades(true);
    setIsAutoTradingActive(true);
    setActiveAutomatedTrades([]);
    setAutomatedTradingLog([]);
    logAutomatedTradingEvent(`Initializing AI Auto-Trading with $${autoTradeTotalStake} for ${selectedDerivAccountType} account (${currentTargetAccountId}) using strategy ${selectedAiStrategyId}.`);

    const instrumentsToTrade = FOREX_CRYPTO_COMMODITY_INSTRUMENTS.filter(inst => getMarketStatus(inst).isOpen || ['BTC/USD', 'ETH/USD'].includes(inst as string));
    if (instrumentsToTrade.length === 0) {
      logAutomatedTradingEvent("No markets open for auto-trading.");
      toast({ title: "Markets Closed", description: "No suitable markets currently open.", variant: "default" });
      setIsAutoTradingActive(false); setIsPreparingAutoTrades(false); return;
    }

    const instrumentTicksData: Record<ForexCryptoCommodityInstrumentType, PriceTick[]> = {} as any;
    const instrumentIndicatorsData: Record<ForexCryptoCommodityInstrumentType, InstrumentIndicatorData> = {} as any;

    logAutomatedTradingEvent(`Fetching market data for ${instrumentsToTrade.join(', ')}...`);
    for (const inst of instrumentsToTrade) {
      try {
        const candles = await getCandles(inst as InstrumentType, 60, 60, currentToken);
        if (candles && candles.length > 0) {
          instrumentTicksData[inst] = candles.map(c => ({ epoch: c.epoch, price: c.close, time: c.time }));
          const closePrices = candles.map(c => c.close);
          const highPrices = candles.map(c => c.high);
          const lowPrices = candles.map(c => c.low);
          instrumentIndicatorsData[inst] = {
            rsi: calculateRSI(closePrices) ?? undefined,
            macd: calculateMACD(closePrices) ?? undefined,
            bollingerBands: calculateBollingerBands(closePrices) ?? undefined,
            ema: calculateEMA(closePrices) ?? undefined,
            atr: calculateATR(highPrices, lowPrices, closePrices) ?? undefined,
          };
        } else {
          instrumentTicksData[inst] = []; instrumentIndicatorsData[inst] = {};
          logAutomatedTradingEvent(`No candle data for ${inst}. It will be excluded.`);
        }
      } catch (err) {
        instrumentTicksData[inst] = []; instrumentIndicatorsData[inst] = {};
        logAutomatedTradingEvent(`Error fetching data for ${inst}: ${(err as Error).message}. Excluded.`);
      }
      await new Promise(r => setTimeout(r, 250)); // Added delay
    }
    logAutomatedTradingEvent("Market data fetch complete. Generating AI strategy...");

    const strategyInput: FlowAutomatedTradingStrategyInput = { // Use FlowAutomatedTradingStrategyInput
      totalStake: autoTradeTotalStake,
      instruments: instrumentsToTrade.filter(inst => instrumentTicksData[inst] && instrumentTicksData[inst].length > 0),
      tradingMode,
      aiStrategyId: selectedAiStrategyId,
      stopLossPercentage: selectedStopLossPercentage,
      instrumentTicks: instrumentTicksData,
      instrumentIndicators: instrumentIndicatorsData,
    };

    try {
      const strategyResult = await generateAutomatedTradingStrategy(strategyInput);
      logAutomatedTradingEvent(`AI strategy: ${strategyResult.tradesToExecute.length} trades. Reasoning: ${strategyResult.overallReasoning}`);
      setConsecutiveAiCallCount(prev => prev + 1);
      setLastAiCallTimestamp(Date.now());
      setIsPreparingAutoTrades(false);

      if (!strategyResult || strategyResult.tradesToExecute.length === 0) {
        logAutomatedTradingEvent(strategyResult?.overallReasoning || "AI found no optimal trades.");
        toast({ title: "AI Auto-Trade", description: strategyResult?.overallReasoning || "No optimal trades found.", duration: 7000 });
        setIsAutoTradingActive(false); return;
      }
      toast({ title: "AI Strategy Generated", description: `AI proposes ${strategyResult.tradesToExecute.length} trades. Validating and Executing...`, duration: 5000 });

      const newActiveTradesBatch: ActiveAutomatedTrade[] = [];

      for (const proposedTrade of strategyResult.tradesToExecute) {
        const derivSymbol = instrumentToDerivSymbol(proposedTrade.instrument as InstrumentType);
        try {
          logAutomatedTradingEvent(`Validating proposal for ${proposedTrade.instrument} (${derivSymbol}): ${proposedTrade.action}, Stake: $${proposedTrade.stake}, Duration: ${proposedTrade.durationSeconds}s`);

          const offerings = await getContractOfferings(derivSymbol, currentToken!);
          await new Promise(r => setTimeout(r, 250)); // Added delay

          if (!offerings || offerings.length === 0) {
            const validationErrorMsg = `No contract offerings found for ${derivSymbol}. Cannot validate trade.`;
            logAutomatedTradingEvent(validationErrorMsg);
            newActiveTradesBatch.push({
              id: `error_validation_${uuidv4()}`,
              instrument: proposedTrade.instrument as ForexCryptoCommodityInstrumentType,
              derivSymbol, action: proposedTrade.action, stake: proposedTrade.stake,
              durationSeconds: proposedTrade.durationSeconds, reasoning: proposedTrade.reasoning,
              entrySpot: 0, buyPrice: 0, startTime: Date.now(), status: 'error_validation',
              validationError: validationErrorMsg,
            } as ActiveAutomatedTrade);
            continue;
          }

          const intradayOffering = offerings.find(o => o.expiry_type === 'intraday' && o.contract_category === 'callput' && o.start_type === 'spot');

          if (!intradayOffering) {
            const validationErrorMsg = `No suitable 'intraday/callput/spot' offering found for ${derivSymbol}. Cannot validate trade.`;
            logAutomatedTradingEvent(validationErrorMsg);
            newActiveTradesBatch.push({
              id: `error_validation_${uuidv4()}`,
              instrument: proposedTrade.instrument as ForexCryptoCommodityInstrumentType,
              derivSymbol, action: proposedTrade.action, stake: proposedTrade.stake,
              durationSeconds: proposedTrade.durationSeconds, reasoning: proposedTrade.reasoning,
              entrySpot: 0, buyPrice: 0, startTime: Date.now(), status: 'error_validation',
              validationError: validationErrorMsg,
            } as ActiveAutomatedTrade);
            continue;
          }

          const minDurationSeconds = parseDurationToSeconds(intradayOffering.min_contract_duration);
          const maxDurationSeconds = parseDurationToSeconds(intradayOffering.max_contract_duration);

          if (proposedTrade.durationSeconds < minDurationSeconds || (maxDurationSeconds > 0 && proposedTrade.durationSeconds > maxDurationSeconds)) {
            const validationErrorMsg = `Skipping trade for ${proposedTrade.instrument}: Proposed duration ${proposedTrade.durationSeconds}s is outside valid range [${minDurationSeconds}s - ${maxDurationSeconds}s] for intraday offering.`;
            logAutomatedTradingEvent(validationErrorMsg);
            newActiveTradesBatch.push({
              id: `error_validation_${uuidv4()}`,
              instrument: proposedTrade.instrument as ForexCryptoCommodityInstrumentType,
              derivSymbol, action: proposedTrade.action, stake: proposedTrade.stake,
              durationSeconds: proposedTrade.durationSeconds, reasoning: proposedTrade.reasoning,
              entrySpot: 0, buyPrice: 0, startTime: Date.now(), status: 'error_validation',
              validationError: validationErrorMsg,
            } as ActiveAutomatedTrade);
            continue;
          }

          logAutomatedTradingEvent(`Validation passed for ${proposedTrade.instrument}. Proceeding to place trade.`);

          const tradeDetails: any = { // Using 'any' for TradeDetails as its definition is implicit in deriv.ts
            symbol: derivSymbol,
            contract_type: proposedTrade.action,
            duration: proposedTrade.durationSeconds, // Use AI's proposed duration in seconds
            duration_unit: 's',                     // Unit is seconds
            amount: proposedTrade.stake,
            currency: "USD",
            basis: "stake",
            token: currentToken!, // Checked non-null at function start
          };

          logAutomatedTradingEvent(`Placing ${proposedTrade.action} on ${proposedTrade.instrument} for $${proposedTrade.stake}, Duration: ${proposedTrade.durationSeconds}s`);
          const tradeResult = await placeTrade(tradeDetails, currentTargetAccountId!); // Checked non-null at function start
          logAutomatedTradingEvent(`Trade placed for ${proposedTrade.instrument}: ${proposedTrade.action}, Stake: $${proposedTrade.stake}, Deriv ID: ${tradeResult.contract_id}, Duration: ${proposedTrade.durationSeconds}s`);

          if (selectedDerivAccountType && currentTargetAccountId) {
            fetchBalanceForAccount(currentTargetAccountId, selectedDerivAccountType);
          }

          newActiveTradesBatch.push({
            id: String(tradeResult.contract_id),
            instrument: proposedTrade.instrument as ForexCryptoCommodityInstrumentType,
            derivSymbol: tradeDetails.symbol,
            action: proposedTrade.action,
            stake: proposedTrade.stake,
            durationSeconds: proposedTrade.durationSeconds,
            reasoning: proposedTrade.reasoning,
            entrySpot: tradeResult.entry_spot,
            buyPrice: tradeResult.buy_price,
            startTime: Date.now(),
            longcode: tradeResult.longcode,
            status: 'open',
            monitoringRetryCount: 0,
          } as ActiveAutomatedTrade);

        } catch (error: any) { // This catch now handles errors from getContractOfferings and placeTrade
          logAutomatedTradingEvent(`Error processing or placing trade for ${proposedTrade.instrument} ${proposedTrade.action}: ${error.message}`);
          toast({ title: `Trade Processing Error (${proposedTrade.instrument})`, description: error.message, variant: "destructive" });
          newActiveTradesBatch.push({
            id: `error_processing_${uuidv4()}`, // Changed prefix to distinguish from pure placement error
            instrument: proposedTrade.instrument as ForexCryptoCommodityInstrumentType,
            derivSymbol,
            action: proposedTrade.action,
            stake: proposedTrade.stake,
            durationSeconds: proposedTrade.durationSeconds,
            reasoning: proposedTrade.reasoning + ` (Processing/Placement Error: ${error.message})`,
            entrySpot: 0, buyPrice: 0, startTime: Date.now(),
            status: 'error_placement', // Keep status as error_placement for UI consistency
            validationError: error.message,
          } as ActiveAutomatedTrade);
        }
      }

      setActiveAutomatedTrades(newActiveTradesBatch); // Correctly use newActiveTradesBatch

      // Updated post-loop logic
      const allTradesFailedOrInvalid = newActiveTradesBatch.length > 0 && newActiveTradesBatch.every(
        t => t.status === 'error_placement' || t.status === 'error_validation'
      );

      if (allTradesFailedOrInvalid) {
        logAutomatedTradingEvent("All proposed trades failed validation or placement. Stopping session.");
        toast({
          title: "AI Auto-Trade Update",
          description: "AI proposed trades, but none could be successfully validated or placed. Please review AI strategy or market conditions.",
          variant: "warning",
          duration: 7000
        });
        setIsAutoTradingActive(false);
      } else if (newActiveTradesBatch.some(t => t.status === 'open')) {
        logAutomatedTradingEvent("Trade placement phase complete. Monitoring active trades.");
      } else if (newActiveTradesBatch.length > 0) {
        logAutomatedTradingEvent("No trades were successfully placed (all failed validation or other errors). Stopping session.");
        // This case is now effectively covered by `allTradesFailedOrInvalid` if those are the only non-open states.
        // If other non-open, non-error states could exist and lead here, a generic toast might be needed.
        // For now, the specific toast for allTradesFailedOrInvalid is primary.
        // If this condition is met, it implies all trades in the batch are errors, which allTradesFailedOrInvalid already covers.
        // However, to be safe, if this specific log indicates a distinct scenario, we could add a different toast,
        // but it's likely redundant if 'error_placement' and 'error_validation' are the only non-'open' outcomes.
        // Let's assume the first toast is sufficient if allTradesFailedOrInvalid is true.
        // If this path is reached and allTradesFailedOrInvalid was false, it's an unexpected state or a trade has a status other than open/error.
        setIsAutoTradingActive(false);
      }
      // Note: If newActiveTradesBatch is empty AND strategyResult.tradesToExecute was also empty,
      // an earlier check `if (!strategyResult || strategyResult.tradesToExecute.length === 0)` already handles this
      // by logging "AI found no optimal trades" and setting setIsAutoTradingActive(false).
      // This new logic correctly handles cases where trades were proposed but all failed validation/placement.

    } catch (error: any) {
      logAutomatedTradingEvent(`Error during AI strategy or trade placement: ${error.message}`);
      toast({ title: "AI Auto-Trading Error", description: error.message, variant: "destructive" });
      setIsAutoTradingActive(false);
      setIsPreparingAutoTrades(false);
    }
  }, [
    authStatus, selectedDerivAccountType, autoTradeTotalStake, currentBalance, tradingMode, selectedAiStrategyId,
    userInfo, derivDemoAccountId, derivRealAccountId, consecutiveAiCallCount, lastAiCallTimestamp, toast, router,
    selectedStopLossPercentage, logAutomatedTradingEvent, setActiveAutomatedTrades, setIsAutoTradingActive,
    setIsPreparingAutoTrades, setConsecutiveAiCallCount, setLastAiCallTimestamp, fetchBalanceForAccount
  ]);

  const handleStopAiAutoTrade = useCallback(async () => {
    logAutomatedTradingEvent("Attempting to stop AI Auto-Trading session...");
    setIsAutoTradingActive(false); // This will stop the monitoring useEffect

    const currentToken = userInfo?.derivApiToken?.access_token;
    const currentTargetAccountId = selectedDerivAccountType === 'demo' ? derivDemoAccountId : derivRealAccountId;

    if (!currentToken || !currentTargetAccountId) {
      logAutomatedTradingEvent("Cannot sell open contracts: Deriv token or account ID missing.");
      toast({ title: "Stop Failed", description: "Account details missing.", variant: "destructive" });
      // Update local status anyway for any trades that were 'active'
      setActiveAutomatedTrades(prevTrades =>
        prevTrades.map(trade =>
          trade.status === 'open'
            ? { ...trade, status: 'cancelled' as ActiveAutomatedTrade['status'], finalProfitLoss: -trade.stake, isSettled: true, exitTime: Date.now() }
            : trade
        )
      );
      return;
    }

    logAutomatedTradingEvent("Processing open trades for potential selling...");
    const sellPromises = activeAutomatedTrades.map(async (trade) => {
      if (trade.status === 'open' && trade.isValidToSell && trade.sellPrice && !trade.id.startsWith('error_')) {
        // currentToken and currentTargetAccountId for sellContract are defined at the start of handleStopAiAutoTrade
        try {
          logAutomatedTradingEvent(`Attempting to sell contract ID: ${trade.id} for ${trade.instrument} at price ${trade.sellPrice}`);
          await sellContract(Number(trade.id), trade.sellPrice, currentToken!, currentTargetAccountId!); // Added non-null assertion
          logAutomatedTradingEvent(`Successfully sold contract ID: ${trade.id}`);
          toast({ title: "Trade Sold", description: `Contract ${trade.instrument} (ID: ${trade.id}) sold.`, variant: "default" });
          return { ...trade, status: 'sold' as ActiveAutomatedTrade['status'], isSettled: true, exitTime: Date.now() }; // P&L would be determined by sell_price vs buy_price, handled by monitoring or BE
        } catch (error: any) {
          logAutomatedTradingEvent(`Error selling contract ID: ${trade.id}. Error: ${error.message}`);
          toast({ title: "Sell Error", description: `Failed to sell ${trade.instrument} (ID: ${trade.id}): ${error.message}`, variant: "destructive" });
          return { ...trade, status: 'cancelled' as ActiveAutomatedTrade['status'], finalProfitLoss: -trade.stake, isSettled: true, exitTime: Date.now(), validationError: `Manual stop sell error: ${error.message}` }; // Mark as cancelled if sell fails
        }
      } else if (trade.status === 'open' && !trade.id.startsWith('error_')) {
        // If not valid to sell or no sell price, mark as cancelled (manual stop)
        logAutomatedTradingEvent(`Contract ID: ${trade.id} (${trade.instrument}) was not sellable or had no sell price. Marking as cancelled.`);
        return { ...trade, status: 'cancelled' as ActiveAutomatedTrade['status'], finalProfitLoss: -trade.stake, isSettled: true, exitTime: Date.now(), reasoning: (trade.reasoning || "") + " Manually stopped (not sellable)." };
      }
      return trade; // Return unchanged if not open or already processed
    });

    const updatedTrades = await Promise.all(sellPromises);
    setActiveAutomatedTrades(updatedTrades);

    // RE-FETCH BALANCE AFTER SELLING
    if (selectedDerivAccountType && currentTargetAccountId) {
        fetchBalanceForAccount(currentTargetAccountId, selectedDerivAccountType);
    }

    logAutomatedTradingEvent("AI Auto-Trading session stopped.");
    toast({ title: "AI Auto-Trading Stopped", description: `Session for ${selectedDerivAccountType} account stopped.` });
  }, [activeAutomatedTrades, userInfo, selectedDerivAccountType, derivDemoAccountId, derivRealAccountId, toast, logAutomatedTradingEvent, setActiveAutomatedTrades, fetchBalanceForAccount, setIsAutoTradingActive]);
  
  // Real-time monitoring useEffect
  useEffect(() => {
    if (!isAutoTradingActive || activeAutomatedTrades.length === 0) {
      return; // No active session or no trades to monitor
    }

    const monitoringInterval = setInterval(async () => {
      let currentToken: string | undefined | null = null;
      let currentTargetAccountId: string | undefined | null = null;

      if (selectedDerivAccountType === 'demo') {
        currentToken = userInfo?.derivDemoApiToken;
        currentTargetAccountId = derivDemoAccountId;
      } else if (selectedDerivAccountType === 'real') {
        currentToken = userInfo?.derivRealApiToken;
        currentTargetAccountId = derivRealAccountId;
      }

      if (!currentToken || !currentTargetAccountId) {
        logAutomatedTradingEvent(`Monitoring paused: ${selectedDerivAccountType} account token or ID missing.`);
        // Potentially stop isAutoTradingActive if this persists, or alert user more strongly.
        return;
      }

      let tradesUpdated = false;
      const updatedTrades = await Promise.all(
        activeAutomatedTrades.map(async (trade) => {
          if (trade.status !== 'open' || trade.id.startsWith('error_')) {
            return trade; // Only monitor 'open' trades that are not placement errors
          }

          try {
            const contractStatusData = await getContractStatus(Number(trade.id), currentToken, currentTargetAccountId);
            tradesUpdated = true;

            const newLocalStatus = mapDerivStatusToLocal(contractStatusData.status);
            const isSettled = newLocalStatus === 'won' || newLocalStatus === 'lost' || newLocalStatus === 'sold' || newLocalStatus === 'cancelled';

            const updatedTrade: ActiveAutomatedTrade = {
              ...trade,
              status: newLocalStatus,
              currentPrice: contractStatusData.current_spot ?? trade.currentPrice,
              currentProfitLoss: contractStatusData.profit, // Deriv profit might be absolute or percentage
              currentProfitLossPercentage: contractStatusData.profit_percentage,
              isValidToSell: contractStatusData.is_valid_to_sell === 1,
              sellPrice: contractStatusData.sell_price,
              isSettled: isSettled,
              exitTime: isSettled ? (contractStatusData.exit_tick_time ? contractStatusData.exit_tick_time * 1000 : Date.now()) : undefined,
              finalProfitLoss: isSettled ? contractStatusData.profit : undefined,
              longcode: contractStatusData.longcode ?? trade.longcode,
              monitoringRetryCount: 0, // Reset retry count on success
            };

            if (isSettled && !trade.isSettled) { // If just settled on this update
              logAutomatedTradingEvent(`Trade ${trade.instrument} (ID: ${trade.id}) settled. Status: ${newLocalStatus}, P/L: $${updatedTrade.finalProfitLoss?.toFixed(2)}`);
              toast({
                title: `Trade Settled: ${trade.instrument}`,
                description: `Status: ${newLocalStatus}, P/L: $${updatedTrade.finalProfitLoss?.toFixed(2)}`,
                variant: updatedTrade.finalProfitLoss && updatedTrade.finalProfitLoss > 0 ? "default" : "destructive",
              });
              setProfitsClaimable(prev => ({
                totalNetProfit: prev.totalNetProfit + (updatedTrade.finalProfitLoss || 0),
                tradeCount: prev.tradeCount + 1,
                winningTrades: newLocalStatus === 'won' ? prev.winningTrades + 1 : prev.winningTrades,
                losingTrades: (newLocalStatus === 'lost' || (newLocalStatus === 'sold' && (updatedTrade.finalProfitLoss || 0) < 0)) ? prev.losingTrades + 1 : prev.losingTrades,
              }));
              // RE-FETCH BALANCE AFTER SETTLEMENT
              if (selectedDerivAccountType && currentTargetAccountId) {
                 fetchBalanceForAccount(currentTargetAccountId, selectedDerivAccountType);
              }
            }
            return updatedTrade;

          } catch (error: any) {
            logAutomatedTradingEvent(`Error monitoring trade ${trade.instrument} (ID: ${trade.id}): ${error.message}`);
            const retryCount = trade.monitoringRetryCount || 0;
            if (retryCount >= MAX_MONITORING_RETRIES) {
              logAutomatedTradingEvent(`Max retries reached for trade ${trade.id}. Marking as error_monitoring.`);
              toast({ title: "Monitoring Error", description: `Max retries for ${trade.instrument} (ID: ${trade.id}).`, variant: "destructive" });
              tradesUpdated = true;
              return { ...trade, status: 'error_monitoring' as ActiveAutomatedTrade['status'], validationError: error.message, isSettled: true, finalProfitLoss: -trade.stake };
            } else {
              tradesUpdated = true; // an update to retry count
              return { ...trade, monitoringRetryCount: retryCount + 1 };
            }
          }
        })
      );

      if (tradesUpdated) {
        setActiveAutomatedTrades(updatedTrades);
      }

      // Check if all trades are settled to stop the session
      const allSettled = updatedTrades.every(t => t.isSettled || t.id.startsWith('error_'));
      if (allSettled && updatedTrades.length > 0) {
        logAutomatedTradingEvent("All active trades have been settled. Stopping AI session.");
        setIsAutoTradingActive(false); // Stop the session
        toast({ title: "AI Session Complete", description: "All trades are settled." });
      }

    }, 5000); // Interval duration for monitoring (e.g., 5 seconds)

    return () => clearInterval(monitoringInterval); // Cleanup interval on unmount or when dependencies change
  }, [
    activeAutomatedTrades, isAutoTradingActive, userInfo, selectedDerivAccountType, derivDemoAccountId,
    derivRealAccountId, setActiveAutomatedTrades, setProfitsClaimable, logAutomatedTradingEvent, toast,
    setIsAutoTradingActive, fetchBalanceForAccount, mapDerivStatusToLocal // Added setIsAutoTradingActive and mapDerivStatusToLocal
  ]);

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
            balance={currentBalance ?? 0} // Pass 0 if null, as BalanceDisplay expects number
            selectedAccountType={selectedDerivAccountType}
            displayAccountId={selectedDerivAccountType === 'demo' ? derivDemoAccountId : derivRealAccountId}
            syncStatus={selectedDerivAccountType === 'demo' ? demoSyncStatus : realSyncStatus}
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
           {automatedTradingLog.length > 0 && (
            <Card className="shadow-lg max-h-96 overflow-y-auto">
              <CardHeader><CardTitle>AI Trading Log</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {automatedTradingLog.map((log, index) => (
                    <p key={index} className="font-mono text-xs">{log}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

if (typeof window !== 'undefined' && !(window as any).uuidv4) {
  (window as any).uuidv4 = uuidv4;
}
// Cache busting comment
