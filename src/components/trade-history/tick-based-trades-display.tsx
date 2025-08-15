'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  BarChart3,
  Info,
  Target,
  Shield,
  RefreshCw,
  ChartBar,
  Hash,
  Timer
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Comprehensive tick-based contract data interface
interface TickBasedContract {
  // Core identifiers
  account_id?: string;
  contract_id?: number;
  contract_type?: string;
  underlying?: string;
  display_name?: string;
  currency?: string;
  
  // Status fields
  status?: 'open' | 'sold' | 'won' | 'lost' | 'cancelled';
  is_expired?: 0 | 1;
  is_sold?: 0 | 1;
  is_valid_to_sell?: 0 | 1;
  
  // Pricing data
  buy_price?: number;
  bid_price?: number;
  sell_price?: number;
  payout?: number;
  profit?: number;
  profit_percentage?: number;
  
  // Tick-specific fields (Critical for Even/Odd, Over/Under, Rise/Fall)
  entry_tick?: number;
  entry_tick_display_value?: string;
  entry_tick_time?: number;
  entry_spot?: number;
  entry_spot_display_value?: string;
  
  exit_tick?: number;
  exit_tick_display_value?: string;
  exit_tick_time?: number;
  
  current_spot?: number;
  current_spot_display_value?: string;
  current_spot_time?: number;
  
  tick_count?: number;
  tick_passed?: number;
  selected_tick?: number;
  selected_spot?: number;
  
  // Barrier information (for Over/Under)
  barrier?: string | number;
  high_barrier?: string | number;
  low_barrier?: string | number;
  barrier_count?: number;
  
  // Timing data
  date_start?: number;
  date_expiry?: number;
  purchase_time?: number;
  sell_time?: number;
  expiry_time?: number;
  
  // Contract descriptions
  longcode?: string;
  shortcode?: string;
  
  // Tick stream and audit data
  tick_stream?: Array<{
    epoch: number;
    tick: number;
    tick_display_value: string;
  }>;
  
  audit_details?: {
    all_ticks?: Array<{
      epoch: number;
      tick: number;
      tick_display_value: string;
      flag?: string | null;
      name?: string | null;
    }>;
    contract_start?: Array<any>;
    contract_end?: Array<any>;
  };
  
  // Validation
  validation_error?: string;
  validation_error_code?: string;
}

interface TickBasedTradesDisplayProps {
  apiToken?: string;
  accountId?: string;
  accountType: 'demo' | 'real';
  executionMode?: 'AI' | 'Manual';
  onSessionComplete?: (summary: any) => void;
  filterTradeTypes?: string[]; // Filter for specific trade types
}

// Helper function to determine if a trade is tick-based
const isTickBasedTrade = (contractType?: string): boolean => {
  if (!contractType) return false;
  const tickTypes = ['DIGITEVEN', 'DIGITODD', 'DIGITOVER', 'DIGITUNDER', 'CALL', 'PUT', 'CALLE', 'PUTE'];
  return tickTypes.includes(contractType.toUpperCase());
};

// Helper function to get last digit from tick value
const getLastDigit = (value?: number | string): string => {
  if (value === undefined || value === null) return '-';
  const strValue = value.toString();
  const parts = strValue.split('.');
  if (parts.length > 1 && parts[1].length > 0) {
    return parts[1][parts[1].length - 1];
  }
  return strValue[strValue.length - 1];
};

// Helper function to check if digit prediction is correct for Even/Odd
const checkEvenOddResult = (contractType: string, lastDigit: string): boolean | null => {
  if (lastDigit === '-') return null;
  const digit = parseInt(lastDigit);
  if (contractType === 'DIGITEVEN') {
    return digit % 2 === 0;
  } else if (contractType === 'DIGITODD') {
    return digit % 2 !== 0;
  }
  return null;
};

