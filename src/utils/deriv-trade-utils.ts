/**
 * Utility functions for converting trade data to Deriv API structure
 * Based on the exact field structure from error-logs.md
 */

import { DerivTradeRecord } from '@/types';

/**
 * Convert contract type to human-readable trade type
 */
export function getTradeTypeDisplay(contractType: string): string {
  const typeMap: Record<string, string> = {
    'DIGITEVEN': 'Even',
    'DIGITODD': 'Odd',
    'DIGITOVER': 'Over',
    'DIGITUNDER': 'Under',
    'DIGITDIFF': 'Differs',
    'CALL': 'Rise',
    'PUT': 'Fall',
    'ONETOUCH': 'Touch',
    'NOTOUCH': 'No Touch'
  };
  
  return typeMap[contractType] || contractType;
}

/**
 * Convert underlying symbol to human-readable instrument name
 */
export function getInstrumentDisplay(underlyingSymbol: string): string {
  const instrumentMap: Record<string, string> = {
    'R_10': 'Volatility 10 Index',
    'R_25': 'Volatility 25 Index',
    'R_50': 'Volatility 50 Index',
    'R_75': 'Volatility 75 Index',
    'R_100': 'Volatility 100 Index',
    '1HZ10V': 'Volatility 10 (1s) Index',
    '1HZ25V': 'Volatility 25 (1s) Index',
    '1HZ50V': 'Volatility 50 (1s) Index',
    '1HZ75V': 'Volatility 75 (1s) Index',
    '1HZ100V': 'Volatility 100 (1s) Index',
    'JD10': 'Jump 10 Index',
    'JD25': 'Jump 25 Index',
    'JD50': 'Jump 50 Index',
    'JD75': 'Jump 75 Index',
    'JD100': 'Jump 100 Index'
  };
  
  return instrumentMap[underlyingSymbol] || underlyingSymbol;
}

/**
 * Extract duration from longcode
 */
export function getDurationDisplay(longcode: string): string {
  const tickMatch = longcode.match(/after (\d+) ticks?/);
  if (tickMatch) {
    const ticks = parseInt(tickMatch[1]);
    return `${ticks} tick${ticks > 1 ? 's' : ''}`;
  }
  
  const secondMatch = longcode.match(/after (\d+) seconds?/);
  if (secondMatch) {
    const seconds = parseInt(secondMatch[1]);
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }
  
  return 'Unknown duration';
}

/**
 * Determine trade status from sell_price or database status
 * Maps 'CANCELLED' to 'cancelled', unknown statuses default to lost/open based on sell_price
 */
export function getTradeStatus(sellPrice?: number, buyPrice?: number, dbStatus?: string): 'won' | 'lost' | 'open' | 'cancelled' {
  // Handle explicit CANCELLED status
  if (dbStatus && dbStatus.toUpperCase() === 'CANCELLED') {
    return 'cancelled';
  }
  
  // If no sell price, trade is still open
  if (sellPrice === undefined || sellPrice === null) {
    return 'open';
  }
  
  // If sell price is 0, trade was lost
  if (sellPrice === 0) {
    return 'lost';
  }
  
  // If sell price is greater than buy price, trade was won
  if (buyPrice && sellPrice > buyPrice) {
    return 'won';
  }
  
  // Default to lost for unknown cases
  return 'lost';
}

/**
 * Format Unix timestamp to date string (YYYY-MM-DD)
 * Returns empty string for falsy inputs
 */
export function formatDate(timestamp: number): string {
  if (timestamp === null || timestamp === undefined || isNaN(timestamp)) {
    return '';
  }
  const dateObj = new Date(timestamp * 1000);
  return dateObj.toISOString().slice(0, 10);
}

/**
 * Format Unix timestamp to time string (HH:MM:SS)
 * Returns empty string for falsy inputs
 */
export function formatTime(timestamp: number): string {
  if (timestamp === null || timestamp === undefined || isNaN(timestamp)) {
    return '';
  }
  const dateObj = new Date(timestamp * 1000);
  return dateObj.toISOString().slice(11, 19);
}

/**
 * Round a number to specified decimal places
 */
export function roundToDecimalPlaces(value: number, decimalPlaces: number = 2): number {
  return Number(value.toFixed(decimalPlaces));
}

