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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  Zap,
  Target,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Comprehensive contract data interface matching proposal_open_contract schema
interface ProposalOpenContract {
  account_id?: string;
  app_markup_amount?: number;
  audit_details?: {
    all_ticks?: Array<{
      epoch: number;
      tick: number;
      tick_display_value: string;
    }>;
    contract_start?: number;
    contract_end?: number;
  };
  barrier?: string | number;
  barrier_count?: number;
  barrier_spot_distance?: string;
  bid_price?: number;
  buy_price?: number;
  cancellation?: {
    ask_price?: number;
    date_expiry?: number;
  };
  caution_price?: number;
  commision?: number;
  commission?: number;
  contract_id?: number;
  contract_type?: string;
  coupon_collection_epochs?: number[];
  coupon_rate?: number;
  currency?: string;
  current_spot?: number;
  current_spot_display_value?: string;
  current_spot_high_barrier?: string;
  current_spot_low_barrier?: string;
  current_spot_time?: number;
  date_expiry?: number;
  date_settlement?: number;
  date_start?: number;
  display_name?: string;
  display_number_of_contracts?: string;
  display_value?: string;
  entry_spot?: number;
  entry_spot_display_value?: string;
  entry_tick?: number;
  entry_tick_display_value?: string;
  entry_tick_time?: number;
  exit_tick?: number;
  exit_tick_display_value?: string;
  exit_tick_time?: number;
  expiry_time?: number;
  growth_rate?: number;
  high_barrier?: string | number;
  is_expired?: 0 | 1;
  is_forward_starting?: 0 | 1;
  is_intraday?: 0 | 1;
  is_path_dependent?: 0 | 1;
  is_settleable?: 0 | 1;
  is_sold?: 0 | 1;
  is_valid_to_cancel?: 0 | 1;
  is_valid_to_sell?: 0 | 1;
  limit_order?: {
    stop_loss?: {
      display_name?: string;
      display_order_amount?: string;
      order_date?: number;
      value?: number;
    };
    stop_out?: {
      display_name?: string;
      display_order_amount?: string;
      order_date?: number;
      value?: number;
    };
    take_profit?: {
      display_name?: string;
      display_order_amount?: string;
      order_date?: number;
      value?: number;
    };
  };
  longcode?: string;
  low_barrier?: string | number;
  multiplier?: number;
  num_of_coupons?: number;
  payout?: number;
  profit?: number;
  profit_percentage?: number;
  profit_price?: number;
  purchase_time?: number;
  reset_barrier?: string;
  reset_time?: number;
  selected_spot?: number;
  selected_tick?: number;
  sell_price?: number;
  sell_spot?: number;
  sell_spot_display_value?: string;
  sell_spot_time?: number;
  sell_time?: number;
  shortcode?: string;
  status?: 'open' | 'sold' | 'won' | 'lost' | 'cancelled';
  tick_count?: number;
  tick_passed?: number;
  tick_stream?: Array<{
    epoch: number;
    tick: number;
    tick_display_value: string;
  }>;
  trade_risk_profile?: string;
  underlying?: string;
  validation_error?: string;
  validation_error_code?: string;
  validation_params?: {
    max_payout?: { max?: number; min?: number };
    max_ticks?: { max?: number; min?: number };
    stake?: { max?: number; min?: number };
    stop_loss?: { max?: number; min?: number };
    take_profit?: { max?: number; min?: number };
  };
}

interface ComprehensiveActiveTradesDisplayProps {
  apiToken?: string;
  accountId?: string;
  accountType: 'demo' | 'real';
  executionMode?: 'AI' | 'Manual';
  onSessionComplete?: (summary: any) => void;
}

