'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, ComposedChart, Legend } from "recharts";
import type { InstrumentType, PriceTick, CandleData } from '@/types';
import { getCandles } from '@/services/deriv';
import { Skeleton } from '@/components/ui/skeleton';
import { getInstrumentDecimalPlaces } from '@/lib/utils';
import { calculateFullRSI, calculateFullMACD, calculateFullBollingerBands, calculateFullEMA, calculateFullATR } from '@/lib/technical-analysis';

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--chart-1))", // Using themeable colors
  },
  bbUpper: {
    label: "BB Upper",
    color: "hsl(var(--chart-2))",
  },
  bbMiddle: {
    label: "BB Middle",
    color: "hsl(var(--chart-3))",
  },
  bbLower: {
    label: "BB Lower",
    color: "hsl(var(--chart-2))", 
  },
  ema: {
    label: "EMA (20)",
    color: "hsl(var(--chart-6))",
  },
  rsi: {
    label: "RSI",
    color: "hsl(var(--chart-4))",
  },
  macdLine: {
    label: "MACD",
    color: "hsl(var(--chart-5))",
  },
  macdSignal: {
    label: "Signal",
    color: "hsl(var(--chart-1))", // Re-using a color, or define more chart colors
  },
  macdHistogram: {
    label: "Histogram",
    colorPositive: "hsl(var(--chart-2))", // Example for positive histogram bars
    colorNegative: "hsl(var(--chart-3))", // Example for negative histogram bars
  },
  atr: {
    label: "ATR",
    color: "hsl(var(--chart-7))",
  }
};

// Define a more specific type for chartConfig
// This mirrors the structure of the chartConfig object
type ChartConfigType = {
  price: { label: string; color: string };
  bbUpper: { label: string; color: string };
  bbMiddle: { label: string; color: string };
  bbLower: { label: string; color: string };
  ema: { label: string; color: string };
  rsi: { label: string; color: string };
  macdLine: { label: string; color: string };
  macdSignal: { label: string; color: string };
  macdHistogram: { label: string; colorPositive: string; colorNegative: string };
  atr: { label: string; color: string };
};

// Explicitly type chartConfig
const typedChartConfig: ChartConfigType = chartConfig;


interface SingleInstrumentChartDisplayProps {
  instrument: InstrumentType;
}

