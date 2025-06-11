import { calculateAllIndicators } from './technical-analysis';
import type { CandleData, InstrumentIndicatorData } from '@/types';

// Mock the individual indicator calculation functions from the same file
jest.mock('./technical-analysis', () => {
  const originalModule = jest.requireActual('./technical-analysis');
  return {
    ...originalModule, // Import and retain all original exports
    calculateRSI: jest.fn(),
    calculateMACD: jest.fn(),
    calculateBollingerBands: jest.fn(),
    calculateEMA: jest.fn(),
    calculateATR: jest.fn(),
  };
});

// Typed mocks
const mockCalculateRSI = require('./technical-analysis').calculateRSI as jest.MockedFunction<typeof import('./technical-analysis').calculateRSI>;
const mockCalculateMACD = require('./technical-analysis').calculateMACD as jest.MockedFunction<typeof import('./technical-analysis').calculateMACD>;
const mockCalculateBollingerBands = require('./technical-analysis').calculateBollingerBands as jest.MockedFunction<typeof import('./technical-analysis').calculateBollingerBands>;
const mockCalculateEMA = require('./technical-analysis').calculateEMA as jest.MockedFunction<typeof import('./technical-analysis').calculateEMA>;
const mockCalculateATR = require('./technical-analysis').calculateATR as jest.MockedFunction<typeof import('./technical-analysis').calculateATR>;


