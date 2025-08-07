'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { RefreshCw, Download, Database } from "lucide-react";
import { useState, useEffect } from 'react';
import { getInstrumentDecimalPlaces } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InstrumentType as GlobalTradingInstrument } from '@/types';

// Local type definitions
// type TradingInstrument = string;
type PaperTradingMode = 'paper' | 'live';
type TradeCategory = 'forexCrypto' | 'volatility' | 'mt5';
type TradeRecordStatus = 'won' | 'lost_duration' | 'lost_stoploss' | 'closed_manual' | 'cancelled' | 'open';

interface TradeRecord {
  id: string;
  timestamp: number;
  instrument: GlobalTradingInstrument;

  // New Deriv-style fields
  tradeType?: string; // e.g., "Higher/Lower", "Even/Odd", "Over/Under"
  entryPrice: number; // Price when trade began
  exitPrice?: number | null; // Price when trade concluded
  buyPrice?: number; // Price of the contract
  profitLoss?: number | null; // Profit/Loss after trade completion
  date?: string; // Date when trade was executed (YYYY-MM-DD)
  time?: string; // Time when trade was completed (HH:MM:SS)

  // Legacy fields for backward compatibility
  action: 'CALL' | 'PUT' | 'BUY' | 'SELL';
  duration?: string;
  stake: number;
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
  // New state variables for filtering
  const [filterInstrument, setFilterInstrument] = useState<GlobalTradingInstrument | 'all'>('all');
  const [filterAction, setFilterAction] = useState<'all' | 'CALL' | 'PUT' | 'BUY' | 'SELL'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | TradeRecordStatus>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>(''); // YYYY-MM-DD
  const [filterEndDate, setFilterEndDate] = useState<string>(''); // YYYY-MM-DD

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
      
      // Convert API trades to match our TradeRecord format with enhanced Deriv-style fields
      const dbTrades = apiTrades.map((trade: any) => {
        // Extract metadata for better field mapping
        const metadata = trade.metadata || {};

        // Determine trade type from multiple sources
        let tradeType = 'Unknown';
        if (metadata.tradeType) {
          tradeType = metadata.tradeType;
        } else if (metadata.contractType) {
          // Map contract types to display names
          switch (metadata.contractType) {
            case 'DIGITEVEN': tradeType = 'Even/Odd (Even)'; break;
            case 'DIGITODD': tradeType = 'Even/Odd (Odd)'; break;
            case 'DIGITOVER': tradeType = 'Over/Under (Over)'; break;
            case 'DIGITUNDER': tradeType = 'Over/Under (Under)'; break;
            case 'CALL': tradeType = 'Rise/Fall (Rise)'; break;
            case 'PUT': tradeType = 'Rise/Fall (Fall)'; break;
            default: tradeType = metadata.contractType;
          }
        } else if (trade.type) {
          tradeType = trade.type;
        }

        // Determine account type
        const accountType = metadata.isPaperTrade ? 'demo' :
                           metadata.accountType ||
                           (trade.accountType === 'demo' ? 'demo' : 'real');

        // Calculate profit/loss with fallback logic
        const profitLoss = trade.profitLoss || trade.profit || 0;

        // Determine status with enhanced logic
        let status = trade.status?.toLowerCase() || 'unknown';
        if (status === 'open') {
          status = 'open';
        } else if (status === 'closed') {
          if (profitLoss > 0) status = 'won';
          else if (profitLoss < 0) status = 'lost';
          else status = 'closed';
        }

        return {
          id: trade.id,
          timestamp: new Date(trade.openTime).getTime(),
          instrument: metadata.instrument || trade.symbol,
          tradeType: tradeType,
          entryPrice: metadata.entryPrice || trade.entryPrice || trade.price,
          exitPrice: metadata.exitPrice || trade.exitPrice || (trade.closeTime ? trade.price : null),
          buyPrice: metadata.buyPrice || trade.buyPrice || trade.amount,
          profitLoss: profitLoss,
          status: status,
          date: new Date(trade.openTime).toISOString().split('T')[0], // YYYY-MM-DD format
          time: trade.closeTime ? new Date(trade.closeTime).toTimeString().split(' ')[0] : '-', // HH:MM:SS format
          accountType: accountType,
          tradeCategory: metadata.tradeCategory || 'volatility',
          reasoning: metadata.reasoning || '',

          // Legacy fields for backward compatibility
          action: metadata.contractType || trade.type?.toUpperCase() || 'UNKNOWN',
          duration: metadata.executionMode || metadata.duration || '-',
          stake: trade.amount,
          pnl: profitLoss,

          // Additional fields for enhanced display
          contractType: metadata.contractType,
          derivContractId: metadata.derivContractId || trade.derivContractId,
          executionMode: metadata.executionMode,
          patternAnalysis: metadata.patternAnalysis
        };
      });
      
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

