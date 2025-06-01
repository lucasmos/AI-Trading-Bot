'use client';

import { RSI, MACD, BollingerBands, SMA, EMA, ATR } from 'technicalindicators';
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
  return rsiResults.map(val => parseFloat(val.toFixed(2)));
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
      macd: parseFloat((val.MACD!).toFixed(2)), 
      signal: parseFloat((val.signal!).toFixed(2)),
      histogram: parseFloat((val.histogram!).toFixed(2)),
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
    upper: parseFloat(val.upper.toFixed(2)),
    middle: parseFloat(val.middle.toFixed(2)),
    lower: parseFloat(val.lower.toFixed(2)),
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
  return smaResults.map(val => parseFloat(val.toFixed(2)));
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
  return emaResults.map(val => parseFloat(val.toFixed(2)));
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
  return atrResults.map(val => parseFloat(val.toFixed(2)));
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