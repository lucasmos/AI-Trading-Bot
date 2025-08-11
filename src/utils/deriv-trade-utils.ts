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
 * Determine trade status from sell_price
 */
export function getTradeStatus(sellPrice?: number, buyPrice?: number): 'won' | 'lost' | 'open' | 'cancelled' {
  if (sellPrice === undefined || sellPrice === null) {
    return 'open';
  }
  
  if (sellPrice === 0) {
    return 'lost';
  }
  
  if (buyPrice && sellPrice > buyPrice) {
    return 'won';
  }
  
  return 'lost';
}

/**
 * Format Unix timestamp to date string (YYYY-MM-DD)
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

/**
 * Format Unix timestamp to time string (HH:MM:SS)
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toTimeString().split(' ')[0];
}

/**
 * Convert database trade record to Deriv API structure
 */
export function convertToDerivTradeRecord(trade: any): DerivTradeRecord {
  const metadata = trade.metadata || {};
  
  // Extract Deriv API fields from metadata or trade object
  const contractId = metadata.derivContractId || trade.derivContractId || trade.id;
  const longcode = metadata.derivLongcode || generateLongcode(trade);
  const shortcode = metadata.derivShortcode || generateShortcodeFromTrade(trade);
  const buyPrice = metadata.derivBuyPrice || trade.buyPrice || trade.amount || 0;
  const payout = metadata.derivPayout || calculatePayoutFromTrade(trade);
  // Handle BigInt conversion for derivPurchaseTime and derivSellTime
  const purchaseTime = metadata.derivPurchaseTime ||
    (trade.derivPurchaseTime ? Number(trade.derivPurchaseTime) :
     (trade.openTime ? Math.floor(new Date(trade.openTime).getTime() / 1000) : Math.floor(Date.now() / 1000)));
  const sellPrice = metadata.derivSellPrice || trade.derivSellPrice || (trade.status === 'WON' ? payout : (trade.status === 'LOST' ? 0 : undefined));
  const sellTime = trade.derivSellTime ? Number(trade.derivSellTime) :
    (trade.closeTime ? Math.floor(new Date(trade.closeTime).getTime() / 1000) : undefined);
  const contractType = metadata.contractType || deriveContractType(trade);
  const underlyingSymbol = metadata.underlyingSymbol || deriveUnderlyingSymbol(trade);
  
  const profitLoss = sellPrice !== undefined ? sellPrice - buyPrice : 0;
  const status = getTradeStatus(sellPrice, buyPrice);
  
  return {
    contract_id: contractId.toString(),
    longcode,
    shortcode,
    buy_price: buyPrice,
    payout,
    purchase_time: purchaseTime,
    sell_price: sellPrice,
    sell_time: sellTime,
    contract_type: contractType,
    underlying_symbol: underlyingSymbol,
    duration_type: 'ticks',
    app_id: 80447, // Our app ID
    transaction_id: metadata.derivTransactionId || `tx_${contractId}`,
    
    // Computed fields
    profit_loss: profitLoss,
    status,
    trade_type_display: getTradeTypeDisplay(contractType),
    instrument_display: getInstrumentDisplay(underlyingSymbol),
    duration_display: getDurationDisplay(longcode),
    
    // Formatted timestamps
    purchase_date: formatDate(purchaseTime),
    purchase_time_display: formatTime(purchaseTime),
    sell_date: sellTime ? formatDate(sellTime) : undefined,
    sell_time_display: sellTime ? formatTime(sellTime) : undefined
  };
}

/**
 * Generate longcode from trade data
 */
function generateLongcode(trade: any): string {
  const metadata = trade.metadata || {};
  const contractType = metadata.contractType || trade.type || 'UNKNOWN';
  const instrument = getInstrumentDisplay(metadata.underlyingSymbol || trade.symbol || 'R_10');
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
  const contractType = metadata.contractType || trade.type || 'UNKNOWN';
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
  let multiplier = 1.95; // Default for Even/Odd

  if (contractType.includes('OVER') || contractType.includes('UNDER')) {
    multiplier = 1.35; // Lower payout for Over/Under
  }

  return Math.round(buyPrice * multiplier * 100) / 100;
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
  
  return Math.round(buyPrice * multiplier * 100) / 100;
}

/**
 * Derive contract type from trade data
 */
function deriveContractType(trade: any): string {
  const metadata = trade.metadata || {};
  const tradeType = trade.type || trade.tradeType || '';
  
  if (tradeType.includes('Even') || metadata.contractType === 'DIGITEVEN') return 'DIGITEVEN';
  if (tradeType.includes('Odd') || metadata.contractType === 'DIGITODD') return 'DIGITODD';
  if (tradeType.includes('Over') || metadata.contractType === 'DIGITOVER') return 'DIGITOVER';
  if (tradeType.includes('Under') || metadata.contractType === 'DIGITUNDER') return 'DIGITUNDER';
  if (tradeType.includes('Rise') || tradeType.includes('CALL')) return 'CALL';
  if (tradeType.includes('Fall') || tradeType.includes('PUT')) return 'PUT';
  
  return 'DIGITEVEN'; // Default fallback
}

/**
 * Derive underlying symbol from trade data
 */
function deriveUnderlyingSymbol(trade: any): string {
  const symbol = trade.symbol || trade.instrument || '';
  
  if (symbol.includes('Volatility 10')) return 'R_10';
  if (symbol.includes('Volatility 25')) return 'R_25';
  if (symbol.includes('Volatility 50')) return 'R_50';
  if (symbol.includes('Volatility 75')) return 'R_75';
  if (symbol.includes('Volatility 100')) return 'R_100';
  
  return 'R_10'; // Default fallback
}
