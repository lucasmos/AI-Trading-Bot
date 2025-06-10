import { AI_TRADING_STRATEGIES } from "@/config/ai-strategies"; // Import to potentially create a literal type

export type VolatilityInstrumentType =
  | 'Volatility 10 Index'
  | 'Volatility 25 Index'
  | 'Volatility 50 Index'
  | 'Volatility 75 Index'
  | 'Volatility 100 Index'
  | 'Boom 500 Index'
  | 'Boom 600 Index'
  | 'Boom 900 Index'
  | 'Boom 1000 Index'
  | 'Crash 500 Index'
  | 'Crash 600 Index'
  | 'Crash 900 Index'
  | 'Crash 1000 Index'
  | 'Jump 10 Index'
  | 'Jump 25 Index'
  | 'Jump 50 Index'
  | 'Jump 75 Index'
  | 'Jump 100 Index';

export type ForexCryptoCommodityInstrumentType =
  | 'EUR/USD'
  | 'GBP/USD'
  | 'BTC/USD'
  | 'XAU/USD' // Gold
  | 'ETH/USD'
  | 'Palladium/USD'
  | 'Platinum/USD'
  | 'Silver/USD';

export type VolatilityIndexInstrumentType = string; // Refined later

export type InstrumentType = ForexCryptoCommodityInstrumentType | VolatilityIndexInstrumentType;

export type TradingMode = 'conservative' | 'balanced' | 'aggressive';

export type TradeDuration = '30s' | '1m' | '5m' | '15m' | '30m'; // For binary options

export type PaperTradingMode = 'paper' | 'live'; // 'live' means simulated live trading

export type PriceTick = {
  epoch: number;
  price: number;
  time: string; // ISO string or formatted time string
};

/**
 * @description Technical indicators for a specific instrument.
 */
export type InstrumentIndicatorData = {
  rsi?: number;
  macd?: { macd: number; signal: number; histogram: number };
  bollingerBands?: { upper: number; middle: number; lower: number };
  ema?: number;
  atr?: number;
};

export interface AutomatedTradeProposal { // For binary options auto-trading (Forex/Crypto/Commodity)
  instrument: ForexCryptoCommodityInstrumentType;
  action: 'CALL' | 'PUT';
  stake: number;
  durationSeconds: number; 
  reasoning: string;
  avatarUrl?: string;
}

export interface ActiveAutomatedTrade extends AutomatedTradeProposal { // For binary options auto-trading
  id: string;
  entryPrice: number;
  stopLossPrice: number; 
  startTime: number; 
  status: 'active' | 'won' | 'lost_duration' | 'lost_stoploss' | 'closed_manual';
  pnl?: number; 
  currentPrice?: number; 
}

export interface ProfitsClaimable {
  totalNetProfit: number;
  tradeCount: number;
  winningTrades: number;
  losingTrades: number;
}

// For AI Flow (Binary options auto-trading - Forex/Crypto/Commodity)
export type AutomatedTradingStrategyInput = {
  totalStake: number;
  instruments: ForexCryptoCommodityInstrumentType[];
  tradingMode: TradingMode;
  aiStrategyId?: string; // The selected AI trading strategy ID.
  stopLossPercentage?: number; // User-defined stop-loss percentage (e.g., 1 to 50)
  instrumentTicks: Record<ForexCryptoCommodityInstrumentType, PriceTick[]>; 
  instrumentIndicators?: Record<ForexCryptoCommodityInstrumentType, InstrumentIndicatorData>;
  formattedIndicatorsString?: string;
};

export interface AutomatedTradingStrategyOutput {
  tradesToExecute: AutomatedTradeProposal[];
  overallReasoning: string;
}

// For AI Flow (Volatility auto-trading)
export interface VolatilityTradeProposal {
  instrument: InstrumentType;
  action: 'CALL' | 'PUT';
  stake: number;
  durationSeconds: number;
  reasoning: string;
}

export interface ActiveAutomatedVolatilityTrade extends VolatilityTradeProposal {
  id: string;
  entryPrice: number;
  stopLossPrice: number;
  startTime: number;
  status: 'active' | 'won' | 'lost_duration' | 'lost_stoploss' | 'closed_manual';
  pnl?: number;
  currentPrice?: number;
}

