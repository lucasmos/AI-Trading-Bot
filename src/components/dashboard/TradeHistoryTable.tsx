// src/components/dashboard/TradeHistoryTable.tsx
'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { InstrumentType } from '@/types'; // Assuming InstrumentType is in your global types

// Define a frontend-compatible Trade type, similar to Prisma's Trade model
// Or import if you have shared types. For now, define essential fields.
export interface HistoricalTrade {
  id: string; // DB ID
  symbol: InstrumentType | string;
  type: string; // 'buy' or 'sell' (or 'CALL'/'PUT' if stored that way)
  amount: number; // Stake
  price: number; // Entry Price
  exitPrice?: number | null;
  pnl?: number | null;
  status: string; // 'won', 'lost', 'sold', 'open', 'cancelled'
  purchaseTime?: Date | string | null; // From Deriv, or openTime
  openTime?: Date | string | null; // General open time
  closeTime?: Date | string | null;
  derivContractId?: number | null;
  metadata?: any; // Could contain accountType: 'paper' | 'live'
  createdAt: Date | string; // For sorting
}

interface TradeHistoryTableProps {
  tradeHistory: HistoricalTrade[];
  title?: string;
  description?: string;
}

const formatDate = (dateInput?: Date | string | null) => {
  if (!dateInput) return '-';
  try {
    return new Date(dateInput).toLocaleString();
  } catch (e) {
    return String(dateInput); // fallback if date is invalid
  }
};

export function TradeHistoryTable({
  tradeHistory,
  title = "Trade History",
  description = "A record of your past trading activity."
}: TradeHistoryTableProps) {
  if (!tradeHistory || tradeHistory.length === 0) {
    return (
      <Card className="shadow-lg mt-6">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">No trade history available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg mt-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption>A list of your recent trades.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Date/Time</TableHead>
              <TableHead>Instrument</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Stake ($)</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Exit</TableHead>
              <TableHead>P/L ($)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deriv ID</TableHead>
              <TableHead>Account</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tradeHistory.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell>{formatDate(trade.purchaseTime || trade.openTime || trade.createdAt)}</TableCell>
                <TableCell>{trade.symbol}</TableCell>
                <TableCell>
                  <Badge
                    variant={trade.type.toUpperCase() === 'CALL' || trade.type.toUpperCase() === 'BUY' ? 'default' : 'destructive'}
                    className={trade.type.toUpperCase() === 'CALL' || trade.type.toUpperCase() === 'BUY' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
                  >
                    {trade.type.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>{trade.amount.toFixed(2)}</TableCell>
                <TableCell>{trade.price.toFixed(4)}</TableCell> {/* Adjust decimals */}
                <TableCell>{trade.exitPrice ? trade.exitPrice.toFixed(4) : '-'}</TableCell> {/* Adjust decimals */}
                <TableCell className={trade.pnl ? (trade.pnl > 0 ? 'text-green-500' : 'text-red-500') : ''}>
                  {trade.pnl !== null && trade.pnl !== undefined ? trade.pnl.toFixed(2) : '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={trade.status === 'won' ? 'default' : (trade.status === 'lost' ? 'destructive' : 'secondary')}>
                    {trade.status}
                  </Badge>
                </TableCell>
                <TableCell>{trade.derivContractId || '-'}</TableCell>
                <TableCell>
                  {trade.metadata?.accountType ? (
                    <Badge variant={trade.metadata.accountType === 'paper' ? 'outline' : 'secondary'}>
                      {trade.metadata.accountType === 'paper' ? 'Demo' : 'Real'}
                    </Badge>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