interface ChartDataPoint {
  epoch: number;
  time: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
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

function SingleInstrumentChartDisplay({ instrument }: SingleInstrumentChartDisplayProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const decimalPlaces = useMemo(() => getInstrumentDecimalPlaces(instrument), [instrument]);

  // Calculate Y-axis domain for price chart, including BB
  // This must be called unconditionally before any early returns.
  const yDomainPrice = useMemo(() => {
    if (chartData.length === 0) return ['auto', 'auto']; // Handle empty chartData early
    const prices = chartData.map(d => d.price);
    const bbUppers = chartData.map(d => d.bbUpper).filter(v => v !== undefined) as number[];
    const bbLowers = chartData.map(d => d.bbLower).filter(v => v !== undefined) as number[];
    const allValues = [...prices, ...bbUppers, ...bbLowers];
    if (allValues.length === 0) return ['auto', 'auto'];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1;
    return [min - padding > 0 ? min - padding : 0 , max + padding]; // Ensure min isn't negative if data is all positive
  }, [chartData]);

  useEffect(() => {
    // isActive flag: Prevents state updates if the component unmounts or dependencies change before an async operation completes.
    let isActive = true; 
    let lastFetchTime = 0; // Used with Page Visibility API

    setIsLoading(true);
    setError(null);

    async function fetchDataAndIndicators() {
      // If the tab is hidden, don't fetch.
      // This is a simple way to pause polling when the user is not viewing the tab.
      if (document.hidden) {
        // console.log(`Tab hidden, skipping fetch for ${instrument}`); // Optional: for debugging
        return;
      }
      lastFetchTime = Date.now(); // Record time of fetch attempt

      try {
        // Fetch latest candle data for the instrument.
        // Polling is used here for simplicity; a WebSocket stream would be more efficient for real-time updates.
        const candles: CandleData[] | null = await getCandles(instrument, 120);
        if (!isActive) return; // Check isActive after await

        if (!candles || candles.length === 0) {
          if (isActive) { // Ensure component is still active before setting state
            setError(`No price data available for ${instrument}.`);
            setChartData([]); // Clear data if instrument has no candles
            setIsLoading(false); // Stop loading if no data
          }
          return;
        }

        const prices = candles.map(candle => candle.close);
        
        // Calculate various technical indicators
        const rsiPeriod = 14;
        const macdFast = 12, macdSlow = 26, macdSignal = 9;
        const bbPeriod = 20, bbStdDev = 2;

        const fullRSI = calculateFullRSI(prices, rsiPeriod);
        const fullMACD = calculateFullMACD(prices, macdFast, macdSlow, macdSignal);
        const fullBB = calculateFullBollingerBands(prices, bbPeriod, bbStdDev);
        const fullEMA = calculateFullEMA(prices, 20); // EMA 20
        const fullATR = calculateFullATR(candles.map(c => c.high), candles.map(c => c.low), candles.map(c => c.close), 14); // ATR 14

        // Combine candle data with calculated indicators.
        // Technical indicators (like RSI, MACD, EMA, Bollinger Bands, ATR) require a certain number of initial data points (their 'period')
        // to compute their first value. For example, a 14-period RSI cannot be calculated for the first 13 data points.
        // Consequently, the arrays returned by indicator calculation functions (`fullRSI`, `fullMACD`, etc.)
        // will be shorter than the input `prices` array, missing values at the beginning.
        //
        // The logic below aligns these shorter indicator arrays with the main `candles` array.
        // It calculates an `indicatorIndex` for each candle. If this `indicatorIndex` is negative,
        // it means the indicator doesn't have a value for that particular candle (it's too early in the dataset),
        // so `undefined` is assigned. Otherwise, the value from the indicator array at `indicatorIndex` is used.
        //
        // The term `(prices.length - indicatorArray.length)` calculates the number of leading candles
        // for which the specific indicator is not yet available. Let this be `offset`.
        // The `indicatorIndex` is then `candleIndex - offset`.
        // So, when `candleIndex` equals `offset`, `indicatorIndex` becomes `0`, correctly mapping
        // the first available indicator value to the candle at `candles[offset]`.
        const combinedData: ChartDataPoint[] = candles.map((candle, index) => {
          // Calculate the effective index for each indicator array.
          // If (prices.length - indicatorArray.length) is, for example, 13 (for a 14-period RSI),
          // then for the first candle (index 0), rsiIndex = 0 - 13 = -13 (undefined).
          // For the 14th candle (index 13), rsiIndex = 13 - 13 = 0 (first RSI value).
          const rsiIndex = index - (prices.length - fullRSI.length);
          const macdIndex = index - (prices.length - fullMACD.length); // MACD calculations also result in shorter arrays due to multiple EMAs and signal lines.
          const bbIndex = index - (prices.length - fullBB.length);
          const emaIndex = index - (prices.length - fullEMA.length);
          const atrIndex = index - (prices.length - fullATR.length);

          // Construct the data point for the chart.
          // If `indicatorIndex` is negative (or if the indicator array was empty to begin with, making `indicatorIndex` always < 0 for valid candle `index`),
          // the conditional access `indicatorIndex >= 0 ? indicatorArray[indicatorIndex] : undefined`
          // correctly assigns `undefined`. Recharts handles `undefined` values by creating gaps in lines.
          return {
            epoch: candle.epoch,
            time: candle.time,
            price: candle.close,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            rsi: rsiIndex >= 0 ? fullRSI[rsiIndex] : undefined,
            macdLine: macdIndex >= 0 ? fullMACD[macdIndex]?.macd : undefined,
            macdSignal: macdIndex >= 0 ? fullMACD[macdIndex]?.signal : undefined,
            macdHistogram: macdIndex >= 0 ? fullMACD[macdIndex]?.histogram : undefined,
            bbUpper: bbIndex >= 0 ? fullBB[bbIndex]?.upper : undefined,
            bbMiddle: bbIndex >= 0 ? fullBB[bbIndex]?.middle : undefined,
            bbLower: bbIndex >= 0 ? fullBB[bbIndex]?.lower : undefined,
            ema: emaIndex >= 0 ? fullEMA[emaIndex] : undefined,
            atr: atrIndex >= 0 ? fullATR[atrIndex] : undefined,
          };
        });
        
        if (isActive) { // Ensure component is still active
          setChartData(combinedData);
          setError(null); // Clear any previous error on successful fetch
        }
      } catch (err) {
        if (!isActive) return; // Check isActive after await
        console.error(`Error fetching chart data or calculating indicators for ${instrument}:`, err);
        if (isActive) { // Ensure component is still active
          setError(err instanceof Error ? err.message : "Failed to load chart data.");
          // Optionally, decide if chartData should be cleared or kept stale on error
          // setChartData([]); // Current behavior is to clear, which might be fine.
        }
      } finally {
        if (isActive) setIsLoading(false); // Stop loading regardless of success/failure
      }
    }

    // Initial data fetch when component mounts or instrument changes
    fetchDataAndIndicators();
    
    // Set up polling for live data updates at a 10-second interval.
    const pollingIntervalMs = 10000;
    const pollIntervalId = setInterval(() => {
      if (isActive) { // Only fetch if component is active
        fetchDataAndIndicators();
      }
    }, pollingIntervalMs);

    // Handler for page visibility changes
    const handleVisibilityChange = () => {
      if (isActive && !document.hidden) {
        // If tab becomes visible and a fetch was likely missed (e.g., more than pollingIntervalMs since last fetch attempt)
        // or simply fetch immediately to refresh data.
        // Adding a small buffer (e.g., 1s) to pollingIntervalMs to avoid fetching too close to a scheduled poll.
        if (Date.now() - lastFetchTime > pollingIntervalMs - 1000) {
          // console.log(`Tab became visible, fetching data for ${instrument}`); // Optional: for debugging
          fetchDataAndIndicators();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function:
    // This runs when the component unmounts or when the `instrument` dependency changes.
    return () => {
      isActive = false; // Set isActive to false to stop any pending async operations from updating state.
      clearInterval(pollIntervalId); // Clear the interval to stop polling.
      document.removeEventListener('visibilitychange', handleVisibilityChange); // Remove visibility change listener.
    };
  }, [instrument]); // Re-run effect if instrument changes

  if (isLoading) {
    return (
      <div className="h-[500px] w-full flex flex-col space-y-2">
        <Skeleton className="h-[60%] w-full" />
        <Skeleton className="h-[20%] w-full" />
        <Skeleton className="h-[20%] w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-500 py-10">Error: {error}</p>;
  }

  if (chartData.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No data to display.</p>;
  }

  return (
    <ChartContainer config={typedChartConfig} className="min-h-[200px] w-full">
      {/* Price + Bollinger Bands Chart */}
      <div style={{ width: '100%', height: '250px' }} className="mb-4">
      <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={5} />
          <YAxis 
              yAxisId="left"
              orientation="left" 
              domain={yDomainPrice} 
              tickFormatter={(value: number) => value.toFixed(decimalPlaces)}
              tick={{ fontSize: 10 }}
              tickMargin={5}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Legend content={<ChartLegendContent />} />
            <Line type="monotone" dataKey="price" stroke={chartConfig.price.color} strokeWidth={2} dot={false} yAxisId="left" name="Price" />
            <Line type="monotone" dataKey="bbUpper" stroke={chartConfig.bbUpper.color} strokeDasharray="3 3" dot={false} yAxisId="left" name="BB Upper" />
            <Line type="monotone" dataKey="bbMiddle" stroke={chartConfig.bbMiddle.color} strokeDasharray="5 5" dot={false} yAxisId="left" name="BB Middle" />
            <Line type="monotone" dataKey="bbLower" stroke={chartConfig.bbLower.color} strokeDasharray="3 3" dot={false} yAxisId="left" name="BB Lower" />
            <Line type="monotone" dataKey="ema" stroke={chartConfig.ema.color} strokeWidth={2} dot={false} yAxisId="left" name="EMA (20)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground mt-1 px-2">
        <strong>Bollinger Bands (BB):</strong> Represent volatility. The price typically stays within the upper and lower bands. Breakouts can signal trading opportunities.
      </p>

      {/* RSI Chart */}
      <div style={{ width: '100%', height: '100px' }} className="mb-4 mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={5} hide />
            <YAxis yAxisId="left" orientation="left" domain={[0, 100]} tick={{ fontSize: 10 }} tickMargin={5} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Legend content={<ChartLegendContent />} />
            <Line type="monotone" dataKey="rsi" stroke={chartConfig.rsi.color} strokeWidth={2} dot={false} yAxisId="left" name="RSI" />
        </LineChart>
      </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground mt-1 px-2">
        <strong>Relative Strength Index (RSI):</strong> A momentum oscillator measuring speed and change of price movements. Values above 70 may indicate overbought conditions, below 30 oversold.
      </p>

      {/* MACD Chart */}
      <div style={{ width: '100%', height: '100px' }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={5} hide />
            <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10 }} tickMargin={5} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend content={<ChartLegendContent />} />
            <Line type="monotone" dataKey="macdLine" stroke={chartConfig.macdLine.color} strokeWidth={2} dot={false} yAxisId="left" name="MACD Line" />
            <Line type="monotone" dataKey="macdSignal" stroke={chartConfig.macdSignal.color} strokeWidth={2} dot={false} yAxisId="left" name="Signal Line" />
            <Bar dataKey="macdHistogram" yAxisId="left" name="Histogram">
              {chartData.map((entry, index) => (
                <Bar key={`cell-${index}`} fill={(entry.macdHistogram ?? 0) >= 0 ? chartConfig.macdHistogram.colorPositive : chartConfig.macdHistogram.colorNegative} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground mt-1 px-2">
        <strong>Moving Average Convergence Divergence (MACD):</strong> Shows the relationship between two moving averages of a security's price. Crossovers of the MACD line and signal line can indicate buy/sell signals.
      </p>

      {/* ATR Chart */}
      <div style={{ width: '100%', height: '100px' }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={5} hide />
            <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10 }} tickMargin={5} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Legend content={<ChartLegendContent />} />
            <Line type="monotone" dataKey="atr" stroke={chartConfig.atr.color} strokeWidth={2} dot={false} yAxisId="left" name="ATR" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground mt-1 px-2">
        <strong>Average True Range (ATR):</strong> Measures market volatility. Higher ATR indicates higher volatility, helping determine stop-loss levels and position sizing.
      </p>
    </ChartContainer>
  );
}

interface TradingChartProps {
  instrument: InstrumentType;
  onInstrumentChange: (instrument: InstrumentType) => void;
  instrumentsToShow: InstrumentType[]; // Added prop to specify which instruments to show
  isMarketOpen: boolean; // New prop
  marketStatusMessage: string | null; // New prop
}

export function TradingChart({ instrument, onInstrumentChange, instrumentsToShow, isMarketOpen, marketStatusMessage }: TradingChartProps) {
  return (
    <Card className="shadow-lg col-span-1 md:col-span-2 min-h-[900px]">
      <CardHeader>
        <CardTitle>Market Watch</CardTitle>
        <CardDescription>Live price action for selected instruments.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={instrument} onValueChange={(value) => onInstrumentChange(value as InstrumentType)} className="w-full">
          <TabsList 
            className="w-full justify-start overflow-x-auto whitespace-nowrap scrollbar-hide mb-4"
            style={{ WebkitOverflowScrolling: 'touch' }} // For iOS Safari smooth scrolling
          >
            {instrumentsToShow.map((inst) => (
              <TabsTrigger key={inst} value={inst}>
                {inst}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {isMarketOpen ? (
            instrumentsToShow.map((inst) => (
              <TabsContent key={inst} value={inst} className="w-full">
                <SingleInstrumentChartDisplay instrument={inst} />
              </TabsContent>
            ))
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg font-semibold">Market Closed</p>
              <p>{marketStatusMessage || "This market is currently closed."}</p>
            </div>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
