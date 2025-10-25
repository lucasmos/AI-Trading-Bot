/**
 * Trade distribution utility for managing tick distribution across multiple trades
 * Supports both Turbo (single batch) and Safe (distributed across ticks) execution modes
 * Provides a mapping table from trade counts (5-100) to their corresponding tick distributions
 */

/**
 * Type alias for trade distribution arrays
 * Represents how trades are distributed across ticks
 */
type TradeDistribution = readonly number[];

/**
 * Complete trade distribution table mapping trade counts to tick distributions
 * Supports trade counts from 5 to 100 with pre-calculated optimal distributions
 * Each entry specifies how many trades to execute at each tick
 * 
 * Example:
 * - 5 trades → [2, 2, 1] (2 trades at tick 1, 2 at tick 2, 1 at tick 3)
 * - 6 trades → [2, 2, 2] (2 trades at tick 1, 2 at tick 2, 2 at tick 3)
 */
export const TRADE_DISTRIBUTION_TABLE: Readonly<Record<number, ReadonlyArray<number>>> = Object.freeze({
  // 3-tick distributions (5-30 trades)
  5: Object.freeze([2, 2, 1]),
  6: Object.freeze([2, 2, 2]),
  7: Object.freeze([2, 3, 2]),
  8: Object.freeze([3, 3, 2]),
  9: Object.freeze([2, 3, 2, 2]),
  10: Object.freeze([2, 3, 3, 2]),
  11: Object.freeze([3, 3, 3, 2]),
  12: Object.freeze([3, 3, 3, 3]),
  13: Object.freeze([3, 4, 3, 3]),
  14: Object.freeze([3, 4, 4, 3]),
  15: Object.freeze([3, 4, 4, 4]),
  16: Object.freeze([4, 4, 4, 4]),
  17: Object.freeze([4, 4, 5, 4]),
  18: Object.freeze([4, 5, 5, 4]),
  19: Object.freeze([4, 5, 5, 5]),
  20: Object.freeze([4, 6, 6, 4]),
  21: Object.freeze([4, 6, 6, 5]),
  22: Object.freeze([5, 6, 6, 5]),
  23: Object.freeze([5, 6, 6, 6]),
  24: Object.freeze([5, 6, 7, 6]),
  25: Object.freeze([5, 6, 7, 7]),
  26: Object.freeze([5, 7, 7, 7]),
  27: Object.freeze([6, 7, 7, 7]),
  28: Object.freeze([6, 7, 8, 7]),
  29: Object.freeze([6, 8, 8, 7]),
  30: Object.freeze([6, 9, 9, 6]),
  // 5-tick distributions (31-70 trades)
  31: Object.freeze([5, 6, 9, 6, 5]),
  32: Object.freeze([6, 6, 9, 6, 5]),
  33: Object.freeze([6, 6, 10, 6, 5]),
  34: Object.freeze([6, 7, 10, 7, 4]),
  35: Object.freeze([6, 7, 11, 7, 4]),
  36: Object.freeze([6, 7, 12, 7, 4]),
  37: Object.freeze([7, 7, 12, 7, 4]),
  38: Object.freeze([7, 7, 13, 7, 4]),
  39: Object.freeze([7, 8, 13, 8, 3]),
  40: Object.freeze([6, 8, 12, 8, 6]),
  41: Object.freeze([7, 8, 13, 8, 5]),
  42: Object.freeze([7, 8, 14, 8, 5]),
  43: Object.freeze([7, 9, 14, 9, 4]),
  44: Object.freeze([8, 9, 14, 9, 4]),
  45: Object.freeze([8, 9, 15, 9, 4]),
  46: Object.freeze([8, 10, 15, 10, 3]),
  47: Object.freeze([8, 10, 16, 10, 3]),
  48: Object.freeze([9, 10, 16, 10, 3]),
  49: Object.freeze([9, 10, 17, 10, 3]),
  50: Object.freeze([8, 10, 14, 10, 8]),
  51: Object.freeze([10, 10, 11, 10, 10]),
  52: Object.freeze([10, 11, 11, 10, 10]),
  53: Object.freeze([10, 11, 11, 11, 10]),
  54: Object.freeze([10, 11, 12, 11, 10]),
  55: Object.freeze([11, 11, 12, 11, 10]),
  56: Object.freeze([11, 11, 12, 11, 11]),
  57: Object.freeze([11, 11, 13, 11, 11]),
  58: Object.freeze([11, 12, 13, 12, 10]),
  59: Object.freeze([11, 12, 13, 12, 11]),
  60: Object.freeze([10, 12, 16, 12, 10]),
  61: Object.freeze([12, 12, 13, 12, 12]),
  62: Object.freeze([12, 12, 14, 12, 12]),
  63: Object.freeze([12, 13, 14, 13, 11]),
  64: Object.freeze([12, 13, 14, 13, 12]),
  65: Object.freeze([12, 13, 15, 13, 12]),
  66: Object.freeze([12, 13, 16, 13, 12]),
  67: Object.freeze([13, 13, 16, 13, 12]),
  68: Object.freeze([13, 14, 16, 14, 11]),
  69: Object.freeze([13, 14, 16, 14, 12]),
  70: Object.freeze([12, 14, 18, 14, 12]),
  // 6-tick distributions (71-100 trades)
  71: Object.freeze([11, 12, 12, 12, 12, 12]),
  72: Object.freeze([12, 12, 12, 12, 12, 12]),
  73: Object.freeze([12, 12, 13, 12, 12, 12]),
  74: Object.freeze([12, 12, 13, 13, 12, 12]),
  75: Object.freeze([12, 13, 13, 13, 12, 12]),
  76: Object.freeze([12, 13, 14, 13, 12, 12]),
  77: Object.freeze([12, 13, 14, 14, 12, 12]),
  78: Object.freeze([12, 13, 15, 14, 12, 12]),
  79: Object.freeze([13, 13, 15, 14, 12, 12]),
  80: Object.freeze([12, 14, 14, 14, 14, 12]),
  81: Object.freeze([13, 14, 14, 14, 14, 12]),
  82: Object.freeze([13, 14, 15, 14, 14, 12]),
  83: Object.freeze([13, 14, 15, 15, 14, 12]),
  84: Object.freeze([13, 15, 15, 15, 14, 12]),
  85: Object.freeze([13, 15, 15, 15, 15, 12]),
  86: Object.freeze([14, 15, 15, 15, 15, 12]),
  87: Object.freeze([14, 15, 16, 15, 15, 12]),
  88: Object.freeze([14, 15, 16, 16, 15, 12]),
  89: Object.freeze([14, 15, 16, 16, 15, 13]),
  90: Object.freeze([14, 16, 16, 16, 16, 12]),
  91: Object.freeze([15, 15, 16, 15, 15, 15]),
  92: Object.freeze([15, 15, 16, 16, 15, 15]),
  93: Object.freeze([15, 16, 16, 16, 15, 15]),
  94: Object.freeze([15, 16, 16, 16, 16, 15]),
  95: Object.freeze([16, 16, 16, 16, 16, 15]),
  96: Object.freeze([16, 16, 16, 16, 16, 16]),
  97: Object.freeze([16, 16, 17, 16, 16, 16]),
  98: Object.freeze([16, 16, 17, 17, 16, 16]),
  99: Object.freeze([16, 17, 17, 17, 16, 16]),
  100: Object.freeze([16, 17, 17, 17, 17, 16]),
} as const);

