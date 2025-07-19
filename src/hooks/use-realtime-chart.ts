import { useState, useEffect, useRef, useCallback } from 'react';
import type { InstrumentType, PriceTick, CandleData } from '@/types';
import { getTickStream } from '@/services/deriv-tick-stream';
import { getCandles } from '@/services/deriv';
import { calculateAllIndicators } from '@/lib/technical-analysis';
import type { InstrumentIndicatorData } from '@/types';

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

  // Calculate technical indicators for the chart data
  const calculateIndicators = useCallback((candles: CandleData[]): RealtimeChartData[] => {
    if (candles.length < 50) return candles as RealtimeChartData[]; // Need enough data for indicators
    
    try {
      const indicators = calculateAllIndicators(candles);
      
      return candles.map((candle, index) => ({
        ...candle,
        rsi: indicators.rsi?.[index],
        macdLine: indicators.macd?.[index]?.macd,
        macdSignal: indicators.macd?.[index]?.signal,
        macdHistogram: indicators.macd?.[index]?.histogram,
        bollingerUpper: indicators.bollingerBands?.[index]?.upper,
        bollingerMiddle: indicators.bollingerBands?.[index]?.middle,
        bollingerLower: indicators.bollingerBands?.[index]?.lower,
        ema: indicators.ema?.[index],
        atr: indicators.atr?.[index]
      }));
    } catch (error) {
      console.error('[useRealtimeChart] Error calculating indicators:', error);
      return candles as RealtimeChartData[];
    }
  }, []);

  // Handle incoming tick data
  const handleTick = useCallback((tick: PriceTick) => {
    const newCandle = updateCandleWithTick(tick);
    
    setChartData(prevData => {
      const updatedData = [...prevData];
      
      // Check if we need to add a new candle or update the last one
      if (updatedData.length === 0 || updatedData[updatedData.length - 1].epoch !== newCandle.epoch) {
        // New candle period - add new candle
        updatedData.push(newCandle);
        
        // Keep only the last N candles to prevent memory issues
        if (updatedData.length > initialCandleCount + 50) {
          updatedData.splice(0, updatedData.length - initialCandleCount);
        }
      } else {
        // Update the last candle
        updatedData[updatedData.length - 1] = newCandle;
      }
      
      // Recalculate indicators with updated data
      return calculateIndicators(updatedData);
    });
  }, [updateCandleWithTick, calculateIndicators, initialCandleCount]);

  // Load initial historical data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const candles = await getCandles(instrument, initialCandleCount, candleTimeframe);
      if (candles && candles.length > 0) {
        const dataWithIndicators = calculateIndicators(candles);
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