export interface VolatilityTradingStrategyInput {
  totalStake: number;
  instruments: InstrumentType[];
  tradingMode: TradingMode;
  aiStrategyId?: string; // Added for selecting different core AI strategies
  instrumentTicks: Record<InstrumentType, PriceTick[]>;
}

export interface VolatilityTradingStrategyOutput {
  tradesToExecute: VolatilityTradeProposal[];
  overallReasoning: string;
}


// Authentication types
export type AuthMethod = 'firebase' | 'deriv' | 'google' | 'email' | null;

export interface UserInfo {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  photoURL?: string | null;
  paperBalance?: number;
  liveBalance?: number;
  authMethod?: AuthMethod | null;
  provider?: string;
  derivId?: string | null;
  derivEmail?: string | null;
  derivPreferredLanguage?: string | null;
  derivAccountList?: DerivAccount[];
  derivActiveAccount?: DerivAccountShort | null;
  derivDemoBalance?: number | null;
  derivRealBalance?: number | null;
  derivActiveLoginId?: string | null;
  derivDemoAccountId?: string | null;
  derivRealAccountId?: string | null;
  derivApiToken?: {
    access_token: string;
    // Potentially other token-related fields like expiry if available/needed later
  };
}

export type AuthStatus = 'authenticated' | 'unauthenticated' | 'pending';

// Payment types
export type TransactionType = 'deposit' | 'withdrawal';


// MT5 Trading Specific Types
export type MT5TradeDirection = 'BUY' | 'SELL';
export type MT5TradeStatus = 'PENDING_EXECUTION' | 'ACTIVE' | 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL' | 'CLOSED_TIMEOUT';
export type MT5HoldingPeriod = '1H' | '4H' | '1D' | '1W'; // Example holding periods

export interface MT5TradeOrder {
  id: string;
  instrument: InstrumentType; // Can be any type of instrument available for MT5
  direction: MT5TradeDirection;
  investment: number; // Amount invested
  entryPrice: number;
  takeProfit: number; // Price level
  stopLoss: number;   // Price level
  status: MT5TradeStatus;
  openTime: number; // timestamp
  closeTime?: number; // timestamp
  pnl?: number; // Profit or Loss, can be updated for active trades
  currentPrice?: number; // For UI display of active trades
  maxHoldingPeriodSeconds: number; // Calculated from MT5HoldingPeriod
  aiCommentaryDuringTrade?: string; // AI's initial reasoning for TP/SL
}

export interface MT5InstrumentAnalysis {
  instrument: InstrumentType; // Can be any type for MT5 analysis
  currentPrice: number;
  suggestedTakeProfit: number;
  suggestedStopLoss: number;
  aiCommentary: string;
  potentialDirection: 'UP' | 'DOWN' | 'UNCERTAIN';
}

export interface ClosedMT5Trade extends MT5TradeOrder {
  closeReason: string; // e.g., "Take Profit hit", "Stop Loss triggered", "Manually closed", "Max holding period reached"
}

export interface MT5AccountSummary {
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    marginLevelPercentage: number;
}

// Trade History Record
export type TradeCategory = 'forexCrypto' | 'volatility' | 'mt5';
export type TradeRecordStatus = 'won' | 'lost_duration' | 'lost_stoploss' | 'closed_manual' | 'cancelled'; // Add more specific statuses as needed

export interface TradeRecord {
  id: string;
  timestamp: number; // Store as number (Date.now()) for easier sorting
  instrument: InstrumentType;
  action: 'CALL' | 'PUT' | MT5TradeDirection; // Accommodate binary and MT5
  duration?: TradeDuration | string; // Duration string for binary, or descriptive for MT5 (e.g., holding period)
  stake: number; // Or investment for MT5
  entryPrice: number;
  exitPrice?: number | null; // Price at trade conclusion
  pnl: number; // Profit or Loss
  status: TradeRecordStatus;
  accountType: PaperTradingMode; // 'paper' or 'live'
  tradeCategory: TradeCategory;
  reasoning?: string; // Optional AI reasoning or manual note
}