// Trade count bounds for distribution table
const MIN_TRADE_COUNT = 5;
const MAX_TRADE_COUNT = 100;

/**
 * Retrieves the trade distribution array for a given number of trades
 * 
 * @param numberOfTrades - The total number of trades to distribute (range: 5-100)
 * @returns A distribution array specifying how many trades to execute at each tick
 * @throws Error if the trade count is outside the valid range (5-100) or not found in the table
 * 
 * @example
 * const distribution = getTradeDistribution(10);
 * // Returns: [3, 3, 4] - meaning 3 trades at tick 1, 3 at tick 2, 4 at tick 3
 */
export function getTradeDistribution(numberOfTrades: number): TradeDistribution {
  // Validate that numberOfTrades is a finite integer
  if (!Number.isFinite(numberOfTrades) || !Number.isInteger(numberOfTrades)) {
    throw new Error(
      `Invalid numberOfTrades: ${numberOfTrades}. ` +
      `The input must be an integer between ${MIN_TRADE_COUNT} and ${MAX_TRADE_COUNT}.`
    );
  }

  // Validate input range
  if (numberOfTrades < MIN_TRADE_COUNT || numberOfTrades > MAX_TRADE_COUNT) {
    throw new Error(
      `Invalid trade count: ${numberOfTrades}. Trade count must be between ${MIN_TRADE_COUNT} and ${MAX_TRADE_COUNT}. ` +
      `For fewer than ${MIN_TRADE_COUNT} trades, consider using Turbo mode. ` +
      `For more than ${MAX_TRADE_COUNT} trades, split into multiple sessions.`
    );
  }

  // Retrieve distribution from table
  const distribution = TRADE_DISTRIBUTION_TABLE[numberOfTrades];

  if (!distribution) {
    throw new Error(
      `No distribution found for trade count: ${numberOfTrades}. ` +
      `This is an internal error - the distribution table may be incomplete.`
    );
  }

  // Validate distribution integrity
  if (!validateDistribution(numberOfTrades, distribution)) {
    throw new Error(
      `Distribution data integrity error for trade count: ${numberOfTrades}. ` +
      `The distribution array does not sum to the requested trade count. ` +
      `Distribution sum: ${distribution.reduce((a, b) => a + b, 0)}, Expected: ${numberOfTrades}`
    );
  }

  // Return a copy to prevent accidental mutation
  return [...distribution];
}

