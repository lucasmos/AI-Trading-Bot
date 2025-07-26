'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, ComposedChart, Legend } from "recharts";
import { Loader2, TrendingUp, TrendingDown, Activity, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import type { InstrumentType, PriceTick, CandleData } from '@/types';
import { useStreamingChart } from '@/hooks/use-streaming-chart';
import { Skeleton } from '@/components/ui/skeleton';
import { getInstrumentDecimalPlaces } from '@/lib/utils';

// Helper function to get clean display names for chart tabs
function getChartTabLabel(instrument: string): string {
  switch (instrument) {
    case 'Volatility 10 Index': return 'V10';
    case 'Volatility 25 Index': return 'V25';
    case 'Volatility 50 Index': return 'V50';
    case 'Volatility 75 Index': return 'V75';
    case 'Volatility 100 Index': return 'V100';
    case 'Volatility 10 (1s) Index': return 'V10 (1s)';
    case 'Volatility 25 (1s) Index': return 'V25 (1s)';
    case 'Volatility 50 (1s) Index': return 'V50 (1s)';
    case 'Volatility 75 (1s) Index': return 'V75 (1s)';
    case 'Volatility 100 (1s) Index': return 'V100 (1s)';
    default: return instrument;
  }
}

// Helper function to get update interval based on instrument type
function getUpdateInterval(instrument: string): number {
  // (1s) indices update every 1 second (1000ms)
  if (instrument.includes('(1s)')) {
    return 1000;
  }
  // Regular volatility indices update every 2 seconds (2000ms)
  return 2000;
}

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
    color: "#f59e0b", // Amber color that works well in both light and dark modes
  },
  stochasticK: {
    label: "Stochastic %K",
    color: "#8b5cf6", // Purple color for good visibility
  },
  stochasticD: {
    label: "Stochastic %D",
    color: "#06b6d4", // Cyan color for good visibility
  },
  williamsR: {
    label: "Williams %R",
    color: "#f97316", // Orange color for good visibility
  },
  cci: {
    label: "CCI",
    color: "#ec4899", // Pink color for good visibility in both themes
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
  stochasticK: { label: string; color: string };
  stochasticD: { label: string; color: string };
  williamsR: { label: string; color: string };
  cci: { label: string; color: string };
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
  stochasticK?: number;
  stochasticD?: number;
  williamsR?: number;
  cci?: number;
}

