'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DerivTradeRecord } from '@/types';
import {
  getTradeTypeDisplay,
  getInstrumentDisplay,
  getDurationDisplay,
  formatDate,
  formatTime,
  generateLongcode
} from '@/utils/deriv-trade-utils';

interface DerivTradeTableProps {
  trades: DerivTradeRecord[];
  showAccountType?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
}

export function DerivTradeTable({ 
  trades, 
  showAccountType = true, 
  maxHeight = "600px",
  emptyMessage = "No trades available"
}: DerivTradeTableProps) {
  
  const getStatusBadge = (profitLoss: number, sellPrice?: number) => {
    // For all trades, only show Profit or Loss based on P/L value
    // CRITICAL FIX: If no selling price or sellPrice = 0, treat as loss and display red badge
    
    // If no selling price or sellPrice = 0, treat as loss
    if (sellPrice === undefined || sellPrice === null || sellPrice === 0) {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full">Loss</Badge>;
    }

    if (profitLoss > 0) {
      return <Badge className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full">Profit</Badge>;
    } else if (profitLoss < 0) {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full">Loss</Badge>;
    } else {
      // For zero P/L with valid sell price, show Break Even
      return <Badge variant="outline" className="px-3 py-1 rounded-full">Break Even</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    // Ensure numeric and handle cents normalization edge-cases
    const value = Number.isFinite(amount) ? amount : 0;
    return `$${value.toFixed(2)}`;
  };

  const formatProfitLoss = (profitLoss: number) => {
    const formatted = formatCurrency(Math.abs(profitLoss));
    if (profitLoss > 0) {
      return <span className="text-green-600 font-medium">+{formatted}</span>;
    } else if (profitLoss < 0) {
      return <span className="text-red-600 font-medium">-{formatted}</span>;
    } else {
      return <span className="text-gray-500">{formatted}</span>;
    }
  };

  if (trades.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ScrollArea className={`w-full`} style={{ height: maxHeight }}>
      <div className="overflow-x-auto">
        <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Contract ID</TableHead>
            <TableHead>Transaction ID</TableHead>
            <TableHead>Trade Type</TableHead>
            <TableHead>Instrument</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Buy Price</TableHead>
            <TableHead className="text-right">Payout</TableHead>
            <TableHead className="text-right">Profit/Loss</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>Purchase Time</TableHead>
            <TableHead>Sell Time</TableHead>
            <TableHead>App ID</TableHead>
            <TableHead className="max-w-[200px]">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.contract_id}>
              {/* Contract ID */}
              <TableCell className="font-mono text-xs">
                {String(trade.contract_id).slice(-8)}...
              </TableCell>

              {/* Transaction ID */}
              <TableCell className="font-mono text-xs">
                {trade.transaction_id ? String(trade.transaction_id).slice(-8) + '...' : 'N/A'}
              </TableCell>

              {/* Trade Type */}
              <TableCell>
                <Badge variant="outline" className="font-medium">
                  {trade.trade_type_display || getTradeTypeDisplay(trade.contract_type)}
                </Badge>
              </TableCell>

              {/* Instrument */}
              <TableCell className="text-sm">
                {trade.instrument_display || getInstrumentDisplay(trade.underlying_symbol)}
              </TableCell>

              {/* Duration */}
              <TableCell className="text-sm">
                {trade.duration_display || getDurationDisplay(trade.longcode)}
              </TableCell>

              {/* Buy Price */}
              <TableCell className="text-right font-medium">
                {formatCurrency(trade.buy_price)}
              </TableCell>

              {/* Payout */}
              <TableCell className="text-right">
                {formatCurrency(trade.payout)}
              </TableCell>

              {/* Profit/Loss */}
              <TableCell className="text-right">
                {formatProfitLoss(trade.profit_loss)}
              </TableCell>

              {/* Status */}
              <TableCell className="text-center">
                {getStatusBadge(trade.profit_loss, trade.sell_price)}
              </TableCell>

              {/* Purchase Time */}
              <TableCell className="text-sm">
                <div className="flex flex-col">
                  <span>{trade.purchase_date || formatDate(Number(trade.purchase_time))}</span>
                  <span className="text-xs text-muted-foreground">
                    {trade.purchase_time_display || formatTime(Number(trade.purchase_time))}
                  </span>
                </div>
              </TableCell>

              {/* Sell Time */}
              <TableCell className="text-sm">
                {trade.sell_time ? (
                  <div className="flex flex-col">
                    <span>{trade.sell_date || formatDate(Number(trade.sell_time))}</span>
                    <span className="text-xs text-muted-foreground">
                      {trade.sell_time_display || formatTime(Number(trade.sell_time))}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>

              {/* App ID */}
              <TableCell className="font-mono text-xs">
                {trade.app_id || 'N/A'}
              </TableCell>

              {/* Description (Longcode) */}
              <TableCell className="max-w-[200px]">
                <div
                  className="text-xs text-muted-foreground truncate"
                  title={trade.longcode}
                >
                  {trade.longcode || generateLongcode(trade)}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}

// Compact version for active trades monitoring
export function CompactDerivTradeTable({ 
  trades, 
  maxHeight = "400px",
  emptyMessage = "No active trades"
}: DerivTradeTableProps) {
  
  const getStatusBadge = (profitLoss: number, sellPrice?: number) => {
    // For all trades, only show Profit or Loss based on P/L value
    // CRITICAL FIX: If no selling price or sellPrice = 0, treat as loss and display red badge
    
    // If no selling price or sellPrice = 0, treat as loss
    if (sellPrice === undefined || sellPrice === null || sellPrice === 0) {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded-full">Loss</Badge>;
    }

    if (profitLoss > 0) {
      return <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-full">Profit</Badge>;
    } else if (profitLoss < 0) {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded-full">Loss</Badge>;
    } else {
      // For zero P/L with valid sell price, show Break Even
      return <Badge variant="outline" className="text-xs px-3 py-1 rounded-full">Break Even</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    const value = Number.isFinite(amount) ? amount : 0;
    return `$${value.toFixed(2)}`;
  };

  const formatProfitLoss = (profitLoss: number) => {
    const formatted = formatCurrency(Math.abs(profitLoss));
    if (profitLoss > 0) {
      return <span className="text-green-600 font-medium text-sm">+{formatted}</span>;
    } else if (profitLoss < 0) {
      return <span className="text-red-600 font-medium text-sm">-{formatted}</span>;
    } else {
      return <span className="text-gray-500 text-sm">{formatted}</span>;
    }
  };

  if (trades.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ScrollArea className={`w-full`} style={{ height: maxHeight }}>
      <div className="overflow-x-auto">
        <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Contract ID</TableHead>
            <TableHead className="text-xs">Trade Type</TableHead>
            <TableHead className="text-xs">Instrument</TableHead>
            <TableHead className="text-xs">Ticks</TableHead>
            <TableHead className="text-right text-xs">Buy Price</TableHead>
            <TableHead className="text-right text-xs">Payout</TableHead>
            <TableHead className="text-right text-xs">P&L</TableHead>
            <TableHead className="text-center text-xs">Status</TableHead>
            <TableHead className="text-xs">Purchase Time</TableHead>
            <TableHead className="text-xs">Sell Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.contract_id} className="text-sm">
              {/* Contract ID */}
              <TableCell className="font-mono text-xs">
                {String(trade.contract_id).slice(-6)}...
              </TableCell>

              {/* Trade Type */}
              <TableCell>
                <Badge variant="outline" className="text-xs font-medium">
                  {trade.trade_type_display}
                </Badge>
              </TableCell>

              {/* Instrument */}
              <TableCell className="text-xs">
                {trade.instrument_display || getInstrumentDisplay(trade.underlying_symbol)}
              </TableCell>

              {/* Number of Ticks */}
              <TableCell className="text-xs font-medium">
                {trade.tick_duration || 1}
              </TableCell>

              {/* Buy Price */}
              <TableCell className="text-right text-sm font-medium">
                {formatCurrency(trade.buy_price)}
              </TableCell>

              {/* Payout */}
              <TableCell className="text-right text-sm">
                {formatCurrency(trade.payout)}
              </TableCell>

              {/* Profit/Loss */}
              <TableCell className="text-right">
                {formatProfitLoss(trade.profit_loss)}
              </TableCell>

              {/* Status */}
              <TableCell className="text-center">
                {getStatusBadge(trade.profit_loss, trade.sell_price)}
              </TableCell>

              {/* Purchase Time */}
              <TableCell className="text-xs">
                <div className="flex flex-col">
                  <span>{trade.purchase_date || formatDate(Number(trade.purchase_time))}</span>
                  <span className="text-xs text-muted-foreground">
                    {trade.purchase_time_display || formatTime(Number(trade.purchase_time))}
                  </span>
                </div>
              </TableCell>

              {/* Sell Time */}
              <TableCell className="text-xs">
                {trade.sell_time ? (
                  <div className="flex flex-col">
                    <span>{trade.sell_date || formatDate(Number(trade.sell_time))}</span>
                    <span className="text-xs text-muted-foreground">
                      {trade.sell_time_display || formatTime(Number(trade.sell_time))}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}
