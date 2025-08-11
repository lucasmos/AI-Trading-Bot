import { AI_TRADING_STRATEGIES } from "@/config/ai-strategies"; // Import to potentially create a literal type

export type VolatilityInstrumentType =
  | 'Volatility 10 Index'
  | 'Volatility 25 Index'
  | 'Volatility 50 Index'
  | 'Volatility 75 Index'
  | 'Volatility 100 Index'
  | 'Volatility 10 (1s) Index'
  | 'Volatility 25 (1s) Index'
  | 'Volatility 50 (1s) Index'
  | 'Volatility 75 (1s) Index'
  | 'Volatility 100 (1s) Index'
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

export type ForexCommodityInstrumentType =
  | 'EUR/USD'
  | 'GBP/USD'
  | 'XAU/USD' // Gold
  | 'Palladium/USD'
  | 'Platinum/USD'
  | 'Silver/USD';

export type VolatilityIndexInstrumentType = VolatilityInstrumentType | JumpInstrumentType;

export type InstrumentType = ForexCommodityInstrumentType | VolatilityIndexInstrumentType;

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
  stochastic?: { k: number; d: number };
  williamsR?: number;
  cci?: number;
};

export interface AutomatedTradeProposal { // For binary options auto-trading (Forex/Commodity)
  instrument: ForexCommodityInstrumentType;
  action: 'CALL' | 'PUT';
  stake: number;
  durationString: string;
  reasoning: string;
  avatarUrl?: string;
}

export interface ActiveAutomatedTrade { // For binary options auto-trading
  id: string; // Deriv's contract_id (ensure it's a string if Deriv ID is number)
  instrument: ForexCommodityInstrumentType;
  derivSymbol: string;
  action: 'CALL' | 'PUT';
  stake: number;
  durationSeconds: number; // Remains for internal calculations/display consistency
  durationString?: string; // Added to store the AI's output duration string
  reasoning?: string;

  // From placeTrade response
  entrySpot: number;
  buyPrice: number;
  startTime: number; // Timestamp
  longcode?: string;

  // Status & Monitoring Fields
  status: 'open' | 'won' | 'lost' | 'sold' | 'cancelled' | 'error_monitoring' | 'error_placement';
  currentPrice?: number;
  currentProfitLoss?: number;
  currentProfitLossPercentage?: number;
  isValidToSell?: boolean;
  sellPrice?: number;
  stopLossPrice?: number; // Ensure this is present

  // Settlement Fields
  exitTime?: number;
  finalProfitLoss?: number;
  isSettled?: boolean;

  validationError?: string;
  monitoringRetryCount?: number; // For retry logic
}

export interface ProfitsClaimable {
  totalNetProfit: number;
  tradeCount: number;
  winningTrades: number;
  losingTrades: number;
}

// For AI Flow (Binary options auto-trading - Forex/Commodity)
export type AutomatedTradingStrategyInput = {
  totalStake: number;
  instruments: ForexCommodityInstrumentType[];
  tradingMode: TradingMode;
  aiStrategyId?: string; // The selected AI trading strategy ID.
  stopLossPercentage?: number; // User-defined stop-loss percentage (e.g., 1 to 50)
  instrumentTicks: Record<ForexCommodityInstrumentType, PriceTick[]>;
  instrumentIndicators?: Record<ForexCommodityInstrumentType, InstrumentIndicatorData>;
  formattedIndicatorsString?: string;
  instrumentOfferings?: {
    [key: string]: { // Instrument symbol e.g., "frxEURUSD"
      rise_fall?: string[];     // Existing: Array of valid duration strings e.g., ["15m", "1h"]
      tradingTimesData?: any;  // Raw trading times data from API
      tradingTimesDataString?: string; // New: JSON string representation or error/unavailable message
    }
  };
};

export interface AutomatedTradingStrategyOutput {
  tradesToExecute: AutomatedTradeProposal[];
  overallReasoning: string;
}

// For AI Flow (Volatility auto-trading)
export interface VolatilityTradeProposal {
  instrument: InstrumentType;
  action: 'CALL' | 'PUT'; // This is the AI's directional suggestion for simple Rise/Fall in current page simulation
  stake: number;
  durationSeconds: number;
  reasoning: string;
  // If AI were to output specific Deriv contract types, it would be here.
  // For now, the page simulation implies Rise/Fall based on CALL/PUT.
}

export interface ActiveAutomatedVolatilityTrade { // Updated to match Deriv's trading table format
  id: string;
  instrument: InstrumentType;
  tradeType: string; // e.g., "Higher/Lower", "Even/Odd", "Over/Under", "Rise/Fall", "Touch/No Touch"
  entryPrice: number; // Price when trade began
  exitPrice?: number; // Price when trade concluded (only for completed trades)
  buyPrice: number; // Price of the contract (stake amount)
  profitLoss?: number; // Profit/Loss after trade completion
  status: 'active' | 'won' | 'lost' | 'pending' | 'cancelled' | 'pending_execution' | 'closed_manual' | 'lost_duration' | 'failed_placement' | 'lost_stoploss'; // Extended status for volatility trading
  startTime: number; // When trade started
  endTime?: number; // When trade ended (for completed trades)
  duration?: number; // Trade duration in seconds
  reasoning?: string; // AI reasoning for the trade

  // Legacy fields for backward compatibility (will be removed gradually)
  stake?: number; // Use buyPrice instead
  durationSeconds?: number; // Use duration instead
  stopLossPrice?: number; // Not used in volatility trading
  currentPrice?: number; // For live price updates
  pnl?: number; // Use profitLoss instead

  // New fields for better type display and future real trading
  derivContractType: string; // e.g., "CALL", "PUT", "DIGITEVEN", "DIGITOVER" - this will store proposal.action for now
  userSelectedTradeType?: string; // e.g., "RiseFall", "DigitsEvenOdd" - if available from UI selection
  barrier?: string | number | null; // Store barrier if applicable (e.g. for DigitsOverUnder)
  error?: string; // To store placement errors for real trades
  actionDirection?: 'CALL' | 'PUT'; // For simulation trades to track direction
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
  avatarUrl?: string | null; // Consider consolidating with photoURL or image from NextAuth
  photoURL?: string | null; // From Firebase Auth
  image?: string | null;    // From NextAuth session.user
  authMethod?: AuthMethod | null;
  provider?: string; // From NextAuth account

  // Deriv Specific fields - these should align with what's passed from NextAuth session and used in AuthContext
  derivAccessToken?: string; // The raw access token from Deriv (usually the one for the currently selected real/demo account type for general API calls)
  derivApiToken?: { // Structured token, potentially for easier use or if it includes more than just access_token
    access_token: string;
    // Potentially other token-related fields like expiry if available/needed later
  };
  derivAccountId?: string | null; // The currently selected Deriv account ID (CR... or VRTC...)
  derivDemoAccountId?: string | null;
  derivRealAccountId?: string | null;
  derivDemoBalance?: number | null;
  derivRealBalance?: number | null;
  selectedDerivAccountType?: 'demo' | 'real' | null; // User's preferred account type to use by default

  derivDemoApiToken?: string | null; // Token specifically for the Demo account
  derivRealApiToken?: string | null; // Token specifically for the Real account

  // Older Deriv fields from a previous structure - review if still needed or can be deprecated
  derivId?: string | null; // Potentially the Deriv User ID (providerAccountId)
  derivEmail?: string | null;
  derivPreferredLanguage?: string | null;
  derivAccountList?: DerivAccount[]; // Full list from API
  derivActiveAccount?: DerivAccountShort | null; // Simplified active account
  derivActiveLoginId?: string | null; // Redundant if derivAccountId is the selected one
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
  symbol: string;
  status: 'OPEN' | 'WON' | 'LOST' | 'CLOSED';

  // Deriv API fields (matching Prisma schema)
  derivContractId?: bigint;
  derivAccountId?: string;
  accountType?: 'demo' | 'real';
  derivLongcode?: string;
  derivShortcode?: string;
  derivBuyPrice?: number; // Integer (cents) as per user preference
  derivPayout?: number;
  derivPurchaseTime?: bigint;
  derivSellPrice?: number;
  derivSellTime?: bigint;
  derivContractType?: string;
  derivUnderlyingSymbol?: string;
  derivDurationType?: string;
  derivAppId?: number;
  derivTransactionId?: bigint;

  metadata?: Record<string, any>; // For AI reasoning and other trade details
}

export interface HistoricalTrade extends Trade {}

// NEW: Deriv API-based trade history interface (matches error-logs.md structure)
export interface DerivTradeRecord {
  // Core Deriv API fields (from error-logs.md)
  contract_id: string; // e.g., "279319508848"
  longcode: string; // e.g., "Win payout if the last digit of Volatility 10 Index is even after 1 tick."
  shortcode: string; // e.g., "DIGITEVEN_R_10_143.91_1745298644_1T"
  buy_price: number; // e.g., 3
  payout: number; // e.g., 4.04
  purchase_time: number; // Unix timestamp e.g., 1745277401
  sell_price?: number; // e.g., 4.04 (0 for losses)
  sell_time?: number; // Unix timestamp e.g., 1745277404
  contract_type: string; // e.g., "DIGITOVER", "DIGITEVEN", "DIGITODD", "DIGITUNDER"
  underlying_symbol: string; // e.g., "R_10", "R_50", "R_100"
  duration_type: string; // e.g., "ticks"
  app_id: number; // e.g., 52152
  transaction_id: string; // e.g., "556773095768"

  // Computed fields for UI display
  profit_loss: number; // sell_price - buy_price (computed)
  status: 'won' | 'lost' | 'open' | 'cancelled'; // Derived from sell_price
  trade_type_display: string; // Human-readable trade type
  instrument_display: string; // Human-readable instrument name
  duration_display: string; // e.g., "1 tick", "2 ticks"

  // Timestamps for sorting and display
  purchase_date: string; // YYYY-MM-DD format
  purchase_time_display: string; // HH:MM:SS format
  sell_date?: string; // YYYY-MM-DD format
  sell_time_display?: string; // HH:MM:SS format
}

export interface TradeHistoryData {
  // Core trade identification
  contract_id: string;

  // Deriv API fields (matching DerivTradeRecord)
  longcode: string;
  shortcode: string;
  buy_price: number;
  payout: number;
  purchase_time: number;
  sell_price?: number;
  sell_time?: number;
  contract_type: string;
  underlying_symbol: string;
  duration_type: string;
  app_id: number;
  transaction_id: string;

  // Computed fields
  profit_loss: number;
  status: 'won' | 'lost' | 'open';
  trade_type_display: string;
  instrument_display: string;
  duration_display: string;

  // Formatted timestamps for display
  purchase_date: string; // YYYY-MM-DD format
  purchase_time_display: string; // HH:MM:SS format
  sell_date?: string; // YYYY-MM-DD format
  sell_time_display?: string; // HH:MM:SS format
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
