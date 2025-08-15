'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DerivTradeRecord } from '@/types';
import {
  getTradeTypeDisplay,
  getInstrumentDisplay,
  getDurationDisplay,
  formatDate,
  formatTime,
  generateLongcode
} from '@/utils/deriv-trade-utils';

interface EnhancedActiveTradesTableProps {
  trades: DerivTradeRecord[];
  accountType: 'demo' | 'real';
  apiToken?: string;
  accountId?: string;
  onTradeComplete?: (sessionSummary: SessionSummary) => void;
  executionMode?: 'AI' | 'Manual';
  showAccountType?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
}

interface SessionSummary {
  totalTrades: number;
  completedTrades: number;
  wonTrades: number;
  lostTrades: number;
  totalProfitLoss: number;
  executionMode: 'AI' | 'Manual';
  accountType: 'demo' | 'real';
}

interface WebSocketTradeUpdate {
  contract_id: number;
  status: 'open' | 'won' | 'lost' | 'sold' | 'cancelled';
  current_spot?: number;
  current_spot_time?: number;
  entry_spot?: number;
  entry_tick?: number;
  exit_spot?: number;
  exit_tick?: number;
  sell_price?: number;
  sell_time?: number;
  profit?: number;
  barrier?: string | number;
  high_barrier?: number;
  low_barrier?: number;
  is_sold?: 0 | 1;
  is_expired?: 0 | 1;
  is_valid_to_sell?: 0 | 1;
  bid_price?: number;
  buy_price?: number;
  payout?: number;
}

