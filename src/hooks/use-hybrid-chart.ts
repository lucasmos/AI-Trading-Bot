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

export interface HybridChartData extends CandleData {
  rsi?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHistogram?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  ema?: number;
  atr?: number;
}

export interface UseHybridChartOptions {
  instrument: InstrumentType;
  initialCandleCount?: number;
  candleTimeframe?: number;
}

export function useHybridChart({
  instrument,
  initialCandleCount = 120,
  candleTimeframe = 60
}: UseHybridChartOptions) {
  const [chartData, setChartData] = useState<HybridChartData[]>([]);
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
  const indicatorDataRef = useRef<HybridChartData[]>([]);

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

  // Calculate technical indicators (only when needed)
  const calculateIndicators = useCallback(async (candles: CandleData[]): Promise<HybridChartData[]> => {
    if (candles.length < 50) {
      return candles as HybridChartData[];
    }
    
    try {
      const prices = candles.map(c => c.close);
      const highPrices = candles.map(c => c.high);
      const lowPrices = candles.map(c => c.low);
      
      // Calculate full indicator arrays
      const rsiArray = calculateFullRSI(prices, 14);
      const macdArray = calculateFullMACD(prices, 12, 26, 9);
      const bbArray = calculateFullBollingerBands(prices, 20, 2);
      const emaArray = calculateFullEMA(prices, 20);
      const atrArray = calculateFullATR(highPrices, lowPrices, prices, 14);
      
      const result = candles.map((candle, index) => {
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
          bbUpper: bbIndex >= 0 ? bbArray[bbIndex]?.upper : undefined,
          bbMiddle: bbIndex >= 0 ? bbArray[bbIndex]?.middle : undefined,
          bbLower: bbIndex >= 0 ? bbArray[bbIndex]?.lower : undefined,
          ema: emaIndex >= 0 ? emaArray[emaIndex] : undefined,
          atr: atrIndex >= 0 ? atrArray[atrIndex] : undefined
        };
      });
      
      indicatorDataRef.current = result;
      return result;
    } catch (error) {
      console.error('[useHybridChart] Error calculating indicators:', error);
      return candles as HybridChartData[];
    }
  }, []);

  // Handle incoming tick data - ONLY update prices, not indicators
  const handleTick = useCallback((tick: PriceTick) => {
    const newCandle = updateCandleWithTick(tick);
    
    setChartData(prevData => {
      if (prevData.length === 0) return prevData;
      
      const updatedData = [...prevData];
      const lastIndex = updatedData.length - 1;
      
      // Check if we need to add a new candle or update the last one
      if (updatedData[lastIndex].epoch !== newCandle.epoch) {
        // New candle period - add new candle with indicators from previous data
        const newCandleWithIndicators: HybridChartData = {
          ...newCandle,
          // New candles don't have indicators yet - will be calculated on next indicator update
          rsi: undefined,
          macdLine: undefined,
          macdSignal: undefined,
          macdHistogram: undefined,
          bbUpper: undefined,
          bbMiddle: undefined,
          bbLower: undefined,
          ema: undefined,
          atr: undefined
        };
        
        updatedData.push(newCandleWithIndicators);
        
        // Keep only the last N candles
        if (updatedData.length > initialCandleCount + 10) {
          updatedData.splice(0, 10);
        }
        
        // Trigger indicator recalculation for new candle (async)
        setTimeout(() => {
          calculateIndicators(updatedData.map(d => ({
            time: d.time,
            epoch: d.epoch,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
          }))).then(newDataWithIndicators => {
            setChartData(newDataWithIndicators);
          });
        }, 100);
        
      } else {
        // Update the last candle price only - preserve existing indicators
        updatedData[lastIndex] = {
          ...updatedData[lastIndex],
          high: Math.max(updatedData[lastIndex].high, newCandle.high),
          low: Math.min(updatedData[lastIndex].low, newCandle.low),
          close: newCandle.close
        };
      }
      
      return updatedData;
    });
  }, [updateCandleWithTick, calculateIndicators, initialCandleCount]);

  // Load initial historical data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[useHybridChart] Loading initial data for', instrument);
      const candles = await getCandles(instrument, initialCandleCount, candleTimeframe);
      if (candles && candles.length > 0) {
        console.log('[useHybridChart] Loaded', candles.length, 'candles');
        const dataWithIndicators = await calculateIndicators(candles);
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
        
        console.log('[useHybridChart] Initial data loaded successfully');
      } else {
        setError(`No price data available for ${instrument}`);
      }
    } catch (err) {
      console.error('[useHybridChart] Error loading initial data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
    } finally {
      setIsLoading(false);
    }
  }, [instrument, initialCandleCount, candleTimeframe, calculateIndicators]);

  // Subscribe to real-time tick updates
  useEffect(() => {
    const tickStream = tickStreamRef.current;
    
    const updateConnectionStatus = () => {
      setConnectionStatus(tickStream.getConnectionStatus());
    };
    
    updateConnectionStatus();
    const statusInterval = setInterval(updateConnectionStatus, 1000);
    
    const unsubscribe = tickStream.subscribe(instrument, {
      onTick: handleTick,
      onError: (error) => {
        console.error('[useHybridChart] Tick stream error:', error);
        setError(error.message);
      },
      onConnect: () => {
        console.log(`[useHybridChart] Connected to tick stream for ${instrument}`);
        setConnectionStatus('connected');
        setError(null);
      },
      onDisconnect: () => {
        console.log(`[useHybridChart] Disconnected from tick stream for ${instrument}`);
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
