'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { RefreshCw, Database } from "lucide-react";
import { useState, useEffect } from 'react';
import { getInstrumentDecimalPlaces } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TradingInstrument as GlobalTradingInstrument } from '@/types';

// Local type definitions
// type TradingInstrument = string;
type PaperTradingMode = 'paper' | 'live';
type TradeCategory = 'forexCrypto' | 'volatility' | 'mt5';
type TradeRecordStatus = 'won' | 'lost_duration' | 'lost_stoploss' | 'closed_manual' | 'cancelled' | 'open';

interface TradeRecord {
  id: string;
  timestamp: number;
  instrument: GlobalTradingInstrument;
  action: 'CALL' | 'PUT' | 'BUY' | 'SELL';
  duration?: string;
  stake: number;
  entryPrice: number;
  exitPrice?: number | null;
  pnl: number | null;
  status: TradeRecordStatus;
  accountType: PaperTradingMode;
  tradeCategory: TradeCategory;
  reasoning?: string;
}

export default function TradeHistoryPage() {
  const { userInfo } = useAuth();
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [apiError, setApiError] = useState<string | null>(null);

  const refreshHistory = async () => {
    setIsLoading(true);
    setApiError(null);
    
    if (!userInfo?.id) {
      setIsLoading(false);
      setApiError("User not authenticated. Cannot fetch trade history.");
      setTradeHistory([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/trades/history?userId=${userInfo.id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `API error: ${response.status} ${response.statusText}` }));
        throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
      }
      
      const apiTrades = await response.json();
      
      // Convert API trades to match our TradeRecord format
      const dbTrades = apiTrades.map((trade: any) => ({
        id: trade.id,
        timestamp: new Date(trade.openTime).getTime(),
        instrument: trade.symbol,
        // Assuming binary option style trades for now for CALL/PUT
        action: trade.type.toUpperCase() === 'BUY' ? 'CALL' : (trade.type.toUpperCase() === 'SELL' ? 'PUT' : trade.type.toUpperCase()), 
        duration: trade.metadata?.duration || '-',
        stake: trade.amount,
        entryPrice: trade.price,
        exitPrice: trade.closeTime ? trade.metadata?.exitPrice || trade.price : null, // Use trade.price if exitPrice not available but closed
        pnl: trade.profit,
        status: trade.status === 'closed' 
          ? (trade.profit > 0 ? 'won' : (trade.metadata?.outcome === 'closed_manual' ? 'closed_manual' : 'lost_duration')) 
          : trade.status, // open, cancelled etc.
        accountType: trade.metadata?.accountType || 'paper',
        tradeCategory: trade.metadata?.tradeCategory || 'forexCrypto', // Default or extract from metadata
        reasoning: trade.metadata?.reasoning || ''
      }));
      
      console.log("Fetched trades from database:", dbTrades.length);
      setTradeHistory(dbTrades.sort((a: TradeRecord, b: TradeRecord) => b.timestamp - a.timestamp));

    } catch (error) {
      console.error("Error fetching trades from API:", error);
      setApiError(error instanceof Error ? error.message : "Unknown API error");
      setTradeHistory([]); // Clear history on error
    } finally {
      setLastRefresh(new Date());
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshHistory();
  }, [userInfo]);

  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (amount === null || amount === undefined) return '-';
    return amount.toLocaleString(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatPrice = (price: number | null | undefined, instrument: GlobalTradingInstrument) => {
    if (price === null || price === undefined) return '-';
    return price.toFixed(getInstrumentDecimalPlaces(instrument));
  };

  const getStatusBadgeVariant = (status: TradeRecordStatus) => {
    switch (status) {
      case 'won':
        return 'default'; 
      case 'lost_duration':
      case 'lost_stoploss':
        return 'destructive';
      case 'closed_manual':
      case 'cancelled':
        return 'secondary';
      case 'open':
        return 'outline'; // Example for open trades
      default:
        return 'outline';
    }
  };
  
  const getStatusBadgeColorClass = (status: TradeRecordStatus) => {
    switch (status) {
      case 'won':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'lost_duration':
      case 'lost_stoploss':
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'closed_manual':
      case 'cancelled':
        return 'bg-yellow-500 hover:bg-yellow-600 text-black';
      case 'open':
        return 'bg-blue-500 hover:bg-blue-600 text-white'; // Example for open trades
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
        <div className="container mx-auto py-2">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Trade History</CardTitle>
                    <CardDescription>Retrieving your past trading activity from the database...</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Loading trade history...</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="container mx-auto py-2">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
          <CardTitle>Trade History</CardTitle>
            <CardDescription className="mt-1">
              Review your past trading activity. 
              {userInfo && <span className="ml-1">User ID: {userInfo.id}</span>}
            </CardDescription>
            <div className="text-xs text-muted-foreground mt-1">
              Last refreshed: {lastRefresh.toLocaleString()}
              {apiError && <span className="text-red-500 ml-2">Database Error: {apiError}</span>}
            </div>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="ml-auto" 
            onClick={() => refreshHistory()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {tradeHistory.length === 0 && !apiError ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No trade history available in the database.</p>
              <p className="text-sm text-muted-foreground">
                Execute trades on the dashboard to see them here.
              </p>
            </div>
          ) : apiError && tradeHistory.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-red-500 mb-4">Error loading trade history: {apiError}</p>
              <p className="text-sm text-muted-foreground">
                Please try refreshing or check your connection.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Entry Price</TableHead>
                    <TableHead className="text-right">Exit Price</TableHead>
                    <TableHead className="text-right">Stake</TableHead>
                    <TableHead className="text-right">P/L</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tradeHistory.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell>{new Date(trade.timestamp).toLocaleString()}</TableCell>
                      <TableCell>{trade.instrument}</TableCell>
                      <TableCell>{trade.tradeCategory}</TableCell>
                      <TableCell>
                        <Badge variant={trade.accountType === 'live' ? 'default' : 'secondary'}
                               className={trade.accountType === 'live' ? 'bg-orange-500' : ''}>
                          {trade.accountType.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={trade.action === 'CALL' || trade.action === 'BUY' ? 'default' : 'destructive'}
                          className={trade.action === 'CALL' || trade.action === 'BUY' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
                        >
                          {trade.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{trade.duration}</TableCell>
                      <TableCell className="text-right">{formatPrice(trade.entryPrice, trade.instrument)}</TableCell>
                      <TableCell className="text-right">{trade.exitPrice ? formatPrice(trade.exitPrice, trade.instrument) : '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(trade.stake)}</TableCell>
                      <TableCell className={`text-right ${trade.pnl && trade.pnl > 0 ? 'text-green-500' : trade.pnl && trade.pnl < 0 ? 'text-red-500' : ''}`}>
                        {trade.pnl !== null ? formatCurrency(trade.pnl) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getStatusBadgeVariant(trade.status)} className={getStatusBadgeColorClass(trade.status)}>
                          {trade.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

