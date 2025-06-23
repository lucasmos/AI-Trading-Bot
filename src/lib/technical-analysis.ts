import { RSI, MACD, BollingerBands, SMA, EMA, ATR, Stochastic, WilliamsR, CCI } from 'technicalindicators';
// Specific Input/Output types are not explicitly exported by the library for static calculate methods.
// We rely on the structure the calculate methods expect.

/**
 * Calculates the Relative Strength Index (RSI) for a series of prices.
 * @param prices Array of closing prices.
 * @param period The period for RSI calculation (default 14).
 * @returns An array of RSI values. The length will be prices.length - period.
 */
export function calculateFullRSI(prices: number[], period: number = 14): number[] {
  if (prices.length < period) {
    return [];
  }
  // The RSI.calculate method expects an object with period and values properties.
  const rsiResults = RSI.calculate({ period, values: prices });
  return rsiResults.map(val => (val !== undefined && val !== null) ? parseFloat(val.toFixed(2)) : 0);
}

/**
 * Calculates the Moving Average Convergence Divergence (MACD) for a series of prices.
 * @param prices Array of closing prices.
 * @param fastPeriod Fast EMA period (default 12).
 * @param slowPeriod Slow EMA period (default 26).
 * @param signalPeriod Signal line EMA period (default 9).
 * @returns An array of MACD result objects (macd, signal, histogram).
 */
export function calculateFullMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): Array<{ macd: number; signal: number; histogram: number }> {
  const macdInput = {
    values: prices,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false, // Ensure EMAs are used
    SimpleMASignal: false,     // Ensure EMAs are used
  };

  const macdResults = MACD.calculate(macdInput);
  // Filter out initial results where MACD components might be undefined, then map.
  return macdResults
    .filter(val => val.MACD !== undefined && val.signal !== undefined && val.histogram !== undefined)
    .map(val => ({
      // At this point, val.MACD, val.signal, val.histogram are guaranteed to be numbers by the filter
      macd: (val.MACD !== undefined && val.MACD !== null) ? parseFloat((val.MACD!).toFixed(2)) : 0,
      signal: (val.signal !== undefined && val.signal !== null) ? parseFloat((val.signal!).toFixed(2)) : 0,
      histogram: (val.histogram !== undefined && val.histogram !== null) ? parseFloat((val.histogram!).toFixed(2)) : 0,
    }));
}

/**
 * Calculates Bollinger Bands for a series of prices.
 * @param prices Array of closing prices.
 * @param period The period for BB calculation (default 20).
 * @param stdDev The number of standard deviations (default 2).
 * @returns An array of Bollinger Band result objects (upper, middle, lower).
 */
export function calculateFullBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): Array<{ upper: number; middle: number; lower: number }> {
  if (prices.length < period) {
    return [];
  }
  const bbInput = {
    period,
    values: prices,
    stdDev,
  };
  const bbResults = BollingerBands.calculate(bbInput);
  return bbResults.map(val => ({
    upper: (val.upper !== undefined && val.upper !== null) ? parseFloat(val.upper.toFixed(2)) : 0,
    middle: (val.middle !== undefined && val.middle !== null) ? parseFloat(val.middle.toFixed(2)) : 0,
    lower: (val.lower !== undefined && val.lower !== null) ? parseFloat(val.lower.toFixed(2)) : 0,
  }));
}

// --- Functions to get the LATEST indicator value (using the full series functions) ---

export function calculateRSI(prices: number[], period: number = 14): number | undefined {
  const fullRSI = calculateFullRSI(prices, period);
  return fullRSI.length > 0 ? fullRSI[fullRSI.length - 1] : undefined;
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } | undefined {
  const fullMACD = calculateFullMACD(prices, fastPeriod, slowPeriod, signalPeriod);
  return fullMACD.length > 0 ? fullMACD[fullMACD.length - 1] : undefined;
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number; middle: number; lower: number } | undefined {
  const fullBB = calculateFullBollingerBands(prices, period, stdDev);
  return fullBB.length > 0 ? fullBB[fullBB.length - 1] : undefined;
}

/**
 * Calculates the Simple Moving Average (SMA) for a series of prices.
 * @param prices Array of closing prices.
 * @param period The period for SMA calculation.
 * @returns An array of SMA values.
 */
export function calculateFullSMA(prices: number[], period: number): number[] {
  if (prices.length < period) {
    return [];
  }
  const smaResults = SMA.calculate({ period, values: prices });
  return smaResults.map(val => (val !== undefined && val !== null) ? parseFloat(val.toFixed(2)) : 0);
}