export function EnhancedActiveTradesTable({ 
  trades: initialTrades, 
  accountType,
  apiToken,
  accountId,
  onTradeComplete,
  executionMode = 'AI',
  showAccountType = true, 
  maxHeight = "600px",
  emptyMessage = "No active trades"
}: EnhancedActiveTradesTableProps) {
  
  const [trades, setTrades] = useState<DerivTradeRecord[]>(initialTrades);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Map<string, string>>(new Map());
  const sessionStartTimeRef = useRef<number>(Date.now());
  const completedTradesRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  // Update trades when initialTrades changes
  useEffect(() => {
    setTrades(initialTrades);
    // Reset completed trades tracking for new session
    if (initialTrades.length > 0 && completedTradesRef.current.size === 0) {
      sessionStartTimeRef.current = Date.now();
    }
  }, [initialTrades]);

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    if (!apiToken || wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=80447');
    
    ws.onopen = () => {
      console.log('[EnhancedActiveTradesTable] WebSocket connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      
      // Authorize
      ws.send(JSON.stringify({
        authorize: apiToken
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          console.error('[EnhancedActiveTradesTable] WebSocket error:', data.error);
          if (data.error.code === 'AuthorizationRequired') {
            setConnectionStatus('error');
          }
          return;
        }

        // Handle authorization response
        if (data.msg_type === 'authorize' && data.authorize) {
          console.log('[EnhancedActiveTradesTable] Authorized, subscribing to trades');
          // Subscribe to each active trade
          trades.forEach(trade => {
            if (trade.contract_id && !subscriptionsRef.current.has(String(trade.contract_id))) {
              subscribeToContract(String(trade.contract_id));
            }
          });
        }

        // Handle contract updates
        if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract) {
          handleContractUpdate(data.proposal_open_contract);
        }
      } catch (error) {
        console.error('[EnhancedActiveTradesTable] Error processing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[EnhancedActiveTradesTable] WebSocket error:', error);
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      console.log('[EnhancedActiveTradesTable] WebSocket disconnected');
      setIsConnected(false);
      setConnectionStatus('disconnected');
      wsRef.current = null;
      subscriptionsRef.current.clear();
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (apiToken) {
          connectWebSocket();
        }
      }, 3000);
    };

    wsRef.current = ws;
  }, [apiToken, trades]);

  // Subscribe to contract updates
  const subscribeToContract = (contractId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const subscriptionId = `contract_${contractId}_${Date.now()}`;
    
    wsRef.current.send(JSON.stringify({
      proposal_open_contract: 1,
      contract_id: Number(contractId),
      subscribe: 1,
      req_id: subscriptionId
    }));

    subscriptionsRef.current.set(contractId, subscriptionId);
    console.log(`[EnhancedActiveTradesTable] Subscribed to contract ${contractId}`);
  };

  // Handle contract updates from WebSocket
  const handleContractUpdate = (update: WebSocketTradeUpdate) => {
    setTrades(prevTrades => {
      const updatedTrades = prevTrades.map(trade => {
        if (Number(trade.contract_id) === update.contract_id) {
          const isSettled = update.status === 'won' || update.status === 'lost' || update.status === 'sold';
          
          // Track completed trades for session summary
          if (isSettled && !completedTradesRef.current.has(String(trade.contract_id))) {
            completedTradesRef.current.add(String(trade.contract_id));
            checkSessionCompletion(prevTrades, update);
          }

          return {
            ...trade,
            // Update status
            status: update.status,
            
            // Update prices
            current_spot: update.current_spot || trade.current_spot,
            entry_spot: update.entry_spot || trade.entry_spot,
            exit_spot: update.exit_spot || trade.exit_spot,
            sell_price: update.sell_price || trade.sell_price,
            bid_price: update.bid_price || trade.bid_price,
            
            // Update profit/loss
            profit_loss: update.profit !== undefined ? update.profit : 
                        (update.sell_price && trade.buy_price ? 
                         update.sell_price - trade.buy_price : trade.profit_loss),
            
            // Update times
            sell_time: update.sell_time || trade.sell_time,
            current_spot_time: update.current_spot_time || trade.current_spot_time,
            
            // Update barriers
            barrier: update.barrier || trade.barrier,
            high_barrier: update.high_barrier || trade.high_barrier,
            low_barrier: update.low_barrier || trade.low_barrier,
            
            // Update flags
            is_sold: update.is_sold,
            is_expired: update.is_expired,
            is_valid_to_sell: update.is_valid_to_sell
          };
        }
        return trade;
      });

      return updatedTrades;
    });
  };

  // Check if all trades in session are completed
  const checkSessionCompletion = (allTrades: DerivTradeRecord[], latestUpdate: WebSocketTradeUpdate) => {
    const sessionTrades = allTrades.filter(t => 
      Number(t.purchase_time) * 1000 >= sessionStartTimeRef.current
    );
    
    const allCompleted = sessionTrades.every(trade => {
      const status = trade.contract_id === String(latestUpdate.contract_id) ? 
                     latestUpdate.status : trade.status;
      return status === 'won' || status === 'lost' || status === 'sold' || status === 'cancelled';
    });

    if (allCompleted && sessionTrades.length > 0) {
      // Calculate session summary
      const summary: SessionSummary = {
        totalTrades: sessionTrades.length,
        completedTrades: sessionTrades.length,
        wonTrades: 0,
        lostTrades: 0,
        totalProfitLoss: 0,
        executionMode,
        accountType
      };

      sessionTrades.forEach(trade => {
        const profitLoss = trade.contract_id === String(latestUpdate.contract_id) ?
                          (latestUpdate.profit || 0) : (trade.profit_loss || 0);
        
        if (profitLoss > 0) {
          summary.wonTrades++;
        } else if (profitLoss < 0) {
          summary.lostTrades++;
        }
        
        summary.totalProfitLoss += profitLoss;
      });

      // Show toast notification for manual mode
      if (executionMode === 'Manual') {
        const winRate = summary.wonTrades > 0 ? 
          ((summary.wonTrades / summary.totalTrades) * 100).toFixed(1) : '0';
        
        toast({
          title: "Manual Trading Session Complete",
          description: (
            <div className="space-y-1">
              <div>{summary.totalTrades} trades completed</div>
              <div>{summary.wonTrades}W / {summary.lostTrades}L ({winRate}% win rate)</div>
              <div className={`font-bold ${summary.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Total P/L: {summary.totalProfitLoss >= 0 ? '+' : ''}${summary.totalProfitLoss.toFixed(2)}
              </div>
            </div>
          ),
          duration: 8000,
        });
      }

      // Notify parent component
      if (onTradeComplete) {
        onTradeComplete(summary);
      }
    }
  };

  // Connect to WebSocket when component mounts or apiToken changes
  useEffect(() => {
    if (apiToken && trades.length > 0) {
      connectWebSocket();
    }

    return () => {
      // Cleanup WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      subscriptionsRef.current.clear();
    };
  }, [apiToken, connectWebSocket]);

  // Subscribe to new trades as they are added
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      trades.forEach(trade => {
        if (trade.contract_id && !subscriptionsRef.current.has(String(trade.contract_id))) {
          subscribeToContract(String(trade.contract_id));
        }
      });
    }
  }, [trades]);

  const getStatusBadge = (status?: string, profitLoss?: number, sellPrice?: number) => {
    // For active/open trades
    if (status === 'open' || status === 'pending_execution' || !status) {
      return <Badge className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-full">
        <Activity className="w-3 h-3 mr-1 animate-pulse" />
        Open
      </Badge>;
    }
    
    // For completed trades
    if (status === 'won' || (profitLoss && profitLoss > 0)) {
      return <Badge className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full">
        <TrendingUp className="w-3 h-3 mr-1" />
        Won
      </Badge>;
    } else if (status === 'lost' || (profitLoss && profitLoss < 0)) {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full">
        <TrendingDown className="w-3 h-3 mr-1" />
        Lost
      </Badge>;
    } else if (status === 'sold') {
      return <Badge className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full">Sold</Badge>;
    } else if (status === 'cancelled') {
      return <Badge variant="outline" className="px-3 py-1 rounded-full">Cancelled</Badge>;
    }
    
    // Default for zero P/L
    return <Badge variant="outline" className="px-3 py-1 rounded-full">Break Even</Badge>;
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '-';
    const value = Number.isFinite(amount) ? amount : 0;
    return `$${value.toFixed(2)}`;
  };

  const formatProfitLoss = (profitLoss?: number) => {
    if (profitLoss === undefined || profitLoss === null) return <span className="text-gray-500">-</span>;
    
    const formatted = formatCurrency(Math.abs(profitLoss));
    if (profitLoss > 0) {
      return <span className="text-green-600 font-medium">+{formatted}</span>;
    } else if (profitLoss < 0) {
      return <span className="text-red-600 font-medium">-{formatted}</span>;
    } else {
      return <span className="text-gray-500">{formatted}</span>;
    }
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connecting':
        return <Badge variant="outline" className="animate-pulse">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
          Connecting...
        </Badge>;
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
          Live
        </Badge>;
      case 'error':
        return <Badge variant="destructive">Connection Error</Badge>;
      default:
        return <Badge variant="secondary">Offline</Badge>;
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
    <div className="space-y-4">
      {/* Connection Status */}
      {apiToken && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            {executionMode} Mode • {accountType.toUpperCase()} Account
          </div>
          {getConnectionStatusBadge()}
        </div>
      )}

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
                <TableHead className="text-right">Entry Spot</TableHead>
                <TableHead className="text-right">Current/Exit</TableHead>
                <TableHead className="text-right">Buy Price</TableHead>
                <TableHead className="text-right">Sell Price</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                <TableHead className="text-right">Profit/Loss</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Open Time</TableHead>
                <TableHead>Close Time</TableHead>
                <TableHead>App ID</TableHead>
                <TableHead className="max-w-[200px]">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.contract_id} className={trade.status === 'open' ? 'animate-pulse' : ''}>
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

                  {/* Entry Spot */}
                  <TableCell className="text-right font-medium">
                    {trade.entry_spot ? trade.entry_spot.toFixed(2) : '-'}
                  </TableCell>

                  {/* Current/Exit Spot */}
                  <TableCell className="text-right">
                    {trade.exit_spot ? trade.exit_spot.toFixed(2) : 
                     trade.current_spot ? trade.current_spot.toFixed(2) : '-'}
                  </TableCell>

                  {/* Buy Price */}
                  <TableCell className="text-right font-medium">
                    {formatCurrency(trade.buy_price)}
                  </TableCell>

                  {/* Sell Price */}
                  <TableCell className="text-right">
                    {trade.sell_price !== undefined ? formatCurrency(trade.sell_price) : 
                     trade.bid_price !== undefined ? 
                     <span className="text-muted-foreground">{formatCurrency(trade.bid_price)}</span> : 
                     <span className="text-muted-foreground">-</span>}
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
                    {getStatusBadge(trade.status, trade.profit_loss, trade.sell_price)}
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
                    {trade.app_id || '80447'}
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
    </div>
  );
}

// Compact version for embedding in cards
export function CompactEnhancedActiveTradesTable({ 
  trades: initialTrades,
  accountType,
  apiToken,
  accountId,
  onTradeComplete,
  executionMode = 'AI',
  maxHeight = "400px",
  emptyMessage = "No active trades. Start a session to begin."
}: EnhancedActiveTradesTableProps) {
  return (
    <EnhancedActiveTradesTable
      trades={initialTrades}
      accountType={accountType}
      apiToken={apiToken}
      accountId={accountId}
      onTradeComplete={onTradeComplete}
      executionMode={executionMode}
      showAccountType={false}
      maxHeight={maxHeight}
      emptyMessage={emptyMessage}
    />
  );
}