export function ComprehensiveActiveTradesDisplay({
  apiToken,
  accountId,
  accountType,
  executionMode = 'AI',
  onSessionComplete
}: ComprehensiveActiveTradesDisplayProps) {
  const [contracts, setContracts] = useState<Map<number, ProposalOpenContract>>(new Map());
  const [expandedContracts, setExpandedContracts] = useState<Set<number>>(new Set());
  const [selectedTab, setSelectedTab] = useState<'overview' | 'details' | 'ticks'>('overview');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

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

  // Mask account ID for security
  const maskAccountId = (accountId?: string) => {
    if (!accountId) return '-';
    if (accountId.length <= 8) return accountId;
    return `${accountId.slice(0, 3)}...${accountId.slice(-3)}`;
  };

  // Get status badge with appropriate styling
  const getStatusBadge = (contract: ProposalOpenContract) => {
    const status = contract.status;
    const profit = contract.profit || 0;
    
    if (status === 'open') {
      return (
        <Badge className="bg-blue-500 text-white">
          <Activity className="w-3 h-3 mr-1 animate-pulse" />
          Open
        </Badge>
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
    } else if (status === 'cancelled') {
      return (
        <Badge variant="outline">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelled
        </Badge>
      );
    }
    
    return <Badge variant="outline">Unknown</Badge>;
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

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    if (!apiToken || wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=80447');
    
    ws.onopen = () => {
      console.log('[ComprehensiveDisplay] WebSocket connected');
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
          console.error('[ComprehensiveDisplay] WebSocket error:', data.error);
          if (data.error.code === 'AuthorizationRequired') {
            setConnectionStatus('error');
          }
          return;
        }

        // Handle authorization response
        if (data.msg_type === 'authorize' && data.authorize) {
          console.log('[ComprehensiveDisplay] Authorized, ready to subscribe');
          // Subscribe to open contracts
          ws.send(JSON.stringify({
            proposal_open_contract: 1,
            subscribe: 1
          }));
        }

        // Handle contract updates with ALL fields
        if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract) {
          const contract = data.proposal_open_contract as ProposalOpenContract;
          if (contract.contract_id) {
            setContracts(prev => {
              const updated = new Map(prev);
              updated.set(contract.contract_id!, contract);
              return updated;
            });
          }
        }
      } catch (error) {
        console.error('[ComprehensiveDisplay] Error processing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[ComprehensiveDisplay] WebSocket error:', error);
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      console.log('[ComprehensiveDisplay] WebSocket disconnected');
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
  }, [apiToken]);

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

  // Render contract overview card
  const renderContractOverview = (contract: ProposalOpenContract) => {
    const isExpanded = contract.contract_id ? expandedContracts.has(contract.contract_id) : false;
    
    return (
      <Card key={contract.contract_id} className="mb-4">
        <CardHeader 
          className="cursor-pointer"
          onClick={() => contract.contract_id && toggleContractExpansion(contract.contract_id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <CardTitle className="text-lg">
                  {contract.display_name || contract.underlying || 'Unknown Asset'}
                </CardTitle>
                <CardDescription>
                  Contract #{contract.contract_id} • {getContractTypeDisplay(contract.contract_type)}
                </CardDescription>
              </div>
              {getStatusBadge(contract)}
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Current P/L</div>
                <div className={`text-lg font-bold ${(contract.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(contract.profit, contract.currency)}
                </div>
                <div className="text-xs">{formatPercentage(contract.profit_percentage)}</div>
              </div>
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
            </div>
          </div>
        </CardHeader>
        
        <Collapsible open={isExpanded}>
          <CollapsibleContent>
            <CardContent>
              <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="details">Full Details</TabsTrigger>
                  <TabsTrigger value="ticks">Tick Data</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  {/* Essential Information Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Account ID</div>
                      <div className="font-medium">{maskAccountId(contract.account_id)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Currency</div>
                      <div className="font-medium">{contract.currency || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Buy Price</div>
                      <div className="font-medium">{formatCurrency(contract.buy_price, contract.currency)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Payout</div>
                      <div className="font-medium">{formatCurrency(contract.payout, contract.currency)}</div>
                    </div>
                  </div>

                  <Separator />

                  {/* Spot Prices Grid */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Spot Prices</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Current Spot</div>
                        <div className="font-medium">
                          {contract.current_spot_display_value || contract.current_spot?.toFixed(2) || '-'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(contract.current_spot_time)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Entry Spot</div>
                        <div className="font-medium">
                          {contract.entry_spot_display_value || contract.entry_spot?.toFixed(2) || '-'}
                        </div>
                      </div>
                      {contract.sell_spot && (
                        <div>
                          <div className="text-sm text-muted-foreground">Exit/Sell Spot</div>
                          <div className="font-medium">
                            {contract.sell_spot_display_value || contract.sell_spot?.toFixed(2) || '-'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Barriers (if applicable) */}
                  {(contract.barrier || contract.high_barrier || contract.low_barrier) && (
                    <>
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Barriers</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {contract.barrier && (
                            <div>
                              <div className="text-sm text-muted-foreground">Barrier</div>
                              <div className="font-medium">{contract.barrier}</div>
                            </div>
                          )}
                          {contract.high_barrier && (
                            <div>
                              <div className="text-sm text-muted-foreground">High Barrier</div>
                              <div className="font-medium">{contract.high_barrier}</div>
                            </div>
                          )}
                          {contract.low_barrier && (
                            <div>
                              <div className="text-sm text-muted-foreground">Low Barrier</div>
                              <div className="font-medium">{contract.low_barrier}</div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Times */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Timeline</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Purchase Time</div>
                        <div className="text-xs">{formatTimestamp(contract.purchase_time)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Expiry Time</div>
                        <div className="text-xs">{formatTimestamp(contract.expiry_time)}</div>
                      </div>
                      {contract.sell_time && (
                        <div>
                          <div className="text-sm text-muted-foreground">Sell Time</div>
                          <div className="text-xs">{formatTimestamp(contract.sell_time)}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="flex flex-wrap gap-2">
                    {contract.is_expired === 1 && (
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        Expired
                      </Badge>
                    )}
                    {contract.is_sold === 1 && (
                      <Badge variant="outline">
                        <DollarSign className="w-3 h-3 mr-1" />
                        Sold
                      </Badge>
                    )}
                    {contract.is_valid_to_sell === 1 && (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Can Sell
                      </Badge>
                    )}
                    {contract.is_valid_to_cancel === 1 && (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Can Cancel
                      </Badge>
                    )}
                    {contract.is_forward_starting === 1 && (
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        Forward Starting
                      </Badge>
                    )}
                    {contract.is_path_dependent === 1 && (
                      <Badge variant="outline">
                        <BarChart3 className="w-3 h-3 mr-1" />
                        Path Dependent
                      </Badge>
                    )}
                  </div>

                  {/* Longcode */}
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Contract Description</div>
                    <div className="text-sm">{contract.longcode || contract.shortcode || '-'}</div>
                  </div>
                </TabsContent>
                
                <TabsContent value="details" className="space-y-4">
                  <ScrollArea className="h-[400px] w-full">
                    <div className="space-y-4">
                      {/* All Contract Fields */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Contract ID:</span>
                          <span className="ml-2 font-medium">{contract.contract_id || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Contract Type:</span>
                          <span className="ml-2 font-medium">{contract.contract_type || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">App Markup:</span>
                          <span className="ml-2 font-medium">{formatCurrency(contract.app_markup_amount, contract.currency)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Commission:</span>
                          <span className="ml-2 font-medium">{formatCurrency(contract.commission || contract.commision, contract.currency)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Bid Price:</span>
                          <span className="ml-2 font-medium">{formatCurrency(contract.bid_price, contract.currency)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sell Price:</span>
                          <span className="ml-2 font-medium">{formatCurrency(contract.sell_price, contract.currency)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Barrier Count:</span>
                          <span className="ml-2 font-medium">{contract.barrier_count || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Barrier Distance:</span>
                          <span className="ml-2 font-medium">{contract.barrier_spot_distance || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Display Value:</span>
                          <span className="ml-2 font-medium">{contract.display_value || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Display Contracts:</span>
                          <span className="ml-2 font-medium">{contract.display_number_of_contracts || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Multiplier:</span>
                          <span className="ml-2 font-medium">{contract.multiplier || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Growth Rate:</span>
                          <span className="ml-2 font-medium">{contract.growth_rate ? `${contract.growth_rate}%` : '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tick Count:</span>
                          <span className="ml-2 font-medium">{contract.tick_count || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Ticks Passed:</span>
                          <span className="ml-2 font-medium">{contract.tick_passed || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Selected Tick:</span>
                          <span className="ml-2 font-medium">{contract.selected_tick || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Selected Spot:</span>
                          <span className="ml-2 font-medium">{contract.selected_spot || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Is Intraday:</span>
                          <span className="ml-2 font-medium">{contract.is_intraday === 1 ? 'Yes' : 'No'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Is Settleable:</span>
                          <span className="ml-2 font-medium">{contract.is_settleable === 1 ? 'Yes' : 'No'}</span>
                        </div>
                      </div>

                      {/* Cancellation Details */}
                      {contract.cancellation && (
                        <div className="p-3 bg-muted rounded-lg space-y-2">
                          <h5 className="font-medium">Cancellation Options</h5>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Ask Price:</span>
                              <span className="ml-2">{formatCurrency(contract.cancellation.ask_price, contract.currency)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Expiry:</span>
                              <span className="ml-2">{formatTimestamp(contract.cancellation.date_expiry)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Limit Orders */}
                      {contract.limit_order && (
                        <div className="p-3 bg-muted rounded-lg space-y-3">
                          <h5 className="font-medium">Limit Orders</h5>
                          {contract.limit_order.stop_loss && (
                            <div>
                              <div className="text-sm font-medium text-red-600">Stop Loss</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>Amount: {contract.limit_order.stop_loss.display_order_amount}</div>
                                <div>Value: {contract.limit_order.stop_loss.value}</div>
                              </div>
                            </div>
                          )}
                          {contract.limit_order.take_profit && (
                            <div>
                              <div className="text-sm font-medium text-green-600">Take Profit</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>Amount: {contract.limit_order.take_profit.display_order_amount}</div>
                                <div>Value: {contract.limit_order.take_profit.value}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Validation Parameters */}
                      {contract.validation_params && (
                        <div className="p-3 bg-muted rounded-lg space-y-2">
                          <h5 className="font-medium">Validation Parameters</h5>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {contract.validation_params.stake && (
                              <div>Stake: {contract.validation_params.stake.min} - {contract.validation_params.stake.max}</div>
                            )}
                            {contract.validation_params.max_payout && (
                              <div>Max Payout: {contract.validation_params.max_payout.min} - {contract.validation_params.max_payout.max}</div>
                            )}
                            {contract.validation_params.max_ticks && (
                              <div>Max Ticks: {contract.validation_params.max_ticks.min} - {contract.validation_params.max_ticks.max}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Validation Errors */}
                      {contract.validation_error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <div>
                              <div className="text-sm font-medium text-red-800">Validation Error</div>
                              <div className="text-xs text-red-600">{contract.validation_error}</div>
                              {contract.validation_error_code && (
                                <div className="text-xs text-red-500">Code: {contract.validation_error_code}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Additional Fields for Special Contract Types */}
                      {contract.coupon_rate && (
                        <div className="p-3 bg-muted rounded-lg">
                          <h5 className="font-medium">Coupon Information</h5>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Rate: {contract.coupon_rate}%</div>
                            <div>Number: {contract.num_of_coupons || '-'}</div>
                          </div>
                        </div>
                      )}

                      {contract.reset_barrier && (
                        <div className="p-3 bg-muted rounded-lg">
                          <h5 className="font-medium">Reset Information</h5>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Barrier: {contract.reset_barrier}</div>
                            <div>Time: {formatTimestamp(contract.reset_time)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="ticks" className="space-y-4">
                  {/* Entry/Exit Ticks */}
                  <div className="grid grid-cols-2 gap-4">
                    {contract.entry_tick !== undefined && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-sm font-medium text-green-800">Entry Tick</div>
                        <div className="text-lg font-bold">{contract.entry_tick_display_value || contract.entry_tick}</div>
                        <div className="text-xs text-green-600">{formatTimestamp(contract.entry_tick_time)}</div>
                      </div>
                    )}
                    {contract.exit_tick !== undefined && (
                      <div className="p-3 bg-red-50 rounded-lg">
                        <div className="text-sm font-medium text-red-800">Exit Tick</div>
                        <div className="text-lg font-bold">{contract.exit_tick_display_value || contract.exit_tick}</div>
                        <div className="text-xs text-red-600">{formatTimestamp(contract.exit_tick_time)}</div>
                      </div>
                    )}
                  </div>

                  {/* Audit Details - All Ticks */}
                  {contract.audit_details?.all_ticks && contract.audit_details.all_ticks.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">All Ticks History</h5>
                        <Badge variant="outline">{contract.audit_details.all_ticks.length} ticks</Badge>
                      </div>
                      <ScrollArea className="h-[300px] w-full">
                        <div className="space-y-1">
                          {contract.audit_details.all_ticks.map((tick, index) => (
                            <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                              <div className="flex items-center space-x-4">
                                <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                                <div>
                                  <div className="font-mono font-medium">{tick.tick_display_value}</div>
                                  <div className="text-xs text-muted-foreground">{formatTimestamp(tick.epoch)}</div>
                                </div>
                              </div>
                              <div className="text-sm font-medium">{tick.tick.toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {contract.audit_details.contract_start && contract.audit_details.contract_end && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <div>Start: {formatTimestamp(contract.audit_details.contract_start)}</div>
                          <div>End: {formatTimestamp(contract.audit_details.contract_end)}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tick Stream */}
                  {contract.tick_stream && contract.tick_stream.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">Live Tick Stream</h5>
                        <Badge className="bg-blue-100 text-blue-800">
                          <Zap className="w-3 h-3 mr-1" />
                          {contract.tick_stream.length} ticks
                        </Badge>
                      </div>
                      <ScrollArea className="h-[200px] w-full">
                        <div className="space-y-1">
                          {contract.tick_stream.slice(-20).reverse().map((tick, index) => (
                            <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                              <div className="text-xs text-muted-foreground">{formatTimestamp(tick.epoch)}</div>
                              <div className="font-mono font-medium">{tick.tick_display_value}</div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Current Spot Barriers (for accumulators) */}
                  {(contract.current_spot_high_barrier || contract.current_spot_low_barrier) && (
                    <div className="p-3 bg-muted rounded-lg">
                      <h5 className="font-medium mb-2">Current Spot Barriers</h5>
                      <div className="grid grid-cols-2 gap-4">
                        {contract.current_spot_high_barrier && (
                          <div>
                            <div className="text-sm text-muted-foreground">High Barrier</div>
                            <div className="font-medium">{contract.current_spot_high_barrier}</div>
                          </div>
                        )}
                        {contract.current_spot_low_barrier && (
                          <div>
                            <div className="text-sm text-muted-foreground">Low Barrier</div>
                            <div className="font-medium">{contract.current_spot_low_barrier}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Connection Status Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">Active AI Volatility Trades ({accountType})</h3>
          {connectionStatus === 'connected' && (
            <Badge className="bg-green-100 text-green-800">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
              Live
            </Badge>
          )}
          {connectionStatus === 'connecting' && (
            <Badge variant="outline" className="animate-pulse">
              Connecting...
            </Badge>
          )}
          {connectionStatus === 'error' && (
            <Badge variant="destructive">Connection Error</Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {contracts.size} active contract{contracts.size !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Contracts List */}
      {contracts.size === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No active trades. Start a session to begin.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px] w-full">
          {Array.from(contracts.values()).map(contract => renderContractOverview(contract))}
        </ScrollArea>
      )}
    </div>
  );
}