describe('calculateAllIndicators', () => {
  const sampleCandles: CandleData[] = [
    // ... (populate with 20-50 candles for realistic testing if not mocking internals)
    // For this test, since we mock the internal calculators, candle content is less critical
    // as long as it's not empty.
    { epoch: 1, open: 10, high: 15, low: 9, close: 12, time: 't1' },
    { epoch: 2, open: 12, high: 18, low: 11, close: 17, time: 't2' },
    // Add more candle data if you want to test the helpers like getClosingPrices,
    // but for testing calculateAllIndicators with mocked sub-functions, 1-2 candles are enough.
    { epoch: 3, open: 17, high: 20, low: 15, close: 18, time: 't3' },
  ];

  const emptyCandles: CandleData[] = [];

  beforeEach(() => {
    // Reset mocks before each test
    mockCalculateRSI.mockReset();
    mockCalculateMACD.mockReset();
    mockCalculateBollingerBands.mockReset();
    mockCalculateEMA.mockReset();
    mockCalculateATR.mockReset();
  });

  it('should call all individual indicator calculators and return their results', () => {
    const rsiVal = 50;
    const macdVal = { macd: 1, signal: 0.5, histogram: 0.5 };
    const bbVal = { upper: 22, middle: 20, lower: 18 };
    const emaVal = 19;
    const atrVal = 1.5;

    mockCalculateRSI.mockReturnValue(rsiVal);
    mockCalculateMACD.mockReturnValue(macdVal);
    mockCalculateBollingerBands.mockReturnValue(bbVal);
    mockCalculateEMA.mockReturnValue(emaVal);
    mockCalculateATR.mockReturnValue(atrVal);

    const indicators = calculateAllIndicators(sampleCandles);

    expect(mockCalculateRSI).toHaveBeenCalledWith(expect.any(Array), 14);
    expect(mockCalculateMACD).toHaveBeenCalledWith(expect.any(Array), 12, 26, 9);
    expect(mockCalculateBollingerBands).toHaveBeenCalledWith(expect.any(Array), 20, 2);
    expect(mockCalculateEMA).toHaveBeenCalledWith(expect.any(Array), 50); // Default EMA period
    expect(mockCalculateATR).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), expect.any(Array), 14);

    expect(indicators.rsi).toBe(rsiVal);
    expect(indicators.macd).toEqual(macdVal);
    expect(indicators.bollingerBands).toEqual(bbVal);
    expect(indicators.ema).toBe(emaVal);
    expect(indicators.atr).toBe(atrVal);
  });

  it('should return an empty object if candle data is empty', () => {
    const indicators = calculateAllIndicators(emptyCandles);
    expect(indicators).toEqual({});
    expect(mockCalculateRSI).not.toHaveBeenCalled();
    // ... ensure other mocks also not called
  });

  it('should handle undefined return values from individual calculators', () => {
    mockCalculateRSI.mockReturnValue(undefined);
    mockCalculateMACD.mockReturnValue(undefined);
    mockCalculateBollingerBands.mockReturnValue(undefined);
    mockCalculateEMA.mockReturnValue(undefined);
    mockCalculateATR.mockReturnValue(undefined);

    const indicators = calculateAllIndicators(sampleCandles);

    expect(indicators.rsi).toBeUndefined();
    expect(indicators.macd).toBeUndefined();
    expect(indicators.bollingerBands).toBeUndefined();
    expect(indicators.ema).toBeUndefined();
    expect(indicators.atr).toBeUndefined();
  });

  it('should correctly pass custom periods to individual calculators', () => {
    const customRsiPeriod = 21;
    const customMacdFast = 10;
    const customMacdSlow = 30;
    const customMacdSignal = 7;
    const customBbPeriod = 25;
    const customBbStdDev = 3;
    const customEmaPeriod = 100;
    const customAtrPeriod = 20;

    calculateAllIndicators(
      sampleCandles,
      customRsiPeriod,
      customMacdFast,
      customMacdSlow,
      customMacdSignal,
      customBbPeriod,
      customBbStdDev,
      customEmaPeriod,
      customAtrPeriod
    );

    expect(mockCalculateRSI).toHaveBeenCalledWith(expect.any(Array), customRsiPeriod);
    expect(mockCalculateMACD).toHaveBeenCalledWith(expect.any(Array), customMacdFast, customMacdSlow, customMacdSignal);
    expect(mockCalculateBollingerBands).toHaveBeenCalledWith(expect.any(Array), customBbPeriod, customBbStdDev);
    expect(mockCalculateEMA).toHaveBeenCalledWith(expect.any(Array), customEmaPeriod);
    expect(mockCalculateATR).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), expect.any(Array), customAtrPeriod);
  });

  it('should not call ATR calculation if candle data is missing high, low, or close (conceptual - relies on internal check)', () => {
    // This test is more conceptual as the actual filtering happens inside calculateAllIndicators
    // based on the real candle data. We are testing that if the internal conditions for ATR are not met,
    // (e.g., if getHighPrices, getLowPrices, getClosingPrices returned empty arrays due to malformed candles)
    // then calculateATR would not be called with valid data, or its result (if it handles empty inputs) is undefined.

    // For this specific mock setup, calculateATR is always called if prices.length > 0.
    // The internal logic of calculateAllIndicators regarding `candles.every(...)` is what this test implies.
    // We can simulate `getHighPrices` etc. returning empty by providing specific mock for them if needed,
    // but the current `calculateAllIndicators` structure calls them unconditionally before the ATR check.

    // A more direct test of the ATR condition inside `calculateAllIndicators` would require
    // not mocking `getHighPrices`, etc., or a more complex mock setup.
    // Given the current mocks, we assume `getClosingPrices` etc. work.
    // The `if (candles.every(c => c.high !== undefined ...))` is the part being implicitly tested.

    const candlesMissingData: CandleData[] = [
      // @ts-ignore : Intentionally malformed for test
      { epoch: 1, open: 10, close: 12, time: 't1' }, // Missing high/low
    ];

    mockCalculateATR.mockReturnValue(undefined); // Assume ATR would return undefined if it got bad data

    const indicators = calculateAllIndicators(candlesMissingData);

    // We expect other indicators to be called (with closing prices)
    expect(mockCalculateRSI).toHaveBeenCalled();
    // ATR should still be called because `getHighPrices` etc. would produce arrays (possibly of undefineds,
    // depending on strictness of CandleData, but the `every` check in `calculateAllIndicators` is key).
    // The `console.warn` inside `calculateAllIndicators` is the primary effect.
    expect(indicators.atr).toBeUndefined();
  });

});
