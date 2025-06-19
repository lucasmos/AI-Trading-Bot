'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { useSession } from 'next-auth/react';
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
import {
  getCandles, placeTrade, instrumentToDerivSymbol, getTradingDurations,
  type PlaceTradeResponse, type DerivContractStatusData, getContractStatus,
  sellContract, getContractOfferings, type DerivContractOffering,
  getGlobalTradingOfferings, // Added for global offerings
  type TradingDurationsData, // Added for global offerings type
  getTradingTimes // Added for fetching trading times
} from '@/services/deriv';
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
// Old getMarketStatus will be removed, new ones imported
import {
  getMarketStatus,
  getCurrentMarketStatus,
  formatTradingHoursForDisplay,
  type DerivSymbolSpecificTradingData
} from '@/lib/market-hours';
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
  // Ensure we extract only leading numbers for parseInt
  const value = parseInt(durationString);
  if (isNaN(value)) return 0;

  if (durationString.endsWith('s')) return value;
  if (durationString.endsWith('m')) return value * 60;
  if (durationString.endsWith('h')) return value * 60 * 60;
  if (durationString.endsWith('d')) return value * 24 * 60 * 60;
  if (durationString.endsWith('t')) return value; // Handle ticks - return tick count

  // Fallback if just a number (treat as seconds, as per previous logic)
  // This check should be specific to ensure it's ONLY a number string
  if (/^\d+$/.test(durationString)) return value;

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
  const { data: session, update: updateNextAuthSession } = useSession();
  
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType>(FOREX_CRYPTO_COMMODITY_INSTRUMENTS[0]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [selectedAiStrategyId, setSelectedAiStrategyId] = useState<string>(DEFAULT_AI_STRATEGY_ID);
  const [tradeDuration, setTradeDuration] = useState<TradeDuration>('5m');
  const [availableDurations, setAvailableDurations] = useState<string[]>(['5m', '10m', '15m', '30m', '1h']);
  const [isLoadingDurations, setIsLoadingDurations] = useState<boolean>(false);
  const [isTradeable, setIsTradeable] = useState<boolean>(true);
  const [stakeAmount, setStakeAmount] = useState<number>(10);

  // const [isMarketOpenForSelected, setIsMarketOpenForSelected] = useState<boolean>(true); // Old state
  // const [marketStatusMessage, setMarketStatusMessage] = useState<string | null>(null); // Old state

  const [currentInstrumentTradingTimes, setCurrentInstrumentTradingTimes] = useState<DerivSymbolSpecificTradingData | { error: string } | null>(null);
  const [isCurrentInstrumentMarketOpen, setIsCurrentInstrumentMarketOpen] = useState<boolean | null>(null);
  const [marketStatusDisplayMessage, setMarketStatusDisplayMessage] = useState<string>('');
  const [isLoadingTradingTimes, setIsLoadingTradingTimes] = useState<boolean>(false);
  const [allTradingTimesData, setAllTradingTimesData] = useState<any | { error: string } | null>(null);
  const [isLoadingAllTradingTimes, setIsLoadingAllTradingTimes] = useState<boolean>(false);

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

  const [globalOfferingsData, setGlobalOfferingsData] = useState<TradingDurationsData | null>(null);
  const [isLoadingGlobalOfferings, setIsLoadingGlobalOfferings] = useState<boolean>(false);
  const [globalOfferingsError, setGlobalOfferingsError] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const logAutomatedTradingEvent = useCallback((message: string) => {
    setAutomatedTradingLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }, [setAutomatedTradingLog]); // Added setAutomatedTradingLog to dependency array

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
    if (selectedDerivAccountType === 'demo' && demoToken && derivDemoAccountId) {
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
        },
        (error) => {
          console.error('[DashboardPage] Demo Balance Listener Error:', error);
        },
        (status, message) => {
          setDemoSyncStatus(status);
          if (message) console.log(`[DashboardPage] Demo Listener Status: ${status} - ${message}`);
          if (status === 'error' && message) {
            toast({ title: 'Demo Balance Sync Issue', description: message, variant: 'destructive'});
          }
          if (status === 'connected' || status === 'error' || status === 'disconnected' || status === 'idle') {
            setIsLoadingDemoBalance(false);
          } else {
            setIsLoadingDemoBalance(true);
          }
        },
        (closeEvent) => {
          console.log(`[DashboardPage] Demo Balance Listener Closed. Code: ${closeEvent.code}, Clean: ${closeEvent.wasClean}`);
        }
      );
    } else {
       if (demoBalanceListenerRef.current) {
          demoBalanceListenerRef.current.close();
          demoBalanceListenerRef.current = null;
          console.log('[DashboardPage] Demo Balance Listener explicitly closed due to account type mismatch or missing token/ID.');
       }
       setFreshDemoBalance(derivDemoBalance ?? DEFAULT_PAPER_BALANCE);
       setIsLoadingDemoBalance(false);
       setDemoSyncStatus('idle');
    }
    return () => {
      if (demoBalanceListenerRef.current) {
        demoBalanceListenerRef.current.close();
        demoBalanceListenerRef.current = null;
      }
    };
  }, [userInfo?.derivDemoApiToken, derivDemoAccountId, toast, derivDemoBalance, selectedDerivAccountType, userInfo?.derivAccessToken]);

  useEffect(() => {
    const realToken = userInfo?.derivRealApiToken;
    if (selectedDerivAccountType === 'real' && realToken && derivRealAccountId) {
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
        },
        (error) => {
          console.error('[DashboardPage] Real Balance Listener Error:', error);
        },
        (status, message) => {
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
        (closeEvent) => {
          console.log(`[DashboardPage] Real Balance Listener Closed. Code: ${closeEvent.code}, Clean: ${closeEvent.wasClean}`);
        }
      );
    } else {
      if (realBalanceListenerRef.current) {
          realBalanceListenerRef.current.close();
          realBalanceListenerRef.current = null;
          console.log('[DashboardPage] Real Balance Listener explicitly closed due to account type mismatch or missing token/ID.');
      }
      setFreshRealBalance(derivLiveBalance ?? DEFAULT_LIVE_BALANCE);
      setIsLoadingRealBalance(false);
      setRealSyncStatus('idle');
    }
    return () => {
      if (realBalanceListenerRef.current) {
        realBalanceListenerRef.current.close();
        realBalanceListenerRef.current = null;
      }
    };
  }, [userInfo?.derivRealApiToken, derivRealAccountId, toast, derivLiveBalance, selectedDerivAccountType, userInfo?.derivAccessToken]);

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

      if (session && session.user) {
        const updatedUserFields: Record<string, any> = {};
        if (type === 'demo') {
          updatedUserFields.derivDemoBalance = data.balance;
        } else if (type === 'real') {
          updatedUserFields.derivRealBalance = data.balance;
        }

        // Also update the main derivAccessToken and derivAccountId if the balance being updated
        // corresponds to the currently selected account type.
        // This ensures that if AuthContext re-derives its userInfo from session, these are consistent.
        if (type === selectedDerivAccountType) {
           if (type === 'demo' && userInfo?.derivDemoApiToken) {
              updatedUserFields.derivAccessToken = userInfo.derivDemoApiToken;
              updatedUserFields.derivAccountId = derivDemoAccountId;
           } else if (type === 'real' && userInfo?.derivRealApiToken) {
              updatedUserFields.derivAccessToken = userInfo.derivRealApiToken;
              updatedUserFields.derivAccountId = derivRealAccountId;
           }
        }

        console.log(`[DashboardPage] Updating NextAuth session with new ${type} balance: ${data.balance}`);
        await updateNextAuthSession({
          ...session,
          user: {
            ...session.user,
            ...updatedUserFields,
          },
        });
      } else {
        console.warn("[DashboardPage] Cannot update session balance: session or session.user is null.");
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
  }, [
    userInfo,
    session,
    updateNextAuthSession,
    selectedDerivAccountType,
    derivDemoAccountId,
    derivRealAccountId,
    toast,
    setIsLoadingDemoBalance,
    setIsLoadingRealBalance,
    setFreshDemoBalance,
    setFreshRealBalance
]);

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

  useEffect(() => {
    const fetchInitialGlobalData = async () => {
      let currentToken: string | undefined | null = null;
      if (userInfo) {
        if (selectedDerivAccountType === 'demo' && userInfo.derivDemoApiToken) {
          currentToken = userInfo.derivDemoApiToken;
        } else if (selectedDerivAccountType === 'real' && userInfo.derivRealApiToken) {
          currentToken = userInfo.derivRealApiToken;
        } else {
          currentToken = userInfo.derivAccessToken;
        }
      }

      // Fetch Global Offerings
      if (userInfo && !globalOfferingsData && !isLoadingGlobalOfferings) {
        setIsLoadingGlobalOfferings(true);
        setGlobalOfferingsError(null); // Clear previous errors
        logAutomatedTradingEvent('Fetching global trading offerings...');
        try {
          // Use currentToken or undefined if null, as getGlobalTradingOfferings might expect string | undefined
          const offeringsData = await getGlobalTradingOfferings(currentToken || undefined);
          if (offeringsData && !offeringsData.error) {
            setGlobalOfferingsData(offeringsData);
            logAutomatedTradingEvent("[DashboardPage] Global trading offerings fetched and cached successfully.");
          } else {
            const errorMsg = offeringsData?.error || 'Failed to fetch global offerings (empty response).';
            setGlobalOfferingsError(errorMsg);
            setGlobalOfferingsData(null);
            logAutomatedTradingEvent(`[DashboardPage] Error fetching global trading offerings: ${errorMsg}`);
            // toast({ title: "Offerings Load Error", description: errorMsg, variant: "destructive" }); // Optionally toast here or rely on other UI
          }
        } catch (err: any) {
          const errorMsg = err.message || 'Exception while fetching global offerings.';
          setGlobalOfferingsError(errorMsg);
          setGlobalOfferingsData(null);
          logAutomatedTradingEvent(`[DashboardPage] Error fetching global trading offerings: ${errorMsg}`);
          // toast({ title: "Offerings Load Error", description: errorMsg, variant: "destructive" }); // Optionally toast here
        } finally {
          setIsLoadingGlobalOfferings(false);
        }
      }

      // Fetch All Trading Times - TARGET SECTION FOR FIXING MULTIPLE TRADING TIMES FETCH
      if (currentToken && allTradingTimesData === null && !isLoadingAllTradingTimes) {
        setIsLoadingAllTradingTimes(true);
        logAutomatedTradingEvent('Fetching all trading times data (once)...');
        try {
          const timesData = await getTradingTimes('today', currentToken);
          if (timesData && typeof timesData === 'object' && 'error' in timesData) {
            setAllTradingTimesData({ error: timesData.error });
            logAutomatedTradingEvent(`Error fetching all trading times: ${timesData.error}`);
          } else if (timesData) {
            setAllTradingTimesData(timesData);
            logAutomatedTradingEvent('All trading times data fetched successfully.');
          } else {
            setAllTradingTimesData({ error: 'Failed to fetch all trading times (empty or unexpected response).' });
            logAutomatedTradingEvent('Error fetching all trading times: Empty or unexpected response.');
          }
        } catch (err: any) {
          const errorMsg = err.message || 'Exception while fetching all trading times.';
          setAllTradingTimesData({ error: errorMsg });
          logAutomatedTradingEvent(`Error fetching all trading times: ${errorMsg}`);
        } finally {
          setIsLoadingAllTradingTimes(false);
        }
      }
    };

    if (userInfo) { // Only run if userInfo is available
      fetchInitialGlobalData();
    }
  }, [userInfo, selectedDerivAccountType, allTradingTimesData, globalOfferingsData, logAutomatedTradingEvent, toast]); // isLoadingGlobalOfferings and isLoadingAllTradingTimes removed from deps

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
  // REMOVED OLD useEffect for getMarketStatus

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
    // Old status update removed, new useEffects will handle it
    setAiRecommendation(null); 
  };

  // OLD useEffect that fetched individual trading times for currentInstrument is REMOVED.

  // New useEffect to derive currentInstrumentTradingTimes from allTradingTimesData
  useEffect(() => {
    if (isLoadingAllTradingTimes) {
      // Wait for allTradingTimesData to be loaded
      setCurrentInstrumentTradingTimes(null); // Or a loading state specific to current instrument
      return;
    }
    if (!allTradingTimesData) {
      setCurrentInstrumentTradingTimes(null);
      logAutomatedTradingEvent("All trading times data is not available to derive current instrument times.");
      return;
    }
    if ('error' in allTradingTimesData) {
      setCurrentInstrumentTradingTimes({ error: `Failed to load global trading times: ${allTradingTimesData.error}` });
      logAutomatedTradingEvent(`Cannot derive current instrument times due to global fetch error: ${allTradingTimesData.error}`);
      return;
    }

    const derivSymbol = instrumentToDerivSymbol(currentInstrument);
    let foundSymbolData: DerivSymbolSpecificTradingData | null = null;

    if (allTradingTimesData && Array.isArray(allTradingTimesData.markets)) {
      for (const market of allTradingTimesData.markets) {
        if (market && Array.isArray(market.submarkets)) {
          for (const submarket of market.submarkets) {
            if (submarket && Array.isArray(submarket.symbols)) {
              const symbolData = submarket.symbols.find((s: any) => s && s.symbol === derivSymbol);
              if (symbolData) {
                foundSymbolData = {
                  times: symbolData.times,
                  events: symbolData.events,
                  feed_license: symbolData.feed_license,
                  trading_days: symbolData.trading_days // Ensure trading_days is included
                };
                break;
              }
            }
          }
        }
        if (foundSymbolData) break;
      }
    }

    if (foundSymbolData) {
      setCurrentInstrumentTradingTimes(foundSymbolData);
      logAutomatedTradingEvent(`Successfully derived trading times for ${derivSymbol}.`);
    } else {
      const errorMessage = `Trading times data not found for ${derivSymbol} in the global list.`;
      setCurrentInstrumentTradingTimes({ error: errorMessage });
      logAutomatedTradingEvent(errorMessage);
    }
  }, [currentInstrument, allTradingTimesData, isLoadingAllTradingTimes, logAutomatedTradingEvent]);

  // Update Market Status Periodically based on derived currentInstrumentTradingTimes
  useEffect(() => {
    const updateStatus = () => {
      if (isLoadingTradingTimes || isLoadingAllTradingTimes) { // Check both loading flags
        setMarketStatusDisplayMessage(`Loading trading hours for ${currentInstrument}...`);
        setIsCurrentInstrumentMarketOpen(null);
        return;
      }

      if (!currentInstrumentTradingTimes) {
        // This case might be hit if allTradingTimesData is loaded but currentInstrument data couldn't be derived.
        // Or if allTradingTimesData itself is null (and not loading).
        setMarketStatusDisplayMessage('Trading hours data not yet available for the selected instrument.');
        setIsCurrentInstrumentMarketOpen(null);
        return;
      }

      if ('error' in currentInstrumentTradingTimes) {
        setIsCurrentInstrumentMarketOpen(false);
        setMarketStatusDisplayMessage(`Error determining trading hours: ${currentInstrumentTradingTimes.error}`);
        return;
      }

      // Type guard to ensure currentInstrumentTradingTimes is DerivSymbolSpecificTradingData
      // The check for `.times` is important because an empty object might be passed if symbol not found in global allTradingTimesData
      if (currentInstrumentTradingTimes && currentInstrumentTradingTimes.times) {
        const status = getCurrentMarketStatus(currentInstrumentTradingTimes as DerivSymbolSpecificTradingData, new Date());
        setIsCurrentInstrumentMarketOpen(status.isOpen);

        const formattedTimes = formatTradingHoursForDisplay(currentInstrumentTradingTimes as DerivSymbolSpecificTradingData, ['GMT', 'UTC', 'Africa/Nairobi']);
        let displayMessage = `${status.isOpen ? 'Market Open' : 'Market Closed'}`;

        if (status.eventDescription && !status.nextEventTimeGMT) { // E.g. "Market is Closed (Market event: Closed all day)"
             displayMessage += ` (${status.eventDescription})`;
        } else if (status.nextEventTimeGMT && status.nextEventType) {
            displayMessage += `. Next ${status.nextEventType} at ${status.nextEventTimeGMT} GMT`;
            if (status.eventDescription && status.eventDescription !== `Market session ${status.nextEventType}`) { // Avoid redundant session open/close
                displayMessage += ` (${status.eventDescription})`;
            }
        }
        // Always append detailed formatted times if available, unless it's a simple 24/7 message
        if (status.message !== "Market Open (24/7)") {
             displayMessage += ` Details: ${formattedTimes}`;
        } else if (status.message === "Market Open (24/7)" && status.eventDescription) {
            // For 24/7 markets that might have a specific event description (e.g. upcoming maintenance)
             displayMessage = `${status.message} (${status.eventDescription})`;
        } else {
            displayMessage = status.message; // Use the direct "Market Open (24/7)"
        }

        setMarketStatusDisplayMessage(displayMessage);
      } else {
        setIsCurrentInstrumentMarketOpen(false);
        // This message implies that currentInstrumentTradingTimes was not null, not an error object, but also didn't have .times
        // This could happen if the extraction logic from allTradingTimesData failed to find the symbol but didn't set an error.
        setMarketStatusDisplayMessage('Trading hours data is incomplete or in an unexpected format for the selected instrument.');
      }
    };

    updateStatus();
    const intervalId = setInterval(updateStatus, 60000);
    return () => clearInterval(intervalId);
  }, [currentInstrument, currentInstrumentTradingTimes, isLoadingTradingTimes, isLoadingAllTradingTimes]); // Added currentInstrument

  useEffect(() => {
    const processDurationsFromGlobalOfferings = () => {
      if (!currentInstrument || !userInfo) {
        setAvailableDurations([]);
        setIsTradeable(false);
        setTradeDuration('');
        setIsLoadingDurations(false);
        return;
      }

      if (isLoadingGlobalOfferings) {
        setIsLoadingDurations(true);
        return;
      }

      if (globalOfferingsError || !globalOfferingsData) {
        logAutomatedTradingEvent(`Error or no global offerings data available for ${currentInstrument}. Error: ${globalOfferingsError}`);
        toast({ title: "Offerings Error", description: `Could not load duration data: ${globalOfferingsError || 'No offerings data'}.`, variant: "destructive" });
        setAvailableDurations([]);
        setIsTradeable(false);
        setTradeDuration('');
        setIsLoadingDurations(false);
        return;
      }

      setIsLoadingDurations(true);

      const derivSymbol = instrumentToDerivSymbol(currentInstrument);
      let symbolMarketOfferings: import('@/services/deriv').SymbolTradeDurations | undefined;

      for (const market of globalOfferingsData) {
        for (const symGroup of market.data) {
          if (Array.isArray(symGroup.symbol) && symGroup.symbol.find(s => s.name === derivSymbol)) {
            symbolMarketOfferings = symGroup;
            break;
          } else if (!Array.isArray(symGroup.symbol) && symGroup.symbol.name === derivSymbol) {
            symbolMarketOfferings = symGroup;
            break;
          }
        }
        if (symbolMarketOfferings) break;
      }

      if (!symbolMarketOfferings) {
        logAutomatedTradingEvent(`Symbol ${derivSymbol} for ${currentInstrument} not found in global offerings.`);
        setAvailableDurations([]);
        setIsTradeable(false);
        setTradeDuration('');
        setIsLoadingDurations(false);
        return;
      }

      const riseFallTradeType = symbolMarketOfferings.trade_durations.find(td => td.trade_type.name === 'rise_fall');

      if (!riseFallTradeType) {
        logAutomatedTradingEvent(`No 'rise_fall' trade type found for ${currentInstrument}.`);
        setAvailableDurations([]);
        setIsTradeable(false);
        setTradeDuration('');
        setIsLoadingDurations(false);
        return;
      }

      if (!riseFallTradeType.durations || riseFallTradeType.durations.length === 0) {
        logAutomatedTradingEvent(`No durations listed for 'rise_fall' on ${currentInstrument}.`);
        setAvailableDurations([]);
        setIsTradeable(false);
        setTradeDuration('');
        setIsLoadingDurations(false);
        return;
      }

      const newDurationsSet = new Set<string>();
      riseFallTradeType.durations.forEach(detail => { // detail is TradingDurationDetail { display_name, max, min, name }
        if (['s', 'm', 'h', 'd', 't'].includes(detail.name)) {
          // Add the 'min' duration value as a specific offering if positive
          if (detail.min > 0) {
            newDurationsSet.add(`${detail.min}${detail.name}`);
          }

          // For non-tick units ('s', 'm', 'h', 'd'), if max is different from min and positive, add it.
          if (detail.name !== 't' && detail.max > 0 && detail.max !== detail.min) {
            newDurationsSet.add(`${detail.max}${detail.name}`);
          }
          // For tick units ('t'), if max is greater than min (min already added if >0)
          else if (detail.name === 't' && detail.max > detail.min) {
            if ((detail.max - detail.min) <= 10) { // Small range: add intermediate ticks
              for (let i = detail.min + 1; i <= detail.max; i++) {
                newDurationsSet.add(`${i}${detail.name}`);
              }
            } else { // Large range: add max if different from min (min already added)
              // The condition detail.max > 0 && detail.max !== detail.min is implicitly true if detail.max > detail.min
              newDurationsSet.add(`${detail.max}${detail.name}`);
            }
          }
        }
      });

      const sortedDurations = Array.from(newDurationsSet).sort((a, b) => parseDurationToSeconds(a) - parseDurationToSeconds(b));

      setAvailableDurations(sortedDurations);
      setIsTradeable(sortedDurations.length > 0);

      if (sortedDurations.length > 0) {
        if (!sortedDurations.includes(tradeDuration) || tradeDuration === '') {
          setTradeDuration(sortedDurations[0] as TradeDuration);
        }
      } else {
        // This case should be covered by the checks above, but as a fallback:
        logAutomatedTradingEvent(`No valid 'rise_fall' durations generated for ${currentInstrument} after processing.`);
        setTradeDuration('');
        setIsTradeable(false);
      }

      setIsLoadingDurations(false);
    };

    processDurationsFromGlobalOfferings();
  }, [
    currentInstrument,
    globalOfferingsData,
    isLoadingGlobalOfferings,
    globalOfferingsError,
    userInfo,
    toast,
    tradeDuration,
    setTradeDuration,
    setAvailableDurations,
    setIsLoadingDurations,
    setIsTradeable,
    logAutomatedTradingEvent
  ]);

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
  }, [currentInstrument, tradingMode, selectedAiStrategyId, authStatus, selectedDerivAccountType, userInfo, toast, router, setIsFetchingManualRecommendation, setAiRecommendation, logAutomatedTradingEvent]); // Added logAutomatedTradingEvent to dep array

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
      setIsPreparingAutoTrades(false);
      setIsAutoTradingActive(false);
      return;
    }

    // Add initial checks for globalOfferingsData
    if (isLoadingGlobalOfferings) {
      toast({ title: "System Busy", description: "Trading offerings are currently being loaded. Please try again shortly.", variant: "default" });
      setIsPreparingAutoTrades(false);
      setIsAutoTradingActive(false);
      return;
    }
    if (!globalOfferingsData || globalOfferingsError) {
      toast({ title: "Offerings Unavailable", description: `Trading offerings data is not available or failed to load: ${globalOfferingsError || 'No data'}. Cannot start session.`, variant: "destructive" });
      logAutomatedTradingEvent(`Aborted: Global offerings data not available. Error: ${globalOfferingsError || 'No data'}`);
      setIsPreparingAutoTrades(false);
      setIsAutoTradingActive(false);
      return;
    }

    // Removed duplicateisLoadingGlobalOfferings and !globalOfferingsData || globalOfferingsError checks here

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

    let instrumentsToTrade: ForexCryptoCommodityInstrumentType[];

    if (allTradingTimesData && !('error' in allTradingTimesData) && allTradingTimesData.markets) {
      logAutomatedTradingEvent("Using detailed trading times for pre-filtering instruments for AI session.");
      instrumentsToTrade = FOREX_CRYPTO_COMMODITY_INSTRUMENTS.filter(instrument => {
        if (['BTC/USD', 'ETH/USD'].includes(instrument as string)) {
          return true; // Always include these crypto as 24/7
        }
        const derivSymbol = instrumentToDerivSymbol(instrument);
        let specificSymbolTimesData: DerivSymbolSpecificTradingData | null = null;

        // Logic to extract specificSymbolTimesData for derivSymbol from allTradingTimesData
        // This is similar to the extraction logic used later for instrumentOfferingsDataForAI
        for (const market of allTradingTimesData.markets) {
          if (market && Array.isArray(market.submarkets)) {
            for (const submarket of market.submarkets) {
              if (submarket && Array.isArray(submarket.symbols)) {
                const symbolData = submarket.symbols.find((s: any) => s && s.symbol === derivSymbol);
                if (symbolData) {
                  specificSymbolTimesData = {
                    times: symbolData.times,
                    events: symbolData.events,
                    feed_license: symbolData.feed_license,
                    trading_days: symbolData.trading_days
                  };
                  break;
                }
              }
            }
          }
          if (specificSymbolTimesData) break;
        }

        if (specificSymbolTimesData) {
          const marketStatus = getCurrentMarketStatus(specificSymbolTimesData, new Date());
          return marketStatus.isOpen;
        }
        // Fallback if specific data not found in allTradingTimesData (should be rare if allTradingTimesData is comprehensive)
        logAutomatedTradingEvent(`Specific trading times not found for ${instrument} in global data for pre-filter. Falling back to general status.`);
        return getMarketStatus(instrument).isOpen;
      });
    } else {
      logAutomatedTradingEvent("Global trading times not available or error during fetch. Using general market status for pre-filtering instruments for AI session.");
      if (allTradingTimesData && 'error' in allTradingTimesData) {
        logAutomatedTradingEvent(`Error in global trading times data: ${allTradingTimesData.error}`);
      }
      instrumentsToTrade = FOREX_CRYPTO_COMMODITY_INSTRUMENTS.filter(inst => getMarketStatus(inst).isOpen || ['BTC/USD', 'ETH/USD'].includes(inst as string));
    }

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

    // Inside startAutomatedTradingSession, before const strategyInput = { ... };
    const instrumentOfferingsDataForAI: {
      [key: string]: {
        availableContracts?: any[], // Will be populated according to new schema
        tradingTimesData?: any,
        isMarketCurrentlyOpen?: boolean
      }
    } = {};

    if (globalOfferingsData) {
      for (const userFriendlyInstrumentName of instrumentsToTrade) {
        const derivSymbol = instrumentToDerivSymbol(userFriendlyInstrumentName as InstrumentType);

        // Initialize for the current symbol
        instrumentOfferingsDataForAI[derivSymbol] = {
          availableContracts: [],
          // tradingTimesData and isMarketCurrentlyOpen will be populated later in this loop
        };

        let symbolMarketOfferings: import('@/services/deriv').SymbolTradeDurations | undefined;
        if (globalOfferingsData) {
          for (const market of globalOfferingsData) {
            for (const symGroup of market.data) {
              if (symGroup.symbol && Array.isArray(symGroup.symbol) && symGroup.symbol.find(s => s && s.name === derivSymbol)) {
                symbolMarketOfferings = symGroup;
                break;
              } else if (symGroup.symbol && !Array.isArray(symGroup.symbol) && (symGroup.symbol as any).name === derivSymbol) {
                // Handle cases where symGroup.symbol is a single object, not an array (based on API snippet for Cryptos)
                if((symGroup.symbol as any).name === derivSymbol) {
                    symbolMarketOfferings = symGroup;
                    break;
                }
              }
            }
            if (symbolMarketOfferings) break;
          }
        }

        if (symbolMarketOfferings && symbolMarketOfferings.trade_durations) {
          symbolMarketOfferings.trade_durations.forEach(tradeTypeOffering => {
            const contractDetails: any = { // Build according to new Zod schema for availableContracts
              tradeTypeName: tradeTypeOffering.trade_type.name,
              displayName: tradeTypeOffering.trade_type.display_name,
              availableDurations: [],
            };

            if (tradeTypeOffering.durations && tradeTypeOffering.durations.length > 0) {
              const durationsSet = new Set<string>();
              tradeTypeOffering.durations.forEach(detail => {
                if (detail.name === 'no_expiry') {
                  durationsSet.add('no_expiry');
                } else if (['s', 'm', 'h', 'd', 't'].includes(detail.name)) {
                  if (detail.min > 0) {
                    durationsSet.add(`${detail.min}${detail.name}`);
                  }
                  // For non-tick, non-no_expiry, if max is different and positive, add it.
                  if (detail.name !== 't' && detail.name !== 'no_expiry' && detail.max > 0 && detail.max !== detail.min) {
                    durationsSet.add(`${detail.max}${detail.name}`);
                  }
                  // For tick units, handle range if small, or just min/max if large
                  else if (detail.name === 't' && detail.max > detail.min) {
                    if ((detail.max - detail.min) <= 10) { // Small range
                      for (let i = detail.min + 1; i <= detail.max; i++) { // Include min (already added) and max
                        durationsSet.add(`${i}${detail.name}`);
                      }
                    } else { // Large range
                       if (detail.max !== detail.min) durationsSet.add(`${detail.max}${detail.name}`);
                    }
                  }
                }
              });
              contractDetails.availableDurations = Array.from(durationsSet).sort((a, b) => {
                if (a === 'no_expiry') return -1; // Keep 'no_expiry' first if present
                if (b === 'no_expiry') return 1;
                return parseDurationToSeconds(a) - parseDurationToSeconds(b);
              });
            }

            // Add min/max multiplier if applicable (example for 'multiplier' trade type)
            if (tradeTypeOffering.trade_type.name === 'multiplier') {
              // Assuming min/max multiplier might be directly on tradeTypeOffering or its durations for multipliers
              // This part needs to align with how Deriv provides min/max for multipliers in trading_durations API
              // For now, we'll leave it empty and AI can use general knowledge or it can be added if structure known
              // Example: contractDetails.minMultiplier = tradeTypeOffering.min_multiplier;
              // Example: contractDetails.maxMultiplier = tradeTypeOffering.max_multiplier;
            }
            instrumentOfferingsDataForAI[derivSymbol].availableContracts!.push(contractDetails);
          });
        } else {
          logAutomatedTradingEvent(`No trade durations found for ${derivSymbol} in global offerings, or symbol not found.`);
        }

        // The existing logic for populating tradingTimesData and isMarketCurrentlyOpen should follow AFTER this block.
        // Ensure that instrumentOfferingsDataForAI[derivSymbol] is initialized before trying to push to availableContracts.
        // Instead, use data from allTradingTimesData
        let specificSymbolTimesData: DerivSymbolSpecificTradingData | { error: string } | undefined;
        if (allTradingTimesData && !('error' in allTradingTimesData) && allTradingTimesData.markets) {
          let foundSymbolData = null;
          for (const market of allTradingTimesData.markets) {
            if (market && Array.isArray(market.submarkets)) {
              for (const submarket of market.submarkets) {
                if (submarket && Array.isArray(submarket.symbols)) {
                  const symbolEntry = submarket.symbols.find((s: any) => s && s.symbol === derivSymbol);
                  if (symbolEntry) {
                    foundSymbolData = { // Constructing DerivSymbolSpecificTradingData structure
                      times: symbolEntry.times,
                      events: symbolEntry.events,
                      feed_license: symbolEntry.feed_license,
                      trading_days: symbolEntry.trading_days // This should already be here from previous step, verifying
                    };
                    break;
                  }
                }
              }
            }
            if (foundSymbolData) break;
          }
          if (foundSymbolData) {
            specificSymbolTimesData = foundSymbolData;
          } else {
            specificSymbolTimesData = { error: `Trading times not found for ${derivSymbol} in global data.` };
          }
        } else if (allTradingTimesData && 'error' in allTradingTimesData) {
          specificSymbolTimesData = { error: `Failed to fetch global trading times: ${allTradingTimesData.error}` };
        } else {
          specificSymbolTimesData = { error: 'Global trading times data is unavailable or in unexpected format.' };
        }

        // Assign to the instrumentOfferingsDataForAI map
        // Ensure the entry for derivSymbol exists from rise/fall duration processing
        if (!instrumentOfferingsDataForAI[derivSymbol]) {
            instrumentOfferingsDataForAI[derivSymbol] = {}; // Initialize if it wasn't (e.g. if no rise/fall)
        }
        instrumentOfferingsDataForAI[derivSymbol].tradingTimesData = specificSymbolTimesData;

        // Determine and add isMarketCurrentlyOpen
        let marketCurrentlyOpen = false; // Default to false
        if (specificSymbolTimesData && !('error'in specificSymbolTimesData)) {
          const marketStatus = getCurrentMarketStatus(specificSymbolTimesData as DerivSymbolSpecificTradingData, new Date());
          marketCurrentlyOpen = marketStatus.isOpen;
          logAutomatedTradingEvent(`Market status for ${derivSymbol}: ${marketStatus.isOpen ? 'OPEN' : 'CLOSED'}. Message: ${marketStatus.message}`);
        } else {
          logAutomatedTradingEvent(`Market status for ${derivSymbol}: UNKNOWN (no trading times data). Assuming closed for AI.`);
        }
        instrumentOfferingsDataForAI[derivSymbol].isMarketCurrentlyOpen = marketCurrentlyOpen;

        // Override for known 24/7 instruments like BTC/USD, ETH/USD
        const knownTwentyFourSevenSymbols = ['cryBTCUSD', 'cryETHUSD'];
        // Potentially add Deriv's synthetic Volatility Index symbols here if they are part of instrumentsToTrade
        // and if their tradingTimesData is also sparse leading to incorrect 'CLOSED' status.
        // For now, focusing on the explicitly mentioned cryBTCUSD and cryETHUSD.

        if (knownTwentyFourSevenSymbols.includes(derivSymbol)) {
          if (instrumentOfferingsDataForAI[derivSymbol].isMarketCurrentlyOpen === false) {
            logAutomatedTradingEvent(`OVERRIDE: Forcing market status to OPEN for 24/7 instrument ${derivSymbol} as ` +
                                     `getCurrentMarketStatus initially reported it closed (likely due to sparse trading_times data for 24/7 markets).`);
          } else {
            logAutomatedTradingEvent(`INFO: Market status for 24/7 instrument ${derivSymbol} correctly determined as OPEN or was already true.`);
          }
          instrumentOfferingsDataForAI[derivSymbol].isMarketCurrentlyOpen = true;
        }
        logAutomatedTradingEvent(specificSymbolTimesData && !('error' in specificSymbolTimesData) ? `Using cached trading times for ${derivSymbol}.` : `Trading times for ${derivSymbol}: ${(specificSymbolTimesData as {error: string}).error}`);
      }
    }

    const strategyInput: FlowAutomatedTradingStrategyInput = { // Use FlowAutomatedTradingStrategyInput
      totalStake: autoTradeTotalStake,
      instruments: instrumentsToTrade.filter(inst => instrumentTicksData[inst] && instrumentTicksData[inst].length > 0),
      tradingMode,
      aiStrategyId: selectedAiStrategyId,
      stopLossPercentage: selectedStopLossPercentage,
      instrumentTicks: instrumentTicksData,
      instrumentIndicators: instrumentIndicatorsData,
      instrumentOfferings: instrumentOfferingsDataForAI, // Added instrumentOfferings
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
        let isValidProposal = false;
        let validationMessage = `Validating proposal for ${proposedTrade.instrument} (${derivSymbol}): ${proposedTrade.tradeType}, Stake: $${proposedTrade.stake}, Duration: ${proposedTrade.durationString || 'N/A'}, Multiplier: ${proposedTrade.multiplier || 'N/A'}`;
        logAutomatedTradingEvent(validationMessage);

        const offeringsForSymbol = instrumentOfferingsDataForAI[derivSymbol];
        let matchedContractTypeOffering = null;

        if (offeringsForSymbol && offeringsForSymbol.availableContracts) {
          // Try to find a direct match or a related match (e.g. CALL/PUT map to a rise_fall offering)
          matchedContractTypeOffering = offeringsForSymbol.availableContracts.find(c =>
            c.tradeTypeName === proposedTrade.tradeType ||
            ( (proposedTrade.tradeType === 'CALL' || proposedTrade.tradeType === 'PUT') && c.tradeTypeName === 'rise_fall' ) ||
            ( (proposedTrade.tradeType === 'MULTUP' || proposedTrade.tradeType === 'MULTDOWN') && c.tradeTypeName === 'multiplier' )
          );
        }

        if (!matchedContractTypeOffering) {
          isValidProposal = false;
          validationMessage = `Trade type '${proposedTrade.tradeType}' not found or not available for ${derivSymbol}.`;
        } else {
          const tradeTypeForValidation = matchedContractTypeOffering.tradeTypeName; // Use the name from offerings

          if (tradeTypeForValidation === 'rise_fall' || proposedTrade.tradeType === 'CALL' || proposedTrade.tradeType === 'PUT') {
            if (!proposedTrade.durationString) {
              isValidProposal = false;
              validationMessage = `Duration string is required for ${proposedTrade.tradeType} on ${derivSymbol}.`;
            } else if (!matchedContractTypeOffering.availableDurations || !matchedContractTypeOffering.availableDurations.includes(proposedTrade.durationString)) {
              isValidProposal = false;
              validationMessage = `Proposed duration '${proposedTrade.durationString}' for ${derivSymbol} (${proposedTrade.tradeType}) is NOT in its available durations: [${matchedContractTypeOffering.availableDurations?.join(', ') ?? 'None'}].`;
            } else {
              isValidProposal = true;
              validationMessage = `Proposal for ${derivSymbol} (${proposedTrade.tradeType}) with duration '${proposedTrade.durationString}' is valid.`;
            }
          } else if (tradeTypeForValidation === 'multiplier' || proposedTrade.tradeType === 'MULTUP' || proposedTrade.tradeType === 'MULTDOWN') {
            if (typeof proposedTrade.multiplier !== 'number' || proposedTrade.multiplier <= 0) {
              isValidProposal = false;
              validationMessage = `A valid positive multiplier value is required for '${proposedTrade.tradeType}' on ${derivSymbol}. Received: ${proposedTrade.multiplier}`;
            } else if (matchedContractTypeOffering.minMultiplier && proposedTrade.multiplier < matchedContractTypeOffering.minMultiplier) {
              isValidProposal = false;
              validationMessage = `Proposed multiplier ${proposedTrade.multiplier} for ${derivSymbol} is less than minimum ${matchedContractTypeOffering.minMultiplier}.`;
            } else if (matchedContractTypeOffering.maxMultiplier && proposedTrade.multiplier > matchedContractTypeOffering.maxMultiplier) {
              isValidProposal = false;
              validationMessage = `Proposed multiplier ${proposedTrade.multiplier} for ${derivSymbol} is greater than maximum ${matchedContractTypeOffering.maxMultiplier}.`;
            } else {
              // Check if duration is 'no_expiry' or not provided, as expected for multipliers
              const hasNoExpiryDuration = matchedContractTypeOffering.availableDurations?.includes('no_expiry');
              if (proposedTrade.durationString && proposedTrade.durationString !== 'no_expiry' && hasNoExpiryDuration) {
                 validationMessage = `Warning: Duration string '${proposedTrade.durationString}' provided for multiplier on ${derivSymbol}, but 'no_expiry' is typical. Proceeding as duration is often ignored for multipliers by API.`;
                 isValidProposal = true; // Still valid, duration might be ignored by API
              } else if (!proposedTrade.durationString && !hasNoExpiryDuration) {
                 // This case is tricky: if no_expiry is NOT listed, but AI didn't provide a duration.
                 // For now, assume valid if multiplier params are okay, as "no_expiry" is the Deriv default for multipliers.
                 validationMessage = `Proposal for ${derivSymbol} (multiplier) is valid with multiplier ${proposedTrade.multiplier}. Duration is assumed 'no_expiry'.`;
                 isValidProposal = true;
              } else {
                isValidProposal = true;
                validationMessage = `Proposal for ${derivSymbol} (multiplier) with multiplier ${proposedTrade.multiplier} and duration '${proposedTrade.durationString || 'no_expiry'}' is valid.`;
              }
            }
          } else {
            isValidProposal = false; // Unhandled trade type from AI
            validationMessage = `Unhandled trade type '${proposedTrade.tradeType}' proposed by AI for ${derivSymbol}.`;
          }
        }
        logAutomatedTradingEvent(validationMessage);

        try {
          if (!isValidProposal) {
            newActiveTradesBatch.push({
              id: `error_validation_${uuidv4()}`,
              instrument: proposedTrade.instrument as ForexCryptoCommodityInstrumentType,
              derivSymbol,
              action: (proposedTrade.tradeType === 'MULTUP' || proposedTrade.tradeType === 'CALL') ? 'CALL' : 'PUT', // Map for display
              tradeType: proposedTrade.tradeType,
              stake: proposedTrade.stake,
              durationSeconds: proposedTrade.durationString ? parseDurationToSeconds(proposedTrade.durationString) : 0,
              durationString: proposedTrade.durationString,
              multiplier: proposedTrade.multiplier,
              takeProfit: proposedTrade.takeProfit,
              stopLoss: proposedTrade.stopLoss,
              reasoning: proposedTrade.reasoning,
              entrySpot: 0,
              buyPrice: 0,
              startTime: Date.now(),
              status: 'error_validation',
              validationError: validationMessage,
              stopLossPrice: 0,
              currentPrice: undefined,
              currentProfitLoss: undefined,
              sellPrice: undefined,
              finalProfitLoss: undefined,
            } as ActiveAutomatedTrade);
            continue;
          }

          const tradeDetails: any = {
            symbol: derivSymbol,
            contract_type: proposedTrade.tradeType, // Use the AI's proposed tradeType
            amount: proposedTrade.stake,
            currency: "USD",
            basis: "stake",
            token: currentToken!,
          };

          if (proposedTrade.tradeType === 'CALL' || proposedTrade.tradeType === 'PUT') {
            const durationMatch = proposedTrade.durationString!.match(/^(\d+)([smhdt])$/); // Assert non-null as it's validated for these types
            if (!durationMatch) { // Should not happen due to prior validation
              logAutomatedTradingEvent(`Critical Error: Invalid duration string '${proposedTrade.durationString}' for ${proposedTrade.tradeType} despite validation. Skipping.`);
              continue;
            }
            tradeDetails.duration = parseInt(durationMatch[1], 10);
            tradeDetails.duration_unit = durationMatch[2] as 's' | 'm' | 'h' | 'd' | 't';
          } else if (proposedTrade.tradeType === 'MULTUP' || proposedTrade.tradeType === 'MULTDOWN') {
            tradeDetails.multiplier = proposedTrade.multiplier;
            if (proposedTrade.takeProfit) tradeDetails.take_profit = proposedTrade.takeProfit;
            if (proposedTrade.stopLoss) tradeDetails.stop_loss = proposedTrade.stopLoss;
            // Duration and duration_unit are typically not sent for multipliers, or API ignores them.
            // If API requires "no_expiry" or similar, that would need to be handled.
          }

          logAutomatedTradingEvent(`Placing ${tradeDetails.contract_type} on ${proposedTrade.instrument} for $${proposedTrade.stake}, Multiplier: ${tradeDetails.multiplier || 'N/A'}, Duration: ${tradeDetails.duration || 'N/A'}${tradeDetails.duration_unit || ''}`);
          const tradeResult = await placeTrade(tradeDetails, currentTargetAccountId!);
          logAutomatedTradingEvent(`Trade placed for ${proposedTrade.instrument}: ${tradeDetails.contract_type}, Deriv ID: ${tradeResult.contract_id}`);

          if (selectedDerivAccountType && currentTargetAccountId) {
            fetchBalanceForAccount(currentTargetAccountId, selectedDerivAccountType);
          }

          newActiveTradesBatch.push({
            id: String(tradeResult.contract_id),
            instrument: proposedTrade.instrument as ForexCryptoCommodityInstrumentType,
            derivSymbol: tradeDetails.symbol,
            action: (proposedTrade.tradeType === 'MULTUP' || proposedTrade.tradeType === 'CALL') ? 'CALL' : 'PUT', // Map for display
            tradeType: proposedTrade.tradeType,
            stake: proposedTrade.stake,
            durationSeconds: proposedTrade.durationString ? parseDurationToSeconds(proposedTrade.durationString) : 0, // Default 0 if no duration string (e.g. multipliers)
            durationString: proposedTrade.durationString,
            multiplier: proposedTrade.multiplier,
            takeProfit: proposedTrade.takeProfit,
            stopLoss: proposedTrade.stopLoss,
            reasoning: proposedTrade.reasoning,
            entrySpot: tradeResult.entry_spot,
            buyPrice: tradeResult.buy_price,
            stopLossPrice: (proposedTrade.tradeType === 'CALL' || proposedTrade.tradeType === 'MULTUP')
                           ? tradeResult.entry_spot * (1 - (selectedStopLossPercentage / 100))
                           : tradeResult.entry_spot * (1 + (selectedStopLossPercentage / 100)), // Simplified SL for now
            startTime: Date.now(),
            longcode: tradeResult.longcode,
            status: 'open',
            monitoringRetryCount: 0,
          } as ActiveAutomatedTrade);

        } catch (error: any) {
          logAutomatedTradingEvent(`Error processing or placing trade for ${proposedTrade.instrument} ${proposedTrade.tradeType}: ${error.message}`);
          toast({ title: `Trade Processing Error (${proposedTrade.instrument})`, description: error.message, variant: "destructive" });
          newActiveTradesBatch.push({
            id: `error_processing_${uuidv4()}`,
            instrument: proposedTrade.instrument as ForexCryptoCommodityInstrumentType,
            derivSymbol,
            action: (proposedTrade.tradeType === 'MULTUP' || proposedTrade.tradeType === 'CALL') ? 'CALL' : 'PUT', // Map for display
            tradeType: proposedTrade.tradeType,
            stake: proposedTrade.stake,
            durationSeconds: proposedTrade.durationString ? parseDurationToSeconds(proposedTrade.durationString) : 0,
            durationString: proposedTrade.durationString,
            multiplier: proposedTrade.multiplier,
            takeProfit: proposedTrade.takeProfit,
            stopLoss: proposedTrade.stopLoss,
            reasoning: proposedTrade.reasoning + ` (Processing/Placement Error: ${error.message})`,
            entrySpot: 0,
            buyPrice: 0,
            startTime: Date.now(),
            status: 'error_placement',
            validationError: error.message,
            stopLossPrice: 0,
          } as ActiveAutomatedTrade);
        }
      }

      setActiveAutomatedTrades(newActiveTradesBatch);

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
    selectedStopLossPercentage, setActiveAutomatedTrades, setIsAutoTradingActive,
    setIsPreparingAutoTrades, setConsecutiveAiCallCount, setLastAiCallTimestamp, fetchBalanceForAccount,
    logAutomatedTradingEvent, // Added logAutomatedTradingEvent
    globalOfferingsData, isLoadingGlobalOfferings, globalOfferingsError // Added global offerings states
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
        logAutomatedTradingEvent(`Monitoring: Checking for session completion. Trades in list: ${updatedTrades.length}. All settled: ${allSettled}.`);
        logAutomatedTradingEvent("All active trades have been settled. Stopping AI session.");
        setIsAutoTradingActive(false); // Stop the session
        toast({ title: "AI Session Complete", description: "All trades are settled." });
      }

    }, 5000); // Interval duration for monitoring (e.g., 5 seconds)

    return () => clearInterval(monitoringInterval); // Cleanup interval on unmount or when dependencies change
  }, [
    activeAutomatedTrades, isAutoTradingActive, userInfo, selectedDerivAccountType, derivDemoAccountId,
    derivRealAccountId, setActiveAutomatedTrades, setProfitsClaimable, toast,
    setIsAutoTradingActive, fetchBalanceForAccount, mapDerivStatusToLocal,
    logAutomatedTradingEvent // Added logAutomatedTradingEvent
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
                isMarketOpen={isCurrentInstrumentMarketOpen === true}
                marketStatusMessage={isLoadingTradingTimes ? 'Loading trading hours...' : marketStatusDisplayMessage}
            />
          {/* Example - place this where your current market status is shown */}
          <div className="text-sm p-2 text-center">
            {isLoadingTradingTimes ? (
              <p>Loading trading hours for {currentInstrument}...</p>
            ) : marketStatusDisplayMessage ? (
              <p className={isCurrentInstrumentMarketOpen === true ? 'text-green-500' : isCurrentInstrumentMarketOpen === false ? 'text-red-500' : 'text-gray-500'}>
                <strong>{currentInstrument}:</strong> {marketStatusDisplayMessage}
              </p>
            ) : (
              <p className="text-gray-500"><strong>{currentInstrument}:</strong> Market status unavailable.</p>
            )}
          </div>
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
                        <TableCell>${trade.stake?.toFixed(2) ?? '0.00'}</TableCell>
                        <TableCell>{trade.entrySpot?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) ?? '-'}</TableCell>
                        <TableCell>{trade.currentPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) ?? '-'}</TableCell>
                        <TableCell>{trade.stopLossPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) ?? '-'}</TableCell>
                        <TableCell>
                           <Badge variant={trade.status === 'active' ? 'secondary' : (trade.status === 'won' ? 'default' : 'destructive')}
                                  className={trade.status === 'active' ? 'bg-blue-500 text-white' : (trade.status === 'won' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600')}>
                            {trade.status}
                           </Badge>
                        </TableCell>
                        <TableCell className={(trade.isSettled ? trade.finalProfitLoss : trade.currentProfitLoss) !== undefined && (trade.isSettled ? trade.finalProfitLoss : trade.currentProfitLoss)! > 0 ? 'text-green-500' : (trade.isSettled ? trade.finalProfitLoss : trade.currentProfitLoss) !== undefined && (trade.isSettled ? trade.finalProfitLoss : trade.currentProfitLoss)! < 0 ? 'text-red-500' : ''}>
                          { (trade.isSettled ? trade.finalProfitLoss : trade.currentProfitLoss) !== undefined ? `$${(trade.isSettled ? trade.finalProfitLoss! : trade.currentProfitLoss!).toFixed(2)}` : '-' }
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
            isMarketOpenForSelected={isCurrentInstrumentMarketOpen === true} // Use new state
            marketStatusMessage={isLoadingTradingTimes ? 'Loading trading hours...' : marketStatusDisplayMessage} // Use new state
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
