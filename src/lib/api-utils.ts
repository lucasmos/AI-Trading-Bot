/**
 * Utility functions for API routes
 */

/**
 * Safely converts BigInt to string or number based on size
 * - For contract IDs and transaction IDs: convert to string to preserve precision
 * - For timestamps: convert to number since they're Unix timestamps in seconds
 * 
 * @param value - BigInt value to convert
 * @param toNumber - Whether to convert to number (for timestamps) or string (for IDs)
 * @returns Converted value or null
 */
function convertBigInt(value: any, toNumber = false): string | number | null {
  if (value === null || value === undefined) return null;
  
  try {
    if (toNumber) {
      // For timestamps, convert to number (safe for Unix timestamps)
      return Number(value);
    } else {
      // For IDs, convert to string to preserve precision
      return value.toString();
    }
  } catch (error) {
    console.error('[API Utils] Error converting BigInt:', error);
    return null;
  }
}

/**
 * Converts BigInt fields to strings/numbers for JSON serialization
 * This is needed because JSON.stringify() cannot serialize BigInt values
 * 
 * Contract IDs and Transaction IDs: Converted to strings to preserve precision
 * Timestamps: Converted to numbers since they're Unix timestamps in seconds
 * 
 * @param trade - Trade object that may contain BigInt fields
 * @returns Trade object with BigInt fields converted to appropriate types
 */
export function serializeTradeForJSON(trade: any) {
  if (!trade) return null;
  
  return {
    ...trade,
    // Contract and transaction IDs - convert to string to preserve precision
    derivContractId: convertBigInt(trade.derivContractId, false),
    derivTransactionId: convertBigInt(trade.derivTransactionId, false),
    
    // Timestamps - convert to number (Unix timestamps in seconds are safe as numbers)
    derivPurchaseTime: convertBigInt(trade.derivPurchaseTime, true),
    derivSellTime: convertBigInt(trade.derivSellTime, true),
    entryTickTime: convertBigInt(trade.entryTickTime, true),
    exitTickTime: convertBigInt(trade.exitTickTime, true),
    currentSpotTime: convertBigInt(trade.currentSpotTime, true),
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

/**
 * Converts BigInt fields in ProfitTableEntry to appropriate types for JSON serialization
 * 
 * @param entry - ProfitTableEntry object that may contain BigInt fields
 * @returns Entry object with BigInt fields converted
 */
export function serializeProfitTableEntryForJSON(entry: any) {
  if (!entry) return null;
  
  return {
    ...entry,
    // IDs - convert to string to preserve precision
    contractId: convertBigInt(entry.contractId, false),
    transactionId: convertBigInt(entry.transactionId, false),
    
    // Timestamps - convert to number
    purchaseTime: convertBigInt(entry.purchaseTime, true),
    sellTime: convertBigInt(entry.sellTime, true),
  };
}

/**
 * Serializes an array of profit table entries for JSON response
 * 
 * @param entries - Array of profit table entry objects
 * @returns Array of serialized entry objects
 */
export function serializeProfitTableEntriesForJSON(entries: any[]) {
  return entries.map(serializeProfitTableEntryForJSON);
}

/**
 * Generic serialization function that handles any Prisma model with BigInt fields
 * Automatically detects and converts BigInt values to strings or numbers
 * 
 * @param obj - Any object that may contain BigInt fields
 * @returns Object with BigInt fields converted
 */
export function serializeForJSON(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => serializeForJSON(item));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const serialized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Check if the value is a BigInt
      if (typeof value === 'bigint') {
        // For fields ending with 'Time' or containing 'time', convert to number
        // For fields ending with 'Id' or containing 'contract', 'transaction', convert to string
        if (key.toLowerCase().includes('time')) {
          serialized[key] = Number(value);
        } else {
          serialized[key] = value.toString();
        }
      } 
      // Recursively handle nested objects and arrays
      else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        serialized[key] = serializeForJSON(value);
      } 
      // Keep other values as-is
      else {
        serialized[key] = value;
      }
    }
    
    return serialized;
  }
  
  // Return primitive values as-is
  return obj;
}