/**
 * Validates that a distribution array correctly sums to the requested trade count
 * 
 * @param numberOfTrades - The expected total number of trades
 * @param distribution - The distribution array to validate
 * @returns true if the distribution sum matches the trade count, false otherwise
 * 
 * @example
 * validateDistribution(10, [3, 3, 4]); // Returns: true (3 + 3 + 4 = 10)
 * validateDistribution(10, [3, 3, 3]); // Returns: false (3 + 3 + 3 = 9)
 */
export function validateDistribution(numberOfTrades: number, distribution: TradeDistribution): boolean {
  const distributionSum = distribution.reduce((sum, count) => sum + count, 0);
  return distributionSum === numberOfTrades;
}

/**
 * Checks if a given trade count has a valid distribution available
 * 
 * Useful for pre-validation in calling code to avoid errors
 * Returns a boolean result without throwing exceptions
 * 
 * @param numberOfTrades - The trade count to check
 * @returns true if the trade count exists in the distribution table and is valid, false otherwise
 * 
 * @example
 * if (isValidTradeCount(10)) {
 *   const distribution = getTradeDistribution(10); // Safe to call
 * }
 */
export function isValidTradeCount(numberOfTrades: number): boolean {
  if (numberOfTrades < MIN_TRADE_COUNT || numberOfTrades > MAX_TRADE_COUNT) {
    return false;
  }

  const distribution = TRADE_DISTRIBUTION_TABLE[numberOfTrades];
  
  if (!distribution) {
    return false;
  }

  return validateDistribution(numberOfTrades, distribution);
}

/**
 * Verifies the integrity of the entire trade distribution table
 * 
 * Iterates through all trade counts (5-100) and validates that each distribution
 * correctly sums to its expected trade count. Useful for development, testing,
 * and CI to catch data corruption or incorrect edits.
 * 
 * In non-production builds, this function will assert on failures for immediate feedback.
 * In production, it returns false on any validation failure without throwing.
 * 
 * @returns true if all distributions are valid, false if any validation fails
 * 
 * @example
 * // In tests or CI
 * expect(verifyTableIntegrity()).toBe(true);
 * 
 * // In development builds
 * verifyTableIntegrity(); // Will assert on failure
 * 
 * // In production (safe check)
 * if (!verifyTableIntegrity()) {
 *   console.warn('Trade distribution table integrity check failed');
 * }
 */
export function verifyTableIntegrity(): boolean {
  for (let tradeCount = MIN_TRADE_COUNT; tradeCount <= MAX_TRADE_COUNT; tradeCount++) {
    const distribution = TRADE_DISTRIBUTION_TABLE[tradeCount];
    
    // Check if distribution exists
    if (!distribution) {
      const errorMessage = `Missing distribution for trade count: ${tradeCount}`;
      
      // Assert in non-production builds for immediate feedback
      if (process.env.NODE_ENV !== 'production') {
        console.assert(false, errorMessage);
      }
      
      return false;
    }
    
    // Validate distribution sums correctly
    if (!validateDistribution(tradeCount, distribution)) {
      const distributionSum = distribution.reduce((sum, count) => sum + count, 0);
      const errorMessage = `Invalid distribution for trade count ${tradeCount}: ` +
        `expected sum ${tradeCount}, got ${distributionSum}. ` +
        `Distribution: [${distribution.join(', ')}]`;
      
      // Assert in non-production builds for immediate feedback
      if (process.env.NODE_ENV !== 'production') {
        console.assert(false, errorMessage);
      }
      
      return false;
    }
  }
  
  return true;
}
