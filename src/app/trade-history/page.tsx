'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Download } from "lucide-react";
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { DerivTradeTable } from '@/components/trade-history/deriv-trade-table';
import { convertToDerivTradeRecord } from '@/utils/deriv-trade-utils';
import { ProfitTableDisplay, ProfitTableDisplayRef } from '@/components/profit-table/profit-table-display';
import { ProfitTableSync } from '@/components/profit-table/profit-table-sync';
import type { DerivTradeRecord } from '@/types';



export default function TradeHistoryPage() {
  const { userInfo, selectedDerivAccountType } = useAuth();
  const [derivTradeHistory, setDerivTradeHistory] = useState<DerivTradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('local-trades');
  const [selectedProfitTableAccount, setSelectedProfitTableAccount] = useState<'demo' | 'real'>('demo');
  const profitTableRef = useRef<ProfitTableDisplayRef | null>(null);

  const refreshHistory = async () => {
    setIsLoading(true);
    setApiError(null);
    
    if (!userInfo?.id) {
      setIsLoading(false);
      setApiError("User not authenticated. Cannot fetch trade history.");
      setDerivTradeHistory([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/trades/history?userId=${userInfo.id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `API error: ${response.status} ${response.statusText}` }));
        throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
      }
      
      const apiTrades = await response.json();

      // Convert API trades directly to Deriv format
      const derivTrades = apiTrades.map((trade: any) => convertToDerivTradeRecord(trade));
      console.log("Fetched trades from database:", derivTrades.length);
      setDerivTradeHistory(derivTrades.sort((a: DerivTradeRecord, b: DerivTradeRecord) => b.purchase_time - a.purchase_time));

    } catch (error) {
      console.error("Error fetching trades from API:", error);
      setApiError(error instanceof Error ? error.message : "Unknown API error");
      setDerivTradeHistory([]); // Clear history on error
    } finally {
      setLastRefresh(new Date());
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshHistory();
  }, [userInfo]);


  // Function to export Deriv trades to CSV
  const exportToCsv = () => {
    if (derivTradeHistory.length === 0) return;

    const headers = ["Contract ID", "Longcode", "Shortcode", "Buy Price", "Payout", "Purchase Time", "Sell Price", "Sell Time", "Status"];
    const rows = derivTradeHistory.map(trade => [
      trade.contract_id,
      trade.longcode,
      trade.shortcode,
      trade.buy_price,
      trade.payout,
      new Date(trade.purchase_time * 1000).toLocaleString(),
      trade.sell_price || '',
      trade.sell_time ? new Date(trade.sell_time * 1000).toLocaleString() : '',
      trade.status,
    ].map(item => `"${String(item).replace(/"/g, '""')}"`)); // Basic CSV escaping

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'deriv_trade_history.csv');
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

  const handleProfitTableRefresh = () => {
    // This will be called by the sync component to refresh the profit table display
    if (profitTableRef.current) {
      profitTableRef.current.refresh();
    }
  };

  return (
    <div className="container mx-auto py-2 space-y-6">
      {/* Main card with tabs */}
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <div className="flex flex-col mb-4 sm:mb-0">
              <CardTitle>Trade History</CardTitle>
              <CardDescription className="mt-1">
                Review your trading activity from multiple sources.
                {userInfo && <span className="ml-1">User ID: {userInfo.id}</span>}
              </CardDescription>
            </div>

            {activeTab === 'local-trades' && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshHistory()}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportToCsv}
                  disabled={derivTradeHistory.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="local-trades">Local Trades</TabsTrigger>
              <TabsTrigger value="profit-table">Profit Table</TabsTrigger>
            </TabsList>
            
            <TabsContent value="local-trades" className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Last refreshed: {lastRefresh.toLocaleString()}
                {apiError && <span className="text-red-500 ml-2">Error: {apiError}</span>}
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading local trade history...
                </div>
              ) : derivTradeHistory.length === 0 && !apiError ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No local trade history available.</p>
                  <p className="text-sm text-muted-foreground">
                    Execute trades on the dashboard to see them here, or use the Profit Table tab for Deriv API data.
                  </p>
                </div>
              ) : apiError && derivTradeHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-red-500 mb-4">Error loading trade history: {apiError}</p>
                  <p className="text-sm text-muted-foreground">
                    Please try refreshing or check your connection.
                  </p>
                </div>
              ) : (
                <DerivTradeTable
                  trades={derivTradeHistory}
                  maxHeight="600px"
                  emptyMessage="No trade history available in the database."
                />
              )}
            </TabsContent>
            
            <TabsContent value="profit-table" className="space-y-6">
              {/* Account selector for profit table */}
              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm font-medium">Account Type:</label>
                <Select 
                  value={selectedProfitTableAccount} 
                  onValueChange={(value: 'demo' | 'real') => setSelectedProfitTableAccount(value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="real">Real</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Sync component */}
              <ProfitTableSync 
                accountType={selectedProfitTableAccount} 
                onSyncComplete={handleProfitTableRefresh}
              />
              
              {/* Profit table display */}
              <ProfitTableDisplay 
                accountType={selectedProfitTableAccount}
                ref={profitTableRef}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