// Helper function to check if digit prediction is correct for Over/Under
const checkOverUnderResult = (contractType: string, lastDigit: string, barrier?: string | number): boolean | null => {
  if (lastDigit === '-' || barrier === undefined) return null;
  const digit = parseInt(lastDigit);
  const barrierValue = typeof barrier === 'string' ? parseInt(barrier) : barrier;
  
  if (contractType === 'DIGITOVER') {
    return digit > barrierValue;
  } else if (contractType === 'DIGITUNDER') {
    return digit < barrierValue;
  }
  return null;
};

export function TickBasedTradesDisplay({
  apiToken,
  accountId,
  accountType,
  executionMode = 'AI',
  onSessionComplete,
  filterTradeTypes = ['DIGITEVEN', 'DIGITODD', 'DIGITOVER', 'DIGITUNDER', 'CALL', 'PUT']
}: TickBasedTradesDisplayProps) {
  const [contracts, setContracts] = useState<Map<number, TickBasedContract>>(new Map());
  const [selectedTab, setSelectedTab] = useState<'active' | 'completed' | 'analysis'>('active');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [expandedContracts, setExpandedContracts] = useState<Set<number>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const sessionStatsRef = useRef({ total: 0, won: 0, lost: 0, profit: 0 });

  // Format currency with proper symbol and decimals
  const formatCurrency = (amount?: number, currency?: string) => {
    if (amount === undefined || amount === null) return '-';
    const symbol = currency === 'USD' ? '$' : currency || '$';
    return `${symbol}${amount.toFixed(2)}`;
  };

  // Format percentage
  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return '-';
    const color = value >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={color}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>;
  };

  // Format timestamp to readable date/time
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  // Format short time for ticks
  const formatTickTime = (timestamp?: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  // Get contract type display name
  const getContractTypeDisplay = (type?: string) => {
    if (!type) return '-';
    const typeMap: Record<string, string> = {
      'DIGITEVEN': 'Even',
      'DIGITODD': 'Odd',
      'DIGITOVER': 'Over',
      'DIGITUNDER': 'Under',
      'CALL': 'Rise',
      'PUT': 'Fall',
      'CALLE': 'Rise (Equal)',
      'PUTE': 'Fall (Equal)'
    };
    return typeMap[type] || type;
  };

  // Get status badge with tick-specific information
  const getStatusBadge = (contract: TickBasedContract) => {
    const status = contract.status;
    const profit = contract.profit || 0;
    
    if (status === 'open') {
      const progress = contract.tick_passed && contract.tick_count 
        ? (contract.tick_passed / contract.tick_count) * 100 
        : 0;
      
      return (
        <div className="flex items-center space-x-2">
          <Badge className="bg-blue-500 text-white">
            <Activity className="w-3 h-3 mr-1 animate-pulse" />
            Open
          </Badge>
          {contract.tick_count && (
            <div className="flex items-center space-x-1">
              <Progress value={progress} className="w-16 h-2" />
              <span className="text-xs text-muted-foreground">
                {contract.tick_passed}/{contract.tick_count}
              </span>
            </div>
          )}
        </div>
      );
    } else if (status === 'won' || profit > 0) {
      return (
        <Badge className="bg-green-500 text-white">
          <TrendingUp className="w-3 h-3 mr-1" />
          Won
        </Badge>
      );
    } else if (status === 'lost' || profit < 0) {
      return (
        <Badge className="bg-red-500 text-white">
          <TrendingDown className="w-3 h-3 mr-1" />
          Lost
        </Badge>
      );
    } else if (status === 'sold') {
      return (
        <Badge className="bg-yellow-500 text-white">
          <DollarSign className="w-3 h-3 mr-1" />
          Sold
        </Badge>
      );
    }
    
    return <Badge variant="outline">Unknown</Badge>;
  };

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    if (!apiToken || wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=80447');
    
    ws.onopen = () => {
      console.log('[TickBasedDisplay] WebSocket connected');
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
          console.error('[TickBasedDisplay] WebSocket error:', data.error);
          if (data.error.code === 'AuthorizationRequired') {
            setConnectionStatus('error');
          }
          return;
        }

        // Handle authorization response
        if (data.msg_type === 'authorize' && data.authorize) {
          console.log('[TickBasedDisplay] Authorized, subscribing to contracts');
          // Subscribe to open contracts
          ws.send(JSON.stringify({
            proposal_open_contract: 1,
            subscribe: 1
          }));
        }

        // Handle contract updates
        if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract) {
          const contract = data.proposal_open_contract as TickBasedContract;
          
          // Only process tick-based contracts
          if (contract.contract_id && isTickBasedTrade(contract.contract_type)) {
            // Check if contract type is in filter
            if (filterTradeTypes.length === 0 || 
                (contract.contract_type && filterTradeTypes.includes(contract.contract_type))) {
              
              setContracts(prev => {
                const updated = new Map(prev);
                const previousContract = prev.get(contract.contract_id!);
                
                // Check if contract just completed
                if (previousContract?.status === 'open' && 
                    (contract.status === 'won' || contract.status === 'lost')) {
                  // Update session stats
                  sessionStatsRef.current.total++;
                  if (contract.status === 'won') {
                    sessionStatsRef.current.won++;
                  } else {
                    sessionStatsRef.current.lost++;
                  }
                  sessionStatsRef.current.profit += contract.profit || 0;
                  
                  // Show toast notification
                  toast({
                    title: `Trade ${contract.status === 'won' ? 'Won' : 'Lost'}`,
                    description: `Contract #${contract.contract_id} - ${getContractTypeDisplay(contract.contract_type)} - P/L: ${formatCurrency(contract.profit, contract.currency)}`,
                    variant: contract.status === 'won' ? 'default' : 'destructive',
                  });
                }
                
                updated.set(contract.contract_id!, contract);
                return updated;
              });
            }
          }
        }
      } catch (error) {
        console.error('[TickBasedDisplay] Error processing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[TickBasedDisplay] WebSocket error:', error);
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      console.log('[TickBasedDisplay] WebSocket disconnected');
      setConnectionStatus('disconnected');
      wsRef.current = null;
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (apiToken) {
          connectWebSocket();
        }
      }, 3000);
    };

    wsRef.current = ws;
  }, [apiToken, filterTradeTypes, toast]);

  // Connect WebSocket on mount
  useEffect(() => {
    if (apiToken) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [apiToken, connectWebSocket]);

  // Toggle contract expansion
  const toggleContractExpansion = (contractId: number) => {
    setExpandedContracts(prev => {
      const updated = new Set(prev);
      if (updated.has(contractId)) {
        updated.delete(contractId);
      } else {
        updated.add(contractId);
      }
      return updated;
    });
  };

  // Filter contracts by status
  const activeContracts = Array.from(contracts.values()).filter(c => c.status === 'open');
  const completedContracts = Array.from(contracts.values()).filter(c => c.status !== 'open');

  // Render tick details for a contract
  const renderTickDetails = (contract: TickBasedContract) => {
    const isExpanded = contract.contract_id ? expandedContracts.has(contract.contract_id) : false;
    
    return (
      <div className="space-y-3">
        {/* Entry and Exit Ticks */}
        <div className="grid grid-cols-2 gap-4">
          {/* Entry Tick */}
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-800 dark:text-green-300">Entry Tick</span>
              <Badge variant="outline" className="text-xs">
                {formatTickTime(contract.entry_tick_time)}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {contract.entry_tick_display_value || contract.entry_tick || '-'}
              </div>
              {(contract.contract_type?.startsWith('DIGIT')) && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Last Digit:</span>
                  <Badge className="text-lg font-mono">
                    {getLastDigit(contract.entry_tick_display_value || contract.entry_tick)}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Exit Tick */}
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-800 dark:text-red-300">Exit Tick</span>
              <Badge variant="outline" className="text-xs">
                {formatTickTime(contract.exit_tick_time)}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {contract.exit_tick_display_value || contract.exit_tick || '-'}
              </div>
              {(contract.contract_type?.startsWith('DIGIT')) && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Last Digit:</span>
                  <Badge className="text-lg font-mono">
                    {getLastDigit(contract.exit_tick_display_value || contract.exit_tick)}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Barrier Information (for Over/Under) */}
        {(contract.contract_type === 'DIGITOVER' || contract.contract_type === 'DIGITUNDER') && contract.barrier && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Barrier</span>
              <Badge className="text-lg font-mono">{contract.barrier}</Badge>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Prediction: Last digit {contract.contract_type === 'DIGITOVER' ? 'over' : 'under'} {contract.barrier}
            </div>
          </div>
        )}

        {/* Result Analysis */}
        {contract.status !== 'open' && contract.contract_type && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-2">Result Analysis</div>
            <div className="space-y-2 text-sm">
              {contract.contract_type === 'DIGITEVEN' || contract.contract_type === 'DIGITODD' ? (
                <div>
                  <span className="text-muted-foreground">Exit Digit: </span>
                  <span className="font-mono font-medium">
                    {getLastDigit(contract.exit_tick_display_value || contract.exit_tick)}
                  </span>
                  {' '}
                  <Badge variant={
                    checkEvenOddResult(contract.contract_type, getLastDigit(contract.exit_tick_display_value || contract.exit_tick)) 
                      ? 'default' : 'destructive'
                  }>
                    {checkEvenOddResult(contract.contract_type, getLastDigit(contract.exit_tick_display_value || contract.exit_tick))
                      ? 'Correct' : 'Incorrect'}
                  </Badge>
                </div>
              ) : contract.contract_type === 'DIGITOVER' || contract.contract_type === 'DIGITUNDER' ? (
                <div>
                  <span className="text-muted-foreground">Exit Digit: </span>
                  <span className="font-mono font-medium">
                    {getLastDigit(contract.exit_tick_display_value || contract.exit_tick)}
                  </span>
                  {' '}
                  <Badge variant={
                    checkOverUnderResult(contract.contract_type, getLastDigit(contract.exit_tick_display_value || contract.exit_tick), contract.barrier) 
                      ? 'default' : 'destructive'
                  }>
                    {checkOverUnderResult(contract.contract_type, getLastDigit(contract.exit_tick_display_value || contract.exit_tick), contract.barrier)
                      ? 'Correct' : 'Incorrect'}
                  </Badge>
                </div>
              ) : (
                <div>
                  <span className="text-muted-foreground">Movement: </span>
                  <span className="font-medium">
                    {(contract.exit_tick || 0) > (contract.entry_tick || 0) ? 'Rise' : 'Fall'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tick Stream (Expandable) */}
        {contract.tick_stream && contract.tick_stream.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => contract.contract_id && toggleContractExpansion(contract.contract_id)}
              className="w-full justify-between"
            >
              <span className="text-sm font-medium">Tick History ({contract.tick_stream.length} ticks)</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {isExpanded && (
              <ScrollArea className="h-[200px] w-full border rounded-lg p-2">
                <div className="space-y-1">
                  {contract.tick_stream.map((tick, index) => (
                    <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                        <div>
                          <div className="font-mono font-medium">{tick.tick_display_value}</div>
                          <div className="text-xs text-muted-foreground">{formatTickTime(tick.epoch)}</div>
                        </div>
                      </div>
                      {contract.contract_type?.startsWith('DIGIT') && (
                        <Badge className="font-mono">
                          {getLastDigit(tick.tick_display_value)}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render contract card
  const renderContractCard = (contract: TickBasedContract) => {
    return (
      <Card key={contract.contract_id} className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {contract.display_name || contract.underlying || 'Unknown Asset'}
              </CardTitle>
              <CardDescription>
                Contract #{contract.contract_id} • {getContractTypeDisplay(contract.contract_type)}
                {contract.tick_count && ` • ${contract.tick_count} ticks`}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-4">
              {getStatusBadge(contract)}
              <div className="text-right">
                <div className="text-sm text-muted-foreground">P/L</div>
                <div className={cn(
                  "text-lg font-bold",
                  (contract.profit || 0) >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(contract.profit, contract.currency)}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Basic Info */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Buy Price</div>
              <div className="font-medium">{formatCurrency(contract.buy_price, contract.currency)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Payout</div>
              <div className="font-medium">{formatCurrency(contract.payout, contract.currency)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Current Bid</div>
              <div className="font-medium">{formatCurrency(contract.bid_price, contract.currency)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Sell Price</div>
              <div className="font-medium">{formatCurrency(contract.sell_price, contract.currency)}</div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Tick Details */}
          {renderTickDetails(contract)}
        </CardContent>
      </Card>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tick-Based Active Trades ({accountType})</CardTitle>
            <CardDescription>
              Real-time monitoring of Even/Odd, Over/Under, and Rise/Fall trades
            </CardDescription>
          </div>
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                connectionStatus === 'connected' ? "bg-green-500 animate-pulse" :
                connectionStatus === 'connecting' ? "bg-yellow-500 animate-pulse" :
                connectionStatus === 'error' ? "bg-red-500" :
                "bg-gray-500"
              )} />
              <span className="text-sm text-muted-foreground">
                {connectionStatus === 'connected' ? 'Connected' :
                 connectionStatus === 'connecting' ? 'Connecting...' :
                 connectionStatus === 'error' ? 'Error' :
                 'Disconnected'}
              </span>
            </div>
            
            {/* Session Stats */}
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>{sessionStatsRef.current.won}</span>
              </div>
              <div className="flex items-center space-x-1">
                <XCircle className="w-4 h-4 text-red-500" />
                <span>{sessionStatsRef.current.lost}</span>
              </div>
              <div className={cn(
                "font-medium",
                sessionStatsRef.current.profit >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(sessionStatsRef.current.profit, 'USD')}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">
              Active ({activeContracts.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedContracts.length})
            </TabsTrigger>
            <TabsTrigger value="analysis">
              Analysis
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            <ScrollArea className="h-[600px] w-full pr-4">
              {activeContracts.length > 0 ? (
                activeContracts.map(contract => renderContractCard(contract))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No active tick-based trades
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="completed" className="space-y-4">
            <ScrollArea className="h-[600px] w-full pr-4">
              {completedContracts.length > 0 ? (
                completedContracts.map(contract => renderContractCard(contract))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No completed tick-based trades
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="analysis" className="space-y-4">
            <div className="space-y-4">
              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Win Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {sessionStatsRef.current.total > 0 
                        ? ((sessionStatsRef.current.won / sessionStatsRef.current.total) * 100).toFixed(1)
                        : '0'}%
                    </div>
                    <Progress 
                      value={sessionStatsRef.current.total > 0 
                        ? (sessionStatsRef.current.won / sessionStatsRef.current.total) * 100
                        : 0} 
                      className="mt-2"
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Trades</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{sessionStatsRef.current.total}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {sessionStatsRef.current.won} won, {sessionStatsRef.current.lost} lost
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Net Profit/Loss</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={cn(
                      "text-2xl font-bold",
                      sessionStatsRef.current.profit >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(sessionStatsRef.current.profit, 'USD')}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {executionMode} mode
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Trade Type Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Trade Type Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {['DIGITEVEN', 'DIGITODD', 'DIGITOVER', 'DIGITUNDER', 'CALL', 'PUT'].map(type => {
                      const count = Array.from(contracts.values()).filter(c => c.contract_type === type).length;
                      const percentage = contracts.size > 0 ? (count / contracts.size) * 100 : 0;
                      
                      return (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{getContractTypeDisplay(type)}</Badge>
                            <span className="text-sm text-muted-foreground">{count} trades</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Progress value={percentage} className="w-24" />
                            <span className="text-sm font-medium w-12 text-right">
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