  // Function to filter trades based on selected criteria
  const filteredTrades = tradeHistory.filter(trade => {
    const tradeDate = new Date(trade.timestamp);
    const startDate = filterStartDate ? new Date(filterStartDate) : null;
    const endDate = filterEndDate ? new Date(filterEndDate) : null;

    // Filter by date range
    if (startDate && tradeDate < startDate) return false;
    if (endDate && tradeDate > endDate) return false;

    // Filter by instrument
    if (filterInstrument !== 'all' && trade.instrument !== filterInstrument) return false;

    // Filter by action
    if (filterAction !== 'all' && trade.action !== filterAction) return false;

    // Filter by status
    if (filterStatus !== 'all' && trade.status !== filterStatus) return false;

    return true;
  });

  // Function to export filtered trades to CSV
  const exportToCsv = () => {
    if (filteredTrades.length === 0) return;

    const headers = ["Timestamp", "Instrument", "Category", "Account", "Action", "Duration", "Stake", "Entry Price", "Exit Price", "P/L", "Status", "Reasoning"];
    const rows = filteredTrades.map(trade => [
      new Date(trade.timestamp).toLocaleString(),
      trade.instrument,
      trade.tradeCategory,
      trade.accountType.toUpperCase(),
      trade.action,
      trade.duration || '-',
      trade.stake,
      trade.entryPrice,
      trade.exitPrice !== null ? trade.exitPrice : '',
      trade.pnl !== null ? trade.pnl : '',
      trade.status.replace('_', ' ').toUpperCase(),
      trade.reasoning || '',
    ].map(item => `"${String(item).replace(/"/g, '""')}"`)); // Basic CSV escaping

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'trade_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2">
          <div className="flex flex-col mb-4 sm:mb-0">
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

          <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-0">
            {/* Instrument Filter */}
            <Select onValueChange={(value: GlobalTradingInstrument | 'all') => setFilterInstrument(value)} value={filterInstrument}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Instrument" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Instruments</SelectItem>
                <SelectItem value="Volatility 10 Index">Volatility 10 Index</SelectItem>
                <SelectItem value="Volatility 25 Index">Volatility 25 Index</SelectItem>
                <SelectItem value="Volatility 50 Index">Volatility 50 Index</SelectItem>
                <SelectItem value="Volatility 75 Index">Volatility 75 Index</SelectItem>
                <SelectItem value="Volatility 100 Index">Volatility 100 Index</SelectItem>
                <SelectItem value="Boom 500 Index">Boom 500 Index</SelectItem>
                <SelectItem value="Boom 600 Index">Boom 600 Index</SelectItem>
                <SelectItem value="Boom 900 Index">Boom 900 Index</SelectItem>
                <SelectItem value="Boom 1000 Index">Boom 1000 Index</SelectItem>
                <SelectItem value="Crash 500 Index">Crash 500 Index</SelectItem>
                <SelectItem value="Crash 600 Index">Crash 600 Index</SelectItem>
                <SelectItem value="Crash 900 Index">Crash 900 Index</SelectItem>
                <SelectItem value="Crash 1000 Index">Crash 1000 Index</SelectItem>
                <SelectItem value="Jump 10 Index">Jump 10 Index</SelectItem>
                <SelectItem value="Jump 25 Index">Jump 25 Index</SelectItem>
                <SelectItem value="Jump 50 Index">Jump 50 Index</SelectItem>
                <SelectItem value="Jump 75 Index">Jump 75 Index</SelectItem>
                <SelectItem value="Jump 100 Index">Jump 100 Index</SelectItem>
                <SelectItem value="EUR/USD">EUR/USD</SelectItem>
                <SelectItem value="GBP/USD">GBP/USD</SelectItem>
                <SelectItem value="BTC/USD">BTC/USD</SelectItem>
                <SelectItem value="XAU/USD">XAU/USD</SelectItem>
                <SelectItem value="ETH/USD">ETH/USD</SelectItem>
                <SelectItem value="Palladium/USD">Palladium/USD</SelectItem>
                <SelectItem value="Platinum/USD">Platinum/USD</SelectItem>
                <SelectItem value="Silver/USD">Silver/USD</SelectItem>
              </SelectContent>
            </Select>

            {/* Action Filter */}
            <Select onValueChange={(value: 'all' | 'CALL' | 'PUT' | 'BUY' | 'SELL') => setFilterAction(value)} value={filterAction}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CALL">CALL</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="BUY">BUY</SelectItem>
                <SelectItem value="SELL">SELL</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select onValueChange={(value: 'all' | TradeRecordStatus) => setFilterStatus(value)} value={filterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="won">WON</SelectItem>
                <SelectItem value="lost_duration">LOST (Duration)</SelectItem>
                <SelectItem value="lost_stoploss">LOST (Stop Loss)</SelectItem>
                <SelectItem value="closed_manual">CLOSED (Manual)</SelectItem>
                <SelectItem value="cancelled">CANCELLED</SelectItem>
                <SelectItem value="open">OPEN</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Filters */}
            <Input
              type="date"
              placeholder="Start Date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-[160px]"
            />
            <Input
              type="date"
              placeholder="End Date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-[160px]"
            />

            {/* Action Buttons */}
            {/* @ts-ignore */}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => refreshHistory()}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={exportToCsv}
              disabled={filteredTrades.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
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
                    <TableHead>Trade Type</TableHead>
                    <TableHead>Entry Point</TableHead>
                    <TableHead>Exit Point</TableHead>
                    <TableHead className="text-right">Buy Price</TableHead>
                    <TableHead className="text-right">Profit/Loss</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map((trade) => (
                    <TableRow key={trade.id}>
                      {/* Trade Type */}
                      <TableCell>
                        <Badge
                          variant={trade.action === 'CALL' || trade.action === 'BUY' ? 'default' : 'destructive'}
                          className={trade.action === 'CALL' || trade.action === 'BUY' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
                        >
                          {trade.tradeType || trade.action || 'N/A'}
                        </Badge>
                      </TableCell>

                      {/* Entry Point */}
                      <TableCell>{formatPrice(trade.entryPrice, trade.instrument)}</TableCell>

                      {/* Exit Point */}
                      <TableCell>{trade.exitPrice ? formatPrice(trade.exitPrice, trade.instrument) : '-'}</TableCell>

                      {/* Buy Price */}
                      <TableCell className="text-right">{formatCurrency(trade.buyPrice || trade.stake)}</TableCell>

                      {/* Profit/Loss */}
                      <TableCell className={`text-right ${trade.profitLoss && trade.profitLoss > 0 ? 'text-green-500' : trade.profitLoss && trade.profitLoss < 0 ? 'text-red-500' : trade.pnl && trade.pnl > 0 ? 'text-green-500' : trade.pnl && trade.pnl < 0 ? 'text-red-500' : ''}`}>
                        {trade.profitLoss !== null && trade.profitLoss !== undefined ? formatCurrency(trade.profitLoss) : (trade.pnl !== null ? formatCurrency(trade.pnl) : '-')}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        <Badge variant={getStatusBadgeVariant(trade.status)} className={getStatusBadgeColorClass(trade.status)}>
                          {trade.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>

                      {/* Time */}
                      <TableCell>{trade.time || new Date(trade.timestamp).toTimeString().split(' ')[0]}</TableCell>

                      {/* Date */}
                      <TableCell>{trade.date || new Date(trade.timestamp).toISOString().split('T')[0]}</TableCell>

                      {/* Instrument */}
                      <TableCell>{trade.instrument}</TableCell>

                      {/* Account */}
                      <TableCell>
                        <Badge variant={trade.accountType === 'live' ? 'default' : 'secondary'}
                               className={trade.accountType === 'live' ? 'bg-orange-500' : ''}>
                          {trade.accountType.toUpperCase()}
                        </Badge>
                      </TableCell>

                      {/* Category */}
                      <TableCell>{trade.tradeCategory}</TableCell>
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

