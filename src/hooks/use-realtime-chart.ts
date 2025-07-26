import { useState, useEffect, useRef, useCallback } from 'react';
import type { InstrumentType, PriceTick, CandleData } from '@/types';
import { getTickStream } from '@/services/deriv-tick-stream';
import { getCandles } from '@/services/deriv';
import {
  calculateFullRSI,
  calculateFullMACD,
  calculateFullBollingerBands,
  calculateFullEMA,
  calculateFullATR
} from '@/lib/technical-analysis';

export interface RealtimeChartData extends CandleData {
  rsi?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHistogram?: number;
  bollingerUpper?: number;
  bollingerMiddle?: number;
  bollingerLower?: number;
  ema?: number;
  atr?: number;
}

export interface UseRealtimeChartOptions {
  instrument: InstrumentType;
  initialCandleCount?: number;
  candleTimeframe?: number; // seconds per candle (default 60)
}

export function useRealtimeChart({
  instrument,
  initialCandleCount = 120,
  candleTimeframe = 60
}: UseRealtimeChartOptions) {
  const [chartData, setChartData] = useState<RealtimeChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const currentCandleRef = useRef<{
    open: number;
    high: number;
    low: number;
    close: number;
    startTime: number;
    epoch: number;
  } | null>(null);

  const tickStreamRef = useRef(getTickStream());
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastIndicatorUpdateRef = useRef<number>(0);

  // Create a new candle from tick data
  const createCandleFromTick = useCallback((tick: PriceTick, startTime: number): CandleData => {
    return {
      time: new Date(startTime * 1000).toISOString(),
      epoch: startTime,
      open: tick.price,
      high: tick.price,
      low: tick.price,
      close: tick.price
    };
  }, []);

  // Update current candle with new tick
  const updateCandleWithTick = useCallback((tick: PriceTick) => {
    const tickTime = tick.epoch;
    const candleStartTime = Math.floor(tickTime / candleTimeframe) * candleTimeframe;
    
    if (!currentCandleRef.current || currentCandleRef.current.startTime !== candleStartTime) {
      // New candle period
      currentCandleRef.current = {
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        startTime: candleStartTime,
        epoch: candleStartTime
      };
    } else {
      // Update existing candle
      currentCandleRef.current.high = Math.max(currentCandleRef.current.high, tick.price);
      currentCandleRef.current.low = Math.min(currentCandleRef.current.low, tick.price);
      currentCandleRef.current.close = tick.price;
    }

    return {
      time: new Date(candleStartTime * 1000).toISOString(),
      epoch: candleStartTime,
      open: currentCandleRef.current.open,
      high: currentCandleRef.current.high,
      low: currentCandleRef.current.low,
      close: currentCandleRef.current.close
    };
  }, [candleTimeframe]);

  // Calculate technical indicators for the chart data (only on completed candles)
  const calculateIndicators = useCallback((candles: CandleData[], forceUpdate = false): RealtimeChartData[] => {
    if (candles.length < 50) {
      console.log('[useRealtimeChart] Not enough data for indicators:', candles.length);
      return candles as RealtimeChartData[];
    }

    // Only recalculate indicators if forced or if enough time has passed
    const now = Date.now();
    if (!forceUpdate && (now - lastIndicatorUpdateRef.current) < 30000) { // 30 seconds minimum
      // Return existing data with indicators if available
      if (chartData.length > 0 && chartData[0].rsi !== undefined) {
        return chartData;
      }
    }

    try {
      console.log('[useRealtimeChart] Calculating indicators for', candles.length, 'candles');

      // Extract price arrays
      const prices = candles.map(c => c.close);
      const highPrices = candles.map(c => c.high);
      const lowPrices = candles.map(c => c.low);

      // Calculate full indicator arrays
      const rsiArray = calculateFullRSI(prices, 14);
      const macdArray = calculateFullMACD(prices, 12, 26, 9);
      const bbArray = calculateFullBollingerBands(prices, 20, 2);
      const emaArray = calculateFullEMA(prices, 20);
      const atrArray = calculateFullATR(highPrices, lowPrices, prices, 14);

      lastIndicatorUpdateRef.current = now;

      const result = candles.map((candle, index) => {
        // Calculate the offset for each indicator array
        const rsiIndex = index - (prices.length - rsiArray.length);
        const macdIndex = index - (prices.length - macdArray.length);
        const bbIndex = index - (prices.length - bbArray.length);
        const emaIndex = index - (prices.length - emaArray.length);
        const atrIndex = index - (prices.length - atrArray.length);

        return {
          ...candle,
          rsi: rsiIndex >= 0 ? rsiArray[rsiIndex] : undefined,
          macdLine: macdIndex >= 0 ? macdArray[macdIndex]?.macd : undefined,
          macdSignal: macdIndex >= 0 ? macdArray[macdIndex]?.signal : undefined,
          macdHistogram: macdIndex >= 0 ? macdArray[macdIndex]?.histogram : undefined,
          bollingerUpper: bbIndex >= 0 ? bbArray[bbIndex]?.upper : undefined,
          bollingerMiddle: bbIndex >= 0 ? bbArray[bbIndex]?.middle : undefined,
          bollingerLower: bbIndex >= 0 ? bbArray[bbIndex]?.lower : undefined,
          ema: emaIndex >= 0 ? emaArray[emaIndex] : undefined,
          atr: atrIndex >= 0 ? atrArray[atrIndex] : undefined
        };
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[useRealtimeChart] Indicators calculated. Sample data:', {
          totalCandles: result.length,
          rsiValues: rsiArray.length,
          macdValues: macdArray.length,
          lastRSI: result[result.length - 1]?.rsi,
          lastMACD: result[result.length - 1]?.macdLine
        });
      }

      return result;
    } catch (error) {
      console.error('[useRealtimeChart] Error calculating indicators:', error);
      return candles as RealtimeChartData[];
    }
  }, [chartData]);

  // Handle incoming tick data with throttling to prevent glitching
  const handleTick = useCallback((tick: PriceTick) => {
    const newCandle = updateCandleWithTick(tick);

    // Throttle updates to prevent excessive re-renders
    const now = Date.now();
    if (now - lastIndicatorUpdateRef.current < 1000) { // Max 1 update per second
      return;
    }

    setChartData(prevData => {
      if (prevData.length === 0) return prevData;

      const updatedData = [...prevData];
      const lastIndex = updatedData.length - 1;

      // Check if we need to add a new candle or update the last one
      if (updatedData[lastIndex].epoch !== newCandle.epoch) {
        // New candle period - add new candle
        updatedData.push(newCandle as RealtimeChartData);

        // Keep only the last N candles to prevent memory issues
        if (updatedData.length > initialCandleCount + 10) {
          updatedData.splice(0, 10);
        }

        // Recalculate indicators for new candle
        return calculateIndicators(updatedData, true);
      } else {
        // Update the last candle price only
        updatedData[lastIndex] = {
          ...updatedData[lastIndex],
          high: Math.max(updatedData[lastIndex].high, newCandle.high),
          low: Math.min(updatedData[lastIndex].low, newCandle.low),
          close: newCandle.close
        };
      }

      return updatedData;
    });

    lastIndicatorUpdateRef.current = now;
  }, [updateCandleWithTick, calculateIndicators, initialCandleCount]);

  // Load initial historical data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useRealtimeChart] Loading initial data for', instrument);
      const candles = await getCandles(instrument, initialCandleCount, candleTimeframe);
      if (candles && candles.length > 0) {
        console.log('[useRealtimeChart] Loaded', candles.length, 'candles');
        const dataWithIndicators = calculateIndicators(candles, true); // Force calculation
        setChartData(dataWithIndicators);

        // Initialize current candle with the last candle
        const lastCandle = candles[candles.length - 1];
        currentCandleRef.current = {
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close,
          startTime: lastCandle.epoch,
          epoch: lastCandle.epoch
        };

        console.log('[useRealtimeChart] Initial data loaded successfully');
      } else {
        setError(`No price data available for ${instrument}`);
      }
    } catch (err) {
      console.error('[useRealtimeChart] Error loading initial data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
    } finally {
      setIsLoading(false);
    }
  }, [instrument, initialCandleCount, candleTimeframe, calculateIndicators]);

  // Subscribe to real-time tick updates
  useEffect(() => {
    const tickStream = tickStreamRef.current;
    
    // Update connection status
    const updateConnectionStatus = () => {
      setConnectionStatus(tickStream.getConnectionStatus());
    };
    
    updateConnectionStatus();
    const statusInterval = setInterval(updateConnectionStatus, 1000);
    
    // Subscribe to tick updates
    const unsubscribe = tickStream.subscribe(instrument, {
      onTick: handleTick,
      onError: (error) => {
        console.error('[useRealtimeChart] Tick stream error:', error);
        setError(error.message);
      },
      onConnect: () => {
        console.log(`[useRealtimeChart] Connected to tick stream for ${instrument}`);
        setConnectionStatus('connected');
        setError(null);
      },
      onDisconnect: () => {
        console.log(`[useRealtimeChart] Disconnected from tick stream for ${instrument}`);
        setConnectionStatus('disconnected');
      }
    });
    
    unsubscribeRef.current = unsubscribe;
    
    return () => {
      clearInterval(statusInterval);
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [instrument, handleTick]);

  // Load initial data when instrument changes
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    chartData,
    isLoading,
    error,
    connectionStatus,
    refresh: loadInitialData
  };
}