/**
 * Convert cents to dollars with proper detection and conversion
 * Detects integer >= 100 and divides by 100, then rounds to 2 decimal places
 * Values < 100 are assumed to already be in dollars
 */
export function centsToDollars(value: bigint | number): number {
  if (value === null || value === undefined) {
    return 0;
  }
  
  let numericValue: number;
  if (typeof value === 'bigint') {
    numericValue = Number(value);
  } else {
    numericValue = Number(value);
  }
  
  // Handle invalid/NaN values
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  
  // If value is an integer >= 100, assume it's in cents and convert to dollars
  // This handles typical Deriv API values like 300 cents = $3.00
  if (Number.isInteger(numericValue) && Math.abs(numericValue) >= 100) {
    return roundToDecimalPlaces(numericValue / 100, 2);
  }
  
  // Otherwise, assume it's already in dollars and just round
  return roundToDecimalPlaces(numericValue, 2);
}

/**
 * Safely convert BigInt or number to number, handling edge cases
 */
function safeNumberConversion(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Safely convert BigInt or number to number for timestamps, returning null for null
 */
function safeTimestampConversion(value: any): number | null {
  if (value === null || value === undefined) {
    return null; // Return null instead of undefined for null timestamps
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Convert database trade record to Deriv API structure
 * Guarantees every field required by COMMON_COLUMNS is populated
 */
export function convertToDerivTradeRecord(trade: any): DerivTradeRecord {
  const metadata = trade.metadata || {};
  
  // Extract Deriv API fields from metadata or trade object (prefer new Deriv fields first)
  // Handle both BigInt and string contract IDs from serialization
  let contractId = metadata.derivContractId || trade.derivContractId || trade.id;
  if (typeof contractId === 'bigint') {
    contractId = contractId.toString();
  }
  // Guarantee contract_id is always a non-empty string
  const finalContractId = contractId ? contractId.toString() : `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Prefer longcode/shortcode from trade if present
  const longcode = trade.derivLongcode || metadata.derivLongcode || generateLongcode(trade);
  const shortcode = trade.derivShortcode || metadata.derivShortcode || generateShortcodeFromTrade(trade);

  // Buy price: Use centsToDollars for consistent conversion
  let buyPrice = 0;
  if (trade.derivBuyPrice != null) {
    buyPrice = centsToDollars(trade.derivBuyPrice);
  } else if (metadata.derivBuyPrice != null) {
    buyPrice = centsToDollars(metadata.derivBuyPrice);
  } else {
    // Fallback branches - keep untouched but run through roundToDecimalPlaces
    const fallbackValue = trade.buyPrice ?? trade.amount ?? 0;
    buyPrice = roundToDecimalPlaces(safeNumberConversion(fallbackValue), 2);
  }
  buyPrice = Math.max(0, buyPrice); // Ensure non-negative

  // Contract type and underlying: prefer new Deriv fields
  const contractType = trade.derivContractType || metadata.contractType || deriveContractType(trade);
  const underlyingSymbol = trade.derivUnderlyingSymbol || metadata.underlyingSymbol || deriveUnderlyingSymbol(trade);

  // Handle BigInt conversion for derivPurchaseTime and derivSellTime with fallbacks
  let purchaseTime: number;
  if (metadata.derivPurchaseTime) {
    purchaseTime = safeNumberConversion(metadata.derivPurchaseTime);
  } else if (trade.derivPurchaseTime) {
    purchaseTime = safeNumberConversion(trade.derivPurchaseTime);
  } else if (trade.openTime) {
    purchaseTime = Math.floor(new Date(trade.openTime).getTime() / 1000);
  } else {
    purchaseTime = Math.floor(Date.now() / 1000); // Current time as ultimate fallback
  }

  // Payout: prefer stored derivPayout with proper conversion; fallback to calculation when absent or 0
  let payout = 0;
  if (trade.derivPayout != null) {
    payout = centsToDollars(trade.derivPayout);
  } else if (metadata.derivPayout != null) {
    payout = centsToDollars(metadata.derivPayout);
  }
  
  if (!payout || payout === 0) {
    payout = calculatePayout(buyPrice, contractType);
  }
  payout = Math.max(0, payout);

  // Sell price: Use centsToDollars for consistent conversion
  let sellPrice: number | undefined;
  if (trade.derivSellPrice !== undefined && trade.derivSellPrice !== null) {
    sellPrice = centsToDollars(trade.derivSellPrice);
  } else if (metadata.derivSellPrice !== undefined && metadata.derivSellPrice !== null) {
    sellPrice = centsToDollars(metadata.derivSellPrice);
  } else if (trade.status === 'WON') {
    sellPrice = payout;
  } else if (trade.status === 'LOST') {
    sellPrice = 0;
  }
  // For open trades, sellPrice remains undefined

  // Sell time with BigInt support
  let sellTime: number | undefined;
  
  // Use the new safeTimestampConversion which returns null for null values
  const derivSellTimeConverted = safeTimestampConversion(trade.derivSellTime);
  
  if (derivSellTimeConverted !== null) {
    sellTime = derivSellTimeConverted;
  } else if (trade.closeTime) {
    const closeTimeMs = new Date(trade.closeTime).getTime();
    const converted = Math.floor(closeTimeMs / 1000);
    sellTime = converted;
  }
  // For open trades, sellTime remains undefined

  // Compute profit/loss: (sell_price ?? payout) - buy_price, rounded to 2 decimal places
  const profitLoss = roundToDecimalPlaces((sellPrice ?? payout) - buyPrice, 2);

  // Determine status: prefer database status if available, otherwise derive from sell_price
  let status: 'won' | 'lost' | 'open' | 'cancelled';
  if (trade.status) {
    // Map database status to display status
    switch (trade.status.toUpperCase()) {
      case 'WON':
        status = 'won';
        break;
      case 'LOST':
        status = 'lost';
        break;
      case 'OPEN':
        status = 'open';
        break;
      case 'CANCELLED':
        status = 'cancelled';
        break;
      default:
        // For unknown statuses, use getTradeStatus with database status context
        status = getTradeStatus(sellPrice, buyPrice, trade.status);
    }
  } else {
    status = getTradeStatus(sellPrice, buyPrice);
  }

  // Guarantee transaction_id is always populated
  let transactionId: string;
  if (trade.derivTransactionId) {
    transactionId = safeNumberConversion(trade.derivTransactionId).toString();
  } else if (metadata.derivTransactionId) {
    transactionId = metadata.derivTransactionId.toString();
  } else {
    transactionId = finalContractId; // Use contract_id as fallback
  }

  // Generate display fields for UI
  const sellPriceDisplay = sellPrice !== undefined ? roundToDecimalPlaces(sellPrice, 2) : undefined;
  const profitLossDisplay = roundToDecimalPlaces(profitLoss, 2);

  return {
    // Core required fields (guaranteed populated)
    contract_id: finalContractId,
    longcode: longcode || `Trade on ${getInstrumentDisplay(underlyingSymbol)}`,
    shortcode: shortcode || `${contractType}_${underlyingSymbol}_${buyPrice}_${purchaseTime}_1T`,
    buy_price: roundToDecimalPlaces(buyPrice, 2),
    payout: roundToDecimalPlaces(payout, 2),
    purchase_time: purchaseTime,
    sell_price: sellPriceDisplay,
    sell_time: sellTime,
    contract_type: contractType,
    underlying_symbol: underlyingSymbol,
    duration_type: trade.derivDurationType || 'ticks',
    app_id: safeNumberConversion(trade.derivAppId) || 80447, // Our app ID
    transaction_id: transactionId,

    // Computed fields (guaranteed populated)
    profit_loss: profitLossDisplay,
    status,
    trade_type_display: getTradeTypeDisplay(contractType),
    instrument_display: getInstrumentDisplay(underlyingSymbol),
    duration_display: getDurationDisplay(longcode || ''),

    // Formatted timestamps (guaranteed populated)
    purchase_date: formatDate(purchaseTime),
    purchase_time_display: formatTime(purchaseTime),
    sell_date: sellTime !== undefined ? formatDate(sellTime) : undefined,
    sell_time_display: sellTime !== undefined ? formatTime(sellTime) : undefined,

    // Additional display fields for UI
    sell_price_display: sellPriceDisplay,
    profit_loss_display: profitLossDisplay
  };
}

/**
 * Generate longcode from trade data
 */
export function generateLongcode(trade: any): string {
  const metadata = trade.metadata || {};
  const contractType = metadata.contractType || deriveContractType(trade);
  const instrument = getInstrumentDisplay(metadata.underlyingSymbol || deriveUnderlyingSymbol(trade));
  const duration = metadata.duration || 1;
  
  if (contractType.includes('EVEN')) {
    return `Win payout if the last digit of ${instrument} is even after ${duration} tick${duration > 1 ? 's' : ''}.`;
  } else if (contractType.includes('ODD')) {
    return `Win payout if the last digit of ${instrument} is odd after ${duration} tick${duration > 1 ? 's' : ''}.`;
  } else if (contractType.includes('OVER')) {
    const barrier = metadata.predictionDigit || 5;
    return `Win payout if the last digit of ${instrument} is strictly higher than ${barrier} after ${duration} tick${duration > 1 ? 's' : ''}.`;
  } else if (contractType.includes('UNDER')) {
    const barrier = metadata.predictionDigit || 5;
    return `Win payout if the last digit of ${instrument} is strictly lower than ${barrier} after ${duration} tick${duration > 1 ? 's' : ''}.`;
  } else if (contractType === 'CALL') {
    return `Win payout if ${instrument} is strictly higher than entry spot at ${duration} tick${duration > 1 ? 's' : ''} after contract start time.`;
  } else if (contractType === 'PUT') {
    return `Win payout if ${instrument} is strictly lower than entry spot at ${duration} tick${duration > 1 ? 's' : ''} after contract start time.`;
  }
  
  return `${contractType} trade on ${instrument} for ${duration} tick${duration > 1 ? 's' : ''}.`;
}

/**
 * Generate shortcode from trade data
 */
export function generateShortcode(contractType: string, underlyingSymbol: string, buyPrice: number, purchaseTime: number, duration: number, barrier?: number): string {
  if (contractType.includes('OVER') || contractType.includes('UNDER')) {
    return `${contractType}_${underlyingSymbol}_${buyPrice}_${purchaseTime}_${duration}T_${barrier || 0}_0`;
  } else {
    return `${contractType}_${underlyingSymbol}_${buyPrice}_${purchaseTime}_${duration}T`;
  }
}

/**
 * Generate shortcode from trade data (legacy function for backward compatibility)
 */
function generateShortcodeFromTrade(trade: any): string {
  const metadata = trade.metadata || {};
  const contractType = metadata.contractType || deriveContractType(trade);
  const underlyingSymbol = metadata.underlyingSymbol || deriveUnderlyingSymbol(trade);
  const payout = metadata.derivPayout || calculatePayoutFromTrade(trade);
  const purchaseTime = metadata.derivPurchaseTime ||
    (trade.derivPurchaseTime ? Number(trade.derivPurchaseTime) :
     (trade.openTime ? Math.floor(new Date(trade.openTime).getTime() / 1000) : Math.floor(Date.now() / 1000)));
  const duration = metadata.duration || 1;
  const barrier = metadata.predictionDigit || '';
  
  if (contractType.includes('OVER') || contractType.includes('UNDER')) {
    return `${contractType}_${underlyingSymbol}_${payout}_${purchaseTime}_${duration}T_${barrier}_0`;
  } else {
    return `${contractType}_${underlyingSymbol}_${payout}_${purchaseTime}_${duration}T`;
  }
}

/**
 * Calculate payout from buy price and contract type
 */
export function calculatePayout(buyPrice: number, contractType: string): number {
  // Default payout multiplier based on trade type
  let multiplier = 1.9; // Default multiplier

  if (contractType.includes('EVEN') || contractType.includes('ODD') || contractType.includes('DIFFER')) {
    multiplier = 1.95; // Even/Odd/Differs use 1.95
  } else if (contractType.includes('OVER') || contractType.includes('UNDER')) {
    multiplier = 1.35; // Over/Under use 1.35
  }

  return roundToDecimalPlaces(buyPrice * multiplier);
}

/**
 * Calculate payout from trade data (legacy function for backward compatibility)
 */
function calculatePayoutFromTrade(trade: any): number {
  const metadata = trade.metadata || {};
  const buyPrice = metadata.derivBuyPrice || trade.buyPrice || trade.amount || 0;
  
  // Default payout multiplier based on trade type
  const contractType = metadata.contractType || trade.type || '';
  let multiplier = 1.95; // Default for Even/Odd
  
  if (contractType.includes('OVER') || contractType.includes('UNDER')) {
    multiplier = 1.35; // Lower payout for Over/Under
  }
  
  return roundToDecimalPlaces(buyPrice * multiplier, 2);
}

/**
 * Derive contract type from trade data (public helper)
 * Defaults to 'DIGITEVEN' when unknown
 */
export function deriveContractType(trade: any): string {
  const metadata = trade.metadata || {};
  const tradeType = trade.type || trade.tradeType || '';
  
  // Check direct contract type from metadata first
  if (metadata.contractType) {
    return metadata.contractType;
  }
  
  // Try to derive from trade type strings
  if (tradeType.includes('Even') || tradeType.toUpperCase().includes('DIGITEVEN')) return 'DIGITEVEN';
  if (tradeType.includes('Odd') || tradeType.toUpperCase().includes('DIGITODD')) return 'DIGITODD';
  if (tradeType.includes('Over') || tradeType.toUpperCase().includes('DIGITOVER')) return 'DIGITOVER';
  if (tradeType.includes('Under') || tradeType.toUpperCase().includes('DIGITUNDER')) return 'DIGITUNDER';
  if (tradeType.includes('Differs') || tradeType.toUpperCase().includes('DIGITDIFF')) return 'DIGITDIFF';
  if (tradeType.includes('Rise') || tradeType.toUpperCase().includes('CALL')) return 'CALL';
  if (tradeType.includes('Fall') || tradeType.toUpperCase().includes('PUT')) return 'PUT';
  if (tradeType.includes('Touch') || tradeType.toUpperCase().includes('ONETOUCH')) return 'ONETOUCH';
  if (tradeType.includes('No Touch') || tradeType.toUpperCase().includes('NOTOUCH')) return 'NOTOUCH';
  
  // Default fallback to DIGITEVEN when unknown
  return 'DIGITEVEN';
}

/**
 * Derive underlying symbol from trade data (public helper)
 * Defaults to 'R_10' when unknown
 */
export function deriveUnderlyingSymbol(trade: any): string {
  const metadata = trade.metadata || {};
  const symbol = trade.symbol || trade.instrument || metadata.underlyingSymbol || '';
  
  // Check direct symbol from metadata first
  if (metadata.underlyingSymbol) {
    return metadata.underlyingSymbol;
  }
  
  // Try to derive from symbol strings
  if (symbol.includes('Volatility 10 (1s)') || symbol.includes('1HZ10V')) return '1HZ10V';
  if (symbol.includes('Volatility 25 (1s)') || symbol.includes('1HZ25V')) return '1HZ25V';
  if (symbol.includes('Volatility 50 (1s)') || symbol.includes('1HZ50V')) return '1HZ50V';
  if (symbol.includes('Volatility 75 (1s)') || symbol.includes('1HZ75V')) return '1HZ75V';
  if (symbol.includes('Volatility 100 (1s)') || symbol.includes('1HZ100V')) return '1HZ100V';
  if (symbol.includes('Volatility 10') || symbol.includes('R_10')) return 'R_10';
  if (symbol.includes('Volatility 25') || symbol.includes('R_25')) return 'R_25';
  if (symbol.includes('Volatility 50') || symbol.includes('R_50')) return 'R_50';
  if (symbol.includes('Volatility 75') || symbol.includes('R_75')) return 'R_75';
  if (symbol.includes('Volatility 100') || symbol.includes('R_100')) return 'R_100';
  if (symbol.includes('Jump 10') || symbol.includes('JD10')) return 'JD10';
  if (symbol.includes('Jump 25') || symbol.includes('JD25')) return 'JD25';
  if (symbol.includes('Jump 50') || symbol.includes('JD50')) return 'JD50';
  if (symbol.includes('Jump 75') || symbol.includes('JD75')) return 'JD75';
  if (symbol.includes('Jump 100') || symbol.includes('JD100')) return 'JD100';
  
  // Default fallback to R_10 when unknown
  return 'R_10';
}
