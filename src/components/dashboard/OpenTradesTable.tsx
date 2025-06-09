// src/components/dashboard/OpenTradesTable.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { InstrumentType } from '@/types'; // Assuming InstrumentType is in your global types

// Re-define OpenTrade interface locally or import if moved to a central types file
// This should match the one in page.tsx
interface OpenTrade {
  contract_id: number;
  instrument: InstrumentType;
  action: 'CALL' | 'PUT';
  stake: number;
  entryPrice: number;
  purchaseTime: number; // Unix epoch (seconds)
  durationSeconds: number;
  loginidUsed: string; // To know if it was demo/real for styling/info potentially
  status: 'open';
  shortcode?: string;
  databaseId?: string;
}

interface OpenTradesTableProps {
  openTrades: OpenTrade[];
}

// Helper to format remaining duration
const formatRemainingDuration = (purchaseTime: number, durationSeconds: number): string => {
  const now = Date.now() / 1000; // Current time in seconds
  const endTime = purchaseTime + durationSeconds;
  const remaining = Math.max(0, Math.floor(endTime - now));

  if (remaining === 0) return "Closing...";

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
};

export function OpenTradesTable({ openTrades }: OpenTradesTableProps) {
  // State to force re-render for countdowns
  const [, setTick] = useState(0);

  useEffect(() => {
    if (openTrades.some(trade => (trade.purchaseTime + trade.durationSeconds) * 1000 > Date.now())) {
      const intervalId = setInterval(() => {
        setTick(prevTick => prevTick + 1);
      }, 1000); // Update every second
      return () => clearInterval(intervalId);
    }
  }, [openTrades]);

  if (!openTrades || openTrades.length === 0) {
    return null; // Don't render anything if no open trades
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Active Deriv Trades</CardTitle>
        <CardDescription>
          Trades currently open on the Deriv platform. Outcomes will be updated automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract ID</TableHead>
              <TableHead>Instrument</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Stake ($)</TableHead>
              <TableHead>Entry Price</TableHead>
              <TableHead>Purchase Time</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Account</TableHead>
              {/* <TableHead>Shortcode</TableHead> */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {openTrades.map((trade) => (
              <TableRow key={trade.contract_id}>
                <TableCell className="font-medium">{trade.contract_id}</TableCell>
                <TableCell>{trade.instrument}</TableCell>
                <TableCell>
                  <Badge
                    variant={trade.action === 'CALL' ? 'default' : 'destructive'}
                    className={trade.action === 'CALL' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
                  >
                    {trade.action}
                  </Badge>
                </TableCell>
                <TableCell>{trade.stake.toFixed(2)}</TableCell>
                <TableCell>{trade.entryPrice.toFixed(4)}</TableCell> {/* Adjust decimals as needed */}
                <TableCell>{new Date(trade.purchaseTime * 1000).toLocaleTimeString()}</TableCell>
                <TableCell>{formatRemainingDuration(trade.purchaseTime, trade.durationSeconds)}</TableCell>
                <TableCell>
                  <Badge variant={trade.loginidUsed.startsWith('VRTC') ? 'outline' : 'secondary'}>
                    {trade.loginidUsed.startsWith('VRTC') ? 'Demo' : 'Real'}
                  </Badge>
                </TableCell>
                {/* <TableCell>{trade.shortcode || '-'}</TableCell> */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
