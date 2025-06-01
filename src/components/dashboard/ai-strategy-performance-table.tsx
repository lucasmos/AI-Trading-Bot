'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import type { StrategyPerformanceData } from "@/app/api/ai/strategy-performance/route"; // Import the type

interface AiStrategyPerformanceTableProps {
  performanceData: StrategyPerformanceData[];
  isLoading?: boolean;
  error?: string | null;
}

export function AiStrategyPerformanceTable({
  performanceData,
  isLoading = false,
  error = null,
}: AiStrategyPerformanceTableProps) {
  if (isLoading) {
    return <p className="text-center text-muted-foreground">Loading strategy performance...</p>;
  }

  if (error) {
    return <p className="text-center text-destructive">Error loading performance data: {error}</p>;
  }

  if (!performanceData || performanceData.length === 0) {
    return <p className="text-center text-muted-foreground">No AI strategy performance data available yet.</p>;
  }

  return (
    <Table>
      <TableCaption>Historical performance of AI trading strategies.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Strategy Name</TableHead>
          <TableHead className="text-right">Total Trades</TableHead>
          <TableHead className="text-right">Winning Trades</TableHead>
          <TableHead className="text-right">Losing Trades</TableHead>
          <TableHead className="text-right">Win Rate (%)</TableHead>
          <TableHead className="text-right">Total PnL ($)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {performanceData.map((strategy) => (
          <TableRow key={strategy.strategyId}>
            <TableCell className="font-medium">{strategy.strategyName}</TableCell>
            <TableCell className="text-right">{strategy.totalTrades}</TableCell>
            <TableCell className="text-right text-green-600">{strategy.winningTrades}</TableCell>
            <TableCell className="text-right text-red-600">{strategy.losingTrades}</TableCell>
            <TableCell className="text-right">{strategy.winRate.toFixed(2)}%</TableCell>
            <TableCell 
              className={`text-right font-semibold ${strategy.totalPnl > 0 ? 'text-green-600' : strategy.totalPnl < 0 ? 'text-red-600' : 'text-muted-foreground'}`}
            >
              {strategy.totalPnl.toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 