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

export interface StreamingDataPoint {
  time: string;
  epoch: number;
  price: number;
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

export interface UseStreamingChartOptions {
  instrument: InstrumentType;
  maxDataPoints?: number;
  indicatorUpdateInterval?: number; // seconds
}

export function useStreamingChart({
  instrument,
  maxDataPoints = 300, // Keep last 5 minutes of tick data (assuming 1 tick per second)
  indicatorUpdateInterval = 60 // Update indicators every 60 seconds
}: UseStreamingChartOptions) {
  const [chartData, setChartData] = useState<StreamingDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  const tickStreamRef = useRef<ReturnType<typeof getTickStream> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastIndicatorUpdateRef = useRef<number>(0);
  const candleDataRef = useRef<CandleData[]>([]);
  const indicatorDataRef = useRef<{
    rsi: number[];
    macd: Array<{ macd: number; signal: number; histogram: number }>;
    bb: Array<{ upper: number; middle: number; lower: number }>;
    ema: number[];
    atr: number[];
  } | null>(null);

  // Calculate technical indicators from candle data
  const calculateIndicators = useCallback(async (candles: CandleData[]) => {
    if (candles.length < 50) return null;
    
    try {
      const prices = candles.map(c => c.close);
      const highPrices = candles.map(c => c.high);
      const lowPrices = candles.map(c => c.low);
      
      const rsiArray = calculateFullRSI(prices, 14);
      const macdArray = calculateFullMACD(prices, 12, 26, 9);
      const bbArray = calculateFullBollingerBands(prices, 20, 2);
      const emaArray = calculateFullEMA(prices, 20);
      const atrArray = calculateFullATR(highPrices, lowPrices, prices, 14);
      
      return {
        rsi: rsiArray,
        macd: macdArray,
        bb: bbArray,
        ema: emaArray,
        atr: atrArray
      };
    } catch (error) {
      console.error('[useStreamingChart] Error calculating indicators:', error);
      return null;
    }
  }, []);

  // Get latest indicator values for a given price index
  const getIndicatorValues = useCallback((priceIndex: number, totalPrices: number) => {
    if (!indicatorDataRef.current) return {};
    
    const indicators = indicatorDataRef.current;
    
    // Calculate indices for each indicator array
    const rsiIndex = priceIndex - (totalPrices - indicators.rsi.length);
    const macdIndex = priceIndex - (totalPrices - indicators.macd.length);
    const bbIndex = priceIndex - (totalPrices - indicators.bb.length);
    const emaIndex = priceIndex - (totalPrices - indicators.ema.length);
    const atrIndex = priceIndex - (totalPrices - indicators.atr.length);
    
    return {
      rsi: rsiIndex >= 0 ? indicators.rsi[rsiIndex] : undefined,
      macdLine: macdIndex >= 0 ? indicators.macd[macdIndex]?.macd : undefined,
      macdSignal: macdIndex >= 0 ? indicators.macd[macdIndex]?.signal : undefined,
      macdHistogram: macdIndex >= 0 ? indicators.macd[macdIndex]?.histogram : undefined,
      bbUpper: bbIndex >= 0 ? indicators.bb[bbIndex]?.upper : undefined,
      bbMiddle: bbIndex >= 0 ? indicators.bb[bbIndex]?.middle : undefined,
      bbLower: bbIndex >= 0 ? indicators.bb[bbIndex]?.lower : undefined,
      ema: emaIndex >= 0 ? indicators.ema[emaIndex] : undefined,
      atr: atrIndex >= 0 ? indicators.atr[atrIndex] : undefined
    };
  }, []);

  // Handle incoming tick data - add each tick as a new data point
  const handleTick = useCallback((tick: PriceTick) => {
    const now = Date.now();
    
    // Check if we need to update indicators
    const shouldUpdateIndicators = (now - lastIndicatorUpdateRef.current) >= (indicatorUpdateInterval * 1000);
    
    if (shouldUpdateIndicators) {
      // Update candle data for indicator calculations
      const currentTime = Math.floor(tick.epoch / 60) * 60; // Round to minute
      const lastCandle = candleDataRef.current[candleDataRef.current.length - 1];
      
      if (!lastCandle || lastCandle.epoch !== currentTime) {
        // New candle
        candleDataRef.current.push({
          time: new Date(currentTime * 1000).toISOString(),
          epoch: currentTime,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price
        });
      } else {
        // Update existing candle
        lastCandle.high = Math.max(lastCandle.high, tick.price);
        lastCandle.low = Math.min(lastCandle.low, tick.price);
        lastCandle.close = tick.price;
      }
      
      // Keep only last 120 candles for indicator calculations
      if (candleDataRef.current.length > 120) {
        candleDataRef.current = candleDataRef.current.slice(-120);
      }
      
      // Recalculate indicators
      calculateIndicators(candleDataRef.current).then(newIndicators => {
        if (newIndicators) {
          indicatorDataRef.current = newIndicators;
          lastIndicatorUpdateRef.current = now;
        }
      });
    }
    
    setChartData(prevData => {
      const newDataPoint: StreamingDataPoint = {
        time: tick.time,
        epoch: tick.epoch,
        price: tick.price,
        ...getIndicatorValues(candleDataRef.current.length - 1, candleDataRef.current.length)
      };
      
      const updatedData = [...prevData, newDataPoint];
      
      // Keep only the last N data points for smooth performance
      if (updatedData.length > maxDataPoints) {
        return updatedData.slice(-maxDataPoints);
      }
      
      return updatedData;
    });
  }, [calculateIndicators, getIndicatorValues, maxDataPoints, indicatorUpdateInterval]);

  // Load initial historical data and convert to streaming format
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[useStreamingChart] Loading initial data for', instrument);
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 15000);
      });
      
      const candles = await Promise.race([
        getCandles(instrument, 120, 60),
        timeoutPromise
      ]);
      
      if (candles && candles.length > 0) {
        console.log('[useStreamingChart] Loaded', candles.length, 'candles');
        
        // Store candle data for indicator calculations
        candleDataRef.current = candles;
        
        // Calculate initial indicators
        const indicators = await calculateIndicators(candles);
        if (indicators) {
          indicatorDataRef.current = indicators;
        }
        
        // Convert candles to streaming data points (use close price for each minute)
        const streamingData: StreamingDataPoint[] = candles.map((candle, index) => ({
          time: candle.time,
          epoch: candle.epoch,
          price: candle.close,
          ...getIndicatorValues(index, candles.length)
        }));
        
        setChartData(streamingData);
        lastIndicatorUpdateRef.current = Date.now();
        
        console.log('[useStreamingChart] Initial streaming data loaded successfully');
      } else {
        setError(`No price data available for ${instrument}`);
      }
    } catch (err) {
      console.error('[useStreamingChart] Error loading initial data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
    } finally {
      setIsLoading(false);
    }
  }, [instrument, calculateIndicators, getIndicatorValues]);

  // Subscribe to real-time tick updates
  useEffect(() => {
    // Initialize tick stream lazily
    if (!tickStreamRef.current) {
      try {
        tickStreamRef.current = getTickStream();
      } catch (error) {
        console.error('[useStreamingChart] Failed to initialize tick stream:', error);
        setError('Failed to initialize WebSocket connection');
        setConnectionStatus('disconnected');
        return;
      }
    }
    
    const tickStream = tickStreamRef.current;
    
    const updateConnectionStatus = () => {
      if (tickStream) {
        setConnectionStatus(tickStream.getConnectionStatus());
      }
    };
    
    updateConnectionStatus();
    const statusInterval = setInterval(updateConnectionStatus, 1000);
    
    let unsubscribe: (() => void) | null = null;
    
    try {
      unsubscribe = tickStream.subscribe(instrument, {
        onTick: handleTick,
        onError: (error) => {
          console.error('[useStreamingChart] Tick stream error:', error);
          setError(error.message);
        },
        onConnect: () => {
          console.log(`[useStreamingChart] Connected to tick stream for ${instrument}`);
          setConnectionStatus('connected');
          setError(null);
        },
        onDisconnect: () => {
          console.log(`[useStreamingChart] Disconnected from tick stream for ${instrument}`);
          setConnectionStatus('disconnected');
        }
      });
      
      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error('[useStreamingChart] Failed to subscribe to tick stream:', error);
      setError('Failed to subscribe to price updates');
    }
    
    return () => {
      clearInterval(statusInterval);
      if (unsubscribe) {
        unsubscribe();
      }
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
