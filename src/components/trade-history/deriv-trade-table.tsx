'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DerivTradeRecord } from '@/types';

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
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'won':
        return <Badge variant="default" className="bg-green-500 text-white">Won</Badge>;
      case 'lost':
        return <Badge variant="destructive">Lost</Badge>;
      case 'open':
        return <Badge variant="secondary">Open</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contract ID</TableHead>
            <TableHead>Trade Type</TableHead>
            <TableHead>Instrument</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Buy Price</TableHead>
            <TableHead className="text-right">Payout</TableHead>
            <TableHead className="text-right">Profit/Loss</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>Purchase Time</TableHead>
            <TableHead>Sell Time</TableHead>
            <TableHead className="max-w-[200px]">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.contract_id}>
              {/* Contract ID */}
              <TableCell className="font-mono text-xs">
                {trade.contract_id.slice(-8)}...
              </TableCell>

              {/* Trade Type */}
              <TableCell>
                <Badge variant="outline" className="font-medium">
                  {trade.trade_type_display}
                </Badge>
              </TableCell>

              {/* Instrument */}
              <TableCell className="text-sm">
                {trade.instrument_display}
              </TableCell>

              {/* Duration */}
              <TableCell className="text-sm">
                {trade.duration_display}
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
                {getStatusBadge(trade.status)}
              </TableCell>

              {/* Purchase Time */}
              <TableCell className="text-sm">
                <div className="flex flex-col">
                  <span>{trade.purchase_date}</span>
                  <span className="text-xs text-muted-foreground">
                    {trade.purchase_time_display}
                  </span>
                </div>
              </TableCell>

              {/* Sell Time */}
              <TableCell className="text-sm">
                {trade.sell_date ? (
                  <div className="flex flex-col">
                    <span>{trade.sell_date}</span>
                    <span className="text-xs text-muted-foreground">
                      {trade.sell_time_display}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>

              {/* Description (Longcode) */}
              <TableCell className="max-w-[200px]">
                <div 
                  className="text-xs text-muted-foreground truncate" 
                  title={trade.longcode}
                >
                  {trade.longcode}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

// Compact version for active trades monitoring
export function CompactDerivTradeTable({ 
  trades, 
  maxHeight = "400px",
  emptyMessage = "No active trades"
}: DerivTradeTableProps) {
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'won':
        return <Badge variant="default" className="bg-green-500 text-white text-xs">Won</Badge>;
      case 'lost':
        return <Badge variant="destructive" className="text-xs">Lost</Badge>;
      case 'open':
        return <Badge variant="secondary" className="text-xs">Active</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-xs">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Trade Type</TableHead>
            <TableHead className="text-xs">Instrument</TableHead>
            <TableHead className="text-xs">Duration</TableHead>
            <TableHead className="text-right text-xs">Buy Price</TableHead>
            <TableHead className="text-right text-xs">Payout</TableHead>
            <TableHead className="text-right text-xs">P&L</TableHead>
            <TableHead className="text-center text-xs">Status</TableHead>
            <TableHead className="text-xs">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.contract_id} className="text-sm">
              {/* Trade Type */}
              <TableCell>
                <Badge variant="outline" className="text-xs font-medium">
                  {trade.trade_type_display}
                </Badge>
              </TableCell>

              {/* Instrument */}
              <TableCell className="text-xs">
                {trade.underlying_symbol}
              </TableCell>

              {/* Duration */}
              <TableCell className="text-xs">
                {trade.duration_display}
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
                {getStatusBadge(trade.status)}
              </TableCell>

              {/* Time */}
              <TableCell className="text-xs">
                {trade.purchase_time_display}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