/**
 * Calculates the latest Simple Moving Average (SMA).
 * @param prices Array of closing prices.
 * @param period The period for SMA calculation.
 * @returns The latest SMA value, or undefined if not enough data.
 */
export function calculateSMA(prices: number[], period: number): number | undefined {
  const fullSMA = calculateFullSMA(prices, period);
  return fullSMA.length > 0 ? fullSMA[fullSMA.length - 1] : undefined;
}

/**
 * Calculates the Exponential Moving Average (EMA) for a series of prices.
 * @param prices Array of closing prices.
 * @param period The period for EMA calculation (default 20).
 * @returns An array of EMA values.
 */
export function calculateFullEMA(prices: number[], period: number = 20): number[] {
  if (prices.length < period) {
    return [];
  }
  const emaResults = EMA.calculate({ period, values: prices });
  return emaResults.map(val => (val !== undefined && val !== null) ? parseFloat(val.toFixed(2)) : 0);
}

/**
 * Calculates the Average True Range (ATR) for a series of prices.
 * @param highPrices Array of high prices.
 * @param lowPrices Array of low prices.
 * @param closePrices Array of close prices.
 * @param period The period for ATR calculation (default 14).
 * @returns An array of ATR values.
 */
export function calculateFullATR(
  highPrices: number[],
  lowPrices: number[],
  closePrices: number[],
  period: number = 14
): number[] {
  if (highPrices.length < period || lowPrices.length < period || closePrices.length < period) {
    return [];
  }
  const atrInput = {
    high: highPrices,
    low: lowPrices,
    close: closePrices,
    period
  };
  const atrResults = ATR.calculate(atrInput);
  return atrResults.map(val => (val !== undefined && val !== null) ? parseFloat(val.toFixed(2)) : 0);
}

// Add single value calculation functions for latest values
export function calculateEMA(prices: number[], period: number = 20): number | undefined {
  const fullEMA = calculateFullEMA(prices, period);
  return fullEMA.length > 0 ? fullEMA[fullEMA.length - 1] : undefined;
}

export function calculateATR(
  highPrices: number[],
  lowPrices: number[],
  closePrices: number[],
  period: number = 14
): number | undefined {
  const fullATR = calculateFullATR(highPrices, lowPrices, closePrices, period);
  return fullATR.length > 0 ? fullATR[fullATR.length - 1] : undefined;
}

/**
 * Calculates Stochastic Oscillator for a series of prices.
 * @param highPrices Array of high prices.
 * @param lowPrices Array of low prices.
 * @param closePrices Array of closing prices.
 * @param kPeriod %K period (default 14).
 * @param dPeriod %D period (default 3).
 * @returns Stochastic result object (%K and %D values).
 */
export function calculateStochastic(
  highPrices: number[],
  lowPrices: number[],
  closePrices: number[],
  kPeriod: number = 14,
  dPeriod: number = 3
): { k: number; d: number } | undefined {
  if (highPrices.length < kPeriod || lowPrices.length < kPeriod || closePrices.length < kPeriod) {
    return undefined;
  }

  const stochInput = {
    high: highPrices,
    low: lowPrices,
    close: closePrices,
    period: kPeriod,
    signalPeriod: dPeriod,
  };

  const stochResults = Stochastic.calculate(stochInput);
  if (stochResults.length === 0) return undefined;

  const latest = stochResults[stochResults.length - 1];
  if (!latest || latest.k === undefined || latest.d === undefined) return undefined;
  return {
    k: parseFloat(latest.k.toFixed(2)),
    d: parseFloat(latest.d.toFixed(2)),
  };
}

/**
 * Calculates Williams %R for a series of prices.
 * @param highPrices Array of high prices.
 * @param lowPrices Array of low prices.
 * @param closePrices Array of closing prices.
 * @param period Period for calculation (default 14).
 * @returns Williams %R value.
 */
export function calculateWilliamsR(
  highPrices: number[],
  lowPrices: number[],
  closePrices: number[],
  period: number = 14
): number | undefined {
  if (highPrices.length < period || lowPrices.length < period || closePrices.length < period) {
    return undefined;
  }

  const wrInput = {
    high: highPrices,
    low: lowPrices,
    close: closePrices,
    period: period,
  };

  const wrResults = WilliamsR.calculate(wrInput);
  if (wrResults.length === 0) return undefined;
  const latest = wrResults[wrResults.length - 1];
  return (latest !== undefined && latest !== null) ? parseFloat(latest.toFixed(2)) : undefined;
}

