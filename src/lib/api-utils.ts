/**
 * Utility functions for API routes
 */

/**
 * Converts BigInt fields to strings for JSON serialization
 * This is needed because JSON.stringify() cannot serialize BigInt values
 * Using strings instead of numbers to preserve precision for large contract IDs
 *
 * @param trade - Trade object that may contain BigInt fields
 * @returns Trade object with BigInt fields converted to strings
 */
export function serializeTradeForJSON(trade: any) {
  return {
    ...trade,
    derivContractId: trade.derivContractId ? trade.derivContractId.toString() : null,
    derivPurchaseTime: trade.derivPurchaseTime ? Number(trade.derivPurchaseTime) : null,
    derivSellTime: trade.derivSellTime ? Number(trade.derivSellTime) : null,
    derivTransactionId: trade.derivTransactionId ? trade.derivTransactionId.toString() : null,
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