export interface DerivAccount {
  account_category?: string;
  account_type?: string;
  balance?: number;
  created_at?: number;
  currency?: string;
  excluded_until?: number;
  is_disabled?: number;
  is_virtual?: number;
  landing_company_name?: string;
  loginid?: string;
  trading?: any;
  platform?: string;
}

export interface DerivAccountShort {
  id: string;
  isVirtual: boolean;
  currency?: string;
  balance?: number;
  typeLabel: string;
}

export interface Trade {
  id: string;
  userId: string;
  instrument: InstrumentType;
  type: 'CALL' | 'PUT';
  entryPrice: number;
  exitPrice?: number;
  stake: number;
  duration: number; // in seconds
  durationUnit: 's' | 'm' | 'h';
  entryTime: Date;
  exitTime?: Date;
  status: 'open' | 'won' | 'lost' | 'cancelled';
  profitOrLoss?: number;
  isPaperTrade: boolean;
  metadata?: Record<string, any>; // For any extra info, like AI reasoning snapshot
}

export interface HistoricalTrade extends Trade {}

export interface TradeHistoryData {
  tradeId: string;
  instrument: string;
  entryTime: string;
  exitTime: string;
  type: string;
  entryPrice: string;
  exitPrice: string;
  stake: string;
  profitOrLoss: string;
  status: string;
}

export interface AiRecommendation {
  action: 'CALL' | 'PUT' | 'HOLD';
  reasoning?: string;
  confidence?: number;
  suggestedStake?: number;
  suggestedDurationSeconds?: number;
}

export interface PaperTradingSettings {
  defaultStake: number;
  defaultDurationSeconds: number;
}

export interface MarketSentimentResponse {
    action: 'CALL' | 'PUT' | 'HOLD';
    confidence: number;
    reasoning: string;
    details?: {
        newsSentiment?: string;
        priceTrend?: string;
        rsi?: number;
        macd?: { macd: number; signal: number; histogram: number };
        bollingerBands?: { upper: number; middle: number; lower: number };
        sma20?: number;
        ema50?: number;
        atr14?: number;
    };
}

export interface MarketSentimentParams {
  symbol: string;
  tradingMode: 'conservative' | 'balanced' | 'aggressive';
  aiStrategyId?: string; // Added for selecting different core AI strategies
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  ema?: number;
  atr?: number;
}

export interface AiTradingSettings {
  selectedPair: string;
  tradeAmount: number;
  takeProfitPercentage: number;
  stopLossPercentage: number;
  useTrailingStop: boolean;
  trailingStopDistance: number;
  useTimeBasedStop: boolean;
  timeBasedStopMinutes: number;
  tradeIntervalSeconds: number;
  candleInterval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  maxOpenTrades: number;
  useMartingale: boolean;
  martingaleMultiplier: number;
  martingaleMaxAttempts: number;
  useRsi: boolean;
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  useMacd: boolean;
  macdFastPeriod: number;
  macdSlowPeriod: number;
  macdSignalPeriod: number;
  useBollingerBands: boolean;
  bbPeriod: number;
  bbStdDev: number;
}

export interface UserProfileSettings {
  displayName: string;
  avatarDataUrl?: string;
}

export interface CandleData {  // New object definition
  time: string;    // Formatted time string for display
  epoch: number;   // Epoch timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  // volume?: number; // Optional volume data
}

export interface MarketDataApiError {
  error: boolean;
  message: string;
  details?: any;
}

export interface ManualTradeExecutionParams {
  userId: string;
  instrument: InstrumentType; // Changed from TradingInstrument
  tradeType: 'CALL' | 'PUT'; // Or other relevant types
  stake: number;
  duration: number; // In seconds or minutes, clarify unit
  durationUnit: 's' | 'm' | 't'; // seconds, minutes, ticks
  status?: TradeRecordStatus; // Optional, default to PENDING or OPEN
  entryPrice?: number;
  exitPrice?: number;
  profit?: number;
  loss?: number;
  entryTime?: Date;
  exitTime?: Date;
  aiRecommendationId?: string; // Link to AI recommendation if applicable
}