function SingleInstrumentChartDisplay({ instrument }: SingleInstrumentChartDisplayProps) {
  const { chartData, isLoading, error, connectionStatus, refresh } = useStreamingChart({
    instrument,
    maxDataPoints: 300,
    indicatorUpdateInterval: 60
  });

  const decimalPlaces = useMemo(() => getInstrumentDecimalPlaces(instrument), [instrument]);

  // Connection status indicator functions
  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Real-time Ticks';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Disconnected';
    }
  };

  // Calculate Y-axis domain for price chart, including BB
  const yDomainPrice = useMemo(() => {
    if (chartData.length === 0) return ['auto', 'auto'];
    const prices = chartData.map(d => d.price);
    const bbUppers = chartData.map(d => d.bbUpper).filter(v => v !== undefined) as number[];
    const bbLowers = chartData.map(d => d.bbLower).filter(v => v !== undefined) as number[];
    const allValues = [...prices, ...bbUppers, ...bbLowers];
    if (allValues.length === 0) return ['auto', 'auto'];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1;
    return [min - padding > 0 ? min - padding : 0 , max + padding];
  }, [chartData]);








  if (isLoading) {
    return (
      <div className="h-[500px] w-full flex flex-col space-y-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading chart data...</span>
          </div>
          <div className="flex items-center gap-2">
            {getConnectionStatusIcon()}
            <span className="text-sm text-muted-foreground">{getConnectionStatusText()}</span>
          </div>
        </div>
        <Skeleton className="h-[60%] w-full" />
        <Skeleton className="h-[20%] w-full" />
        <Skeleton className="h-[20%] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <Alert className="mb-4">
          <AlertDescription className="text-red-500">
            Error: {error}
          </AlertDescription>
        </Alert>
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            {getConnectionStatusIcon()}
            <span className="text-sm text-muted-foreground">{getConnectionStatusText()}</span>
          </div>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground mb-4">No data to display.</p>
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            {getConnectionStatusIcon()}
            <span className="text-sm text-muted-foreground">{getConnectionStatusText()}</span>
          </div>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Connection Status Header */}
      <div className="flex items-center justify-between mb-4 p-2 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <span className="text-sm font-medium">{getChartTabLabel(instrument)} - Streaming Chart</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {getConnectionStatusIcon()}
            <span className="text-sm">{getConnectionStatusText()}</span>
          </div>
          <Badge variant={connectionStatus === 'connected' ? 'default' : 'secondary'}>
            {chartData.length} candles
          </Badge>
          <Button onClick={refresh} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ChartContainer config={typedChartConfig} className="min-h-[200px] w-full">
        <>
          {/* Price + Bollinger Bands Chart */}
          <div style={{ width: '100%', height: '250px' }} className="mb-4">
        <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                tickMargin={5}
                type="category"
                scale="point"
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                domain={yDomainPrice}
                tickFormatter={(value: number) => value.toFixed(decimalPlaces)}
                tick={{ fontSize: 10 }}
                tickMargin={5}
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="line" />}
                labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                formatter={(value: any, name: string) => [
                  typeof value === 'number' ? value.toFixed(decimalPlaces) : value,
                  name
                ]}
              />
              <Legend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey="price"
                stroke={chartConfig.price.color}
                strokeWidth={2}
                dot={false}
                yAxisId="left"
                name="Price"
                connectNulls={true}
                animationDuration={0}
              />
              <Line
                type="monotone"
                dataKey="bbUpper"
                stroke={chartConfig.bbUpper.color}
                strokeDasharray="3 3"
                dot={false}
                yAxisId="left"
                name="BB Upper"
                connectNulls={true}
                animationDuration={0}
              />
              <Line
                type="monotone"
                dataKey="bbMiddle"
                stroke={chartConfig.bbMiddle.color}
                strokeDasharray="5 5"
                dot={false}
                yAxisId="left"
                name="BB Middle"
                connectNulls={true}
                animationDuration={0}
              />
              <Line
                type="monotone"
                dataKey="bbLower"
                stroke={chartConfig.bbLower.color}
                strokeDasharray="3 3"
                dot={false}
                yAxisId="left"
                name="BB Lower"
                connectNulls={true}
                animationDuration={0}
              />
              <Line
                type="monotone"
                dataKey="ema"
                stroke={chartConfig.ema.color}
                strokeWidth={2}
                dot={false}
                yAxisId="left"
                name="EMA (20)"
                connectNulls={true}
                animationDuration={0}
              />
            </LineChart>
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
              <Line
                type="monotone"
                dataKey="rsi"
                stroke={chartConfig.rsi.color}
                strokeWidth={2}
                dot={false}
                yAxisId="left"
                name="RSI"
                connectNulls={true}
                animationDuration={0}
              />
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
              <Line
                type="monotone"
                dataKey="macdLine"
                stroke={chartConfig.macdLine.color}
                strokeWidth={2}
                dot={false}
                yAxisId="left"
                name="MACD Line"
                connectNulls={true}
                animationDuration={0}
              />
              <Line
                type="monotone"
                dataKey="macdSignal"
                stroke={chartConfig.macdSignal.color}
                strokeWidth={2}
                dot={false}
                yAxisId="left"
                name="Signal Line"
                connectNulls={true}
                animationDuration={0}
              />
              <Bar dataKey="macdHistogram" yAxisId="left" name="Histogram">
                {chartData.map((entry, index) => (
                  <Bar
                    key={`cell-${index}`}
                    dataKey="macdHistogram"
                    fill={(entry.macdHistogram ?? 0) >= 0 ? chartConfig.macdHistogram.colorPositive : chartConfig.macdHistogram.colorNegative}
                  />
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
              <Line
                type="monotone"
                dataKey="atr"
                stroke={chartConfig.atr.color}
                strokeWidth={2}
                dot={false}
                yAxisId="left"
                name="ATR"
                connectNulls={true}
                animationDuration={0}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-1 px-2">
          <strong>Average True Range (ATR):</strong> Measures market volatility. Higher ATR indicates higher volatility, helping determine stop-loss levels and position sizing.
        </p>

        {/* Stochastic Oscillator Chart */}
        <div style={{ width: '100%', height: '100px' }} className="mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={5} hide />
              <YAxis yAxisId="left" orientation="left" domain={[0, 100]} tick={{ fontSize: 10 }} tickMargin={5} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Legend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="stochasticK" stroke={chartConfig.stochasticK.color} strokeWidth={2} dot={false} yAxisId="left" name="Stochastic %K" />
              <Line type="monotone" dataKey="stochasticD" stroke={chartConfig.stochasticD.color} strokeWidth={2} dot={false} yAxisId="left" name="Stochastic %D" />
              {/* Reference lines for overbought/oversold */}
              <Line type="monotone" dataKey={() => 80} stroke="#ff6b6b" strokeDasharray="2 2" strokeWidth={1} dot={false} yAxisId="left" name="Overbought (80)" />
              <Line type="monotone" dataKey={() => 20} stroke="#51cf66" strokeDasharray="2 2" strokeWidth={1} dot={false} yAxisId="left" name="Oversold (20)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-1 px-2">
          <strong>Stochastic Oscillator:</strong> Momentum indicator comparing closing price to price range. %K is fast line, %D is slow line. Values above 80 indicate overbought, below 20 oversold.
        </p>

        {/* Williams %R Chart */}
        <div style={{ width: '100%', height: '100px' }} className="mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={5} hide />
              <YAxis yAxisId="left" orientation="left" domain={[-100, 0]} tick={{ fontSize: 10 }} tickMargin={5} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Legend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="williamsR" stroke={chartConfig.williamsR.color} strokeWidth={2} dot={false} yAxisId="left" name="Williams %R" />
              {/* Reference lines for overbought/oversold */}
              <Line type="monotone" dataKey={() => -20} stroke="#ff6b6b" strokeDasharray="2 2" strokeWidth={1} dot={false} yAxisId="left" name="Overbought (-20)" />
              <Line type="monotone" dataKey={() => -80} stroke="#51cf66" strokeDasharray="2 2" strokeWidth={1} dot={false} yAxisId="left" name="Oversold (-80)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-1 px-2">
          <strong>Williams %R:</strong> Momentum oscillator measuring overbought/oversold levels. Values above -20 indicate overbought conditions, below -80 oversold conditions.
        </p>

        {/* CCI Chart */}
        <div style={{ width: '100%', height: '100px' }} className="mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={5} hide />
              <YAxis yAxisId="left" orientation="left" domain={[-200, 200]} tick={{ fontSize: 10 }} tickMargin={5} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Legend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="cci" stroke={chartConfig.cci.color} strokeWidth={2} dot={false} yAxisId="left" name="CCI" />
              {/* Reference lines for overbought/oversold */}
              <Line type="monotone" dataKey={() => 100} stroke="#ff6b6b" strokeDasharray="2 2" strokeWidth={1} dot={false} yAxisId="left" name="Overbought (100)" />
              <Line type="monotone" dataKey={() => -100} stroke="#51cf66" strokeDasharray="2 2" strokeWidth={1} dot={false} yAxisId="left" name="Oversold (-100)" />
              <Line type="monotone" dataKey={() => 0} stroke="#868e96" strokeDasharray="1 1" strokeWidth={1} dot={false} yAxisId="left" name="Zero Line" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-1 px-2">
          <strong>Commodity Channel Index (CCI):</strong> Identifies cyclical trends and reversal points. Values above +100 indicate overbought, below -100 oversold. Measures price deviation from statistical mean.
        </p>
      </>
    </ChartContainer>
    </div>
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
    <Card className="shadow-lg min-h-[1450px]">
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
                {getChartTabLabel(inst)}
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
