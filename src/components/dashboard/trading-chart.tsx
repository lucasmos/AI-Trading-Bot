// @ts-nocheck
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
    let isActive = true; 
      setIsLoading(true);
      setError(null);

    async function fetchDataAndIndicators() {
      try {
        const candles = await getCandles(instrument, 120); // Fetch candles
        if (!isActive) return;

        if (!candles || candles.length === 0) {
          setError("No price data available for this instrument.");
          setChartData([]);
          setIsLoading(false);
          return;
        }

        const prices = candles.map(candle => candle.close); // Use close prices for indicators
        
        const rsiPeriod = 14;
        const macdFast = 12, macdSlow = 26, macdSignal = 9;
        const bbPeriod = 20, bbStdDev = 2;

        const fullRSI = calculateFullRSI(prices, rsiPeriod);
        const fullMACD = calculateFullMACD(prices, macdFast, macdSlow, macdSignal);
        const fullBB = calculateFullBollingerBands(prices, bbPeriod, bbStdDev);
        const fullEMA = calculateFullEMA(prices, 20);
        const fullATR = calculateFullATR(candles.map(c => c.high), candles.map(c => c.low), candles.map(c => c.close), 14);

        // Align indicators with price ticks. Indicators will have fewer leading values.
        const combinedData: ChartDataPoint[] = candles.map((candle, index) => { // Iterate over candles
          const rsiIndex = index - (prices.length - fullRSI.length); // Adjust index for RSI series
          const macdIndex = index - (prices.length - fullMACD.length); // Adjust index for MACD series
          const bbIndex = index - (prices.length - fullBB.length); // Adjust index for BB series
          const emaIndex = index - (prices.length - fullEMA.length);
          const atrIndex = index - (prices.length - fullATR.length);

          return {
            epoch: candle.epoch,
            time: candle.time,
            price: candle.close, // Use close price as the primary 'price' for the chart
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
        
        setChartData(combinedData);

      } catch (err) {
        if (!isActive) return;
        console.error("Error fetching chart data or calculating indicators:", err);
        setError(err instanceof Error ? err.message : "Failed to load chart data.");
        setChartData([]);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    fetchDataAndIndicators();
    
    // Set up polling for live data updates
    const pollInterval = setInterval(() => {
      if (isActive) {
        fetchDataAndIndicators();
      }
    }, 10000); // Poll every 10 seconds

    return () => {
      isActive = false; 
      clearInterval(pollInterval);
    };
  }, [instrument]); 

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
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
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
              tickFormatter={(value) => value.toFixed(decimalPlaces)} 
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