/**
 * Calculates Commodity Channel Index (CCI) for a series of prices.
 * @param highPrices Array of high prices.
 * @param lowPrices Array of low prices.
 * @param closePrices Array of closing prices.
 * @param period Period for calculation (default 20).
 * @returns CCI value.
 */
export function calculateCCI(
  highPrices: number[],
  lowPrices: number[],
  closePrices: number[],
  period: number = 20
): number | undefined {
  if (highPrices.length < period || lowPrices.length < period || closePrices.length < period) {
    return undefined;
  }

  const cciInput = {
    high: highPrices,
    low: lowPrices,
    close: closePrices,
    period: period,
  };

  const cciResults = CCI.calculate(cciInput);
  if (cciResults.length === 0) return undefined;
  const latest = cciResults[cciResults.length - 1];
  return (latest !== undefined && latest !== null) ? parseFloat(latest.toFixed(2)) : undefined;
}

// Import types needed for calculateAllIndicators - adjust path if your project structure is different
import type { CandleData, InstrumentIndicatorData } from '@/types';

// Helper function to extract closing prices
const getClosingPrices = (candles: CandleData[]): number[] => {
  return candles.map(c => c.close);
};

// Helper function to extract high prices
const getHighPrices = (candles: CandleData[]): number[] => {
  return candles.map(c => c.high);
};

// Helper function to extract low prices
const getLowPrices = (candles: CandleData[]): number[] => {
  return candles.map(c => c.low);
};

// Main function to calculate all indicators for a given set of candles
// This function will use the existing calculator functions in this file
export function calculateAllIndicators(
    candles: CandleData[],
    rsiPeriod: number = 14,
    macdFastPeriod: number = 12,
    macdSlowPeriod: number = 26,
    macdSignalPeriod: number = 9,
    bbPeriod: number = 20,
    bbStdDev: number = 2,
    emaPeriod: number = 50, // Example EMA period, e.g., for a 50-day EMA
    atrPeriod: number = 14
): InstrumentIndicatorData {
    const prices = getClosingPrices(candles);
    if (prices.length === 0) {
        console.warn("[calculateAllIndicators] No closing prices available from candles. Returning empty indicators.");
        return {}; // Return empty if no prices
    }

    const indicators: InstrumentIndicatorData = {};

    // RSI - uses existing calculateRSI
    const rsiValue = calculateRSI(prices, rsiPeriod);
    if (rsiValue !== undefined) {
        indicators.rsi = rsiValue;
    }

    // MACD - uses existing calculateMACD
    const macdResult = calculateMACD(prices, macdFastPeriod, macdSlowPeriod, macdSignalPeriod);
    if (macdResult) { // calculateMACD returns an object or undefined
        indicators.macd = macdResult;
    }

    // Bollinger Bands - uses existing calculateBollingerBands
    const bbResult = calculateBollingerBands(prices, bbPeriod, bbStdDev);
    if (bbResult) { // calculateBollingerBands returns an object or undefined
        indicators.bollingerBands = bbResult;
    }

    // EMA (e.g., EMA50) - uses existing calculateEMA
    const emaValue = calculateEMA(prices, emaPeriod);
    if (emaValue !== undefined) {
        indicators.ema = emaValue; // Assuming InstrumentIndicatorData expects a single EMA value
                                   // If multiple EMAs are needed, this part needs adjustment.
    }

    // ATR - uses existing calculateATR
    // ATR requires high, low, and close prices.
    if (candles.every(c => c.high !== undefined && c.low !== undefined && c.close !== undefined)) {
        const highPrices = getHighPrices(candles);
        const lowPrices = getLowPrices(candles);
        // Closing prices already extracted as 'prices'
        const atrValue = calculateATR(highPrices, lowPrices, prices, atrPeriod);
        if (atrValue !== undefined) {
            indicators.atr = atrValue;
        }

        // Stochastic Oscillator - requires high, low, and close prices
        const stochasticValue = calculateStochastic(highPrices, lowPrices, prices);
        if (stochasticValue !== undefined) {
            indicators.stochastic = stochasticValue;
        }

        // Williams %R - requires high, low, and close prices
        const williamsRValue = calculateWilliamsR(highPrices, lowPrices, prices);
        if (williamsRValue !== undefined) {
            indicators.williamsR = williamsRValue;
        }

        // CCI - requires high, low, and close prices
        const cciValue = calculateCCI(highPrices, lowPrices, prices);
        if (cciValue !== undefined) {
            indicators.cci = cciValue;
        }
    } else {
        console.warn("[calculateAllIndicators] Not all candles have high, low, and close prices. Skipping ATR, Stochastic, Williams %R, and CCI calculations.");
    }

    return indicators;
}