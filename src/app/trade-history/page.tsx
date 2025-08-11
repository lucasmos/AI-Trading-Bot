'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { DerivTradeTable } from '@/components/trade-history/deriv-trade-table';
import { convertToDerivTradeRecord } from '@/utils/deriv-trade-utils';
import type { DerivTradeRecord } from '@/types';



export default function TradeHistoryPage() {
  const { userInfo } = useAuth();
  const [derivTradeHistory, setDerivTradeHistory] = useState<DerivTradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [apiError, setApiError] = useState<string | null>(null);

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
            {/* Action Buttons */}
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
              disabled={derivTradeHistory.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {derivTradeHistory.length === 0 && !apiError ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No trade history available in the database.</p>
              <p className="text-sm text-muted-foreground">
                Execute trades on the dashboard to see them here.
              </p>
            </div>
          ) : apiError && derivTradeHistory.length === 0 ? (
            <div className="text-center py-6">
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
        </CardContent>
      </Card>
    </div>
  );
}

