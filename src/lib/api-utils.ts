/**
 * Utility functions for API routes
 */

/**
 * Converts BigInt fields to numbers for JSON serialization
 * This is needed because JSON.stringify() cannot serialize BigInt values
 * 
 * @param trade - Trade object that may contain BigInt fields
 * @returns Trade object with BigInt fields converted to numbers
 */
export function serializeTradeForJSON(trade: any) {
  return {
    ...trade,
    derivPurchaseTime: trade.derivPurchaseTime ? Number(trade.derivPurchaseTime) : null,
    derivSellTime: trade.derivSellTime ? Number(trade.derivSellTime) : null,
  };
}

/**
 * Serializes an array of trades for JSON response
 * 
 * @param trades - Array of trade objects
 * @returns Array of serialized trade objects
 */
export function serializeTradesForJSON(trades: any[]) {
  return trades.map(serializeTradeForJSON);
}
