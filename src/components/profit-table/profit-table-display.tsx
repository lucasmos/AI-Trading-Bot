'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProfitTableEntry {
  id: string;
  contractId: string;
  longcode: string;
  shortcode: string;
  symbol?: string;
  buyPriceDisplay: number;
  sellPriceDisplay?: number;
  payoutDisplay: number;
  profitDisplay?: number;
  purchaseTime: string;
  sellTime?: string;
  durationType?: string;
  accountType: string;
  appId?: number;
  transactionId?: string;
}

interface ProfitTableResponse {
  entries: ProfitTableEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface ProfitTableDisplayProps {
  accountType: 'demo' | 'real';
}

export interface ProfitTableDisplayRef {
  refresh: () => void;
}

export const ProfitTableDisplay = forwardRef<ProfitTableDisplayRef, ProfitTableDisplayProps>(({ accountType }, ref) => {
  const [data, setData] = useState<ProfitTableResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const pageSize = 50;

  const fetchProfitTable = async (page: number = 0) => {
    setIsLoading(true);
    setError(null);

    try {
      const offset = page * pageSize;
      const response = await fetch(
        `/api/profit-table?accountType=${accountType}&limit=${pageSize}&offset=${offset}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const profitData: ProfitTableResponse = await response.json();
      setData(profitData);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching profit table:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch profit table';
      setError(errorMessage);
      toast({
        title: 'Fetch Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfitTable();
  }, [accountType]);

  // Expose refresh function to parent components
  useImperativeHandle(ref, () => ({
    refresh: () => fetchProfitTable(currentPage)
  }));

  const formatDateTime = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleString();
  };

  const formatDuration = (durationType?: string, duration?: number) => {
    if (!durationType) return 'N/A';

    const typeMap: Record<string, string> = {
      't': 'ticks',
      'm': 'minutes',
      'h': 'hours',
      'd': 'days'
    };

    // If duration is available, show it with the type
    if (duration) {
      return `${duration} ${typeMap[durationType] || durationType}${duration !== 1 ? 's' : ''}`;
    }

    // Otherwise, just show the type indicator
    return typeMap[durationType] || durationType;
  };

  const getProfitBadge = (profit?: number, sellPrice?: number) => {
    // For profit table entries, all trades are completed/settled
    // Don't show "Open" status for any profit table entries

    if (profit === undefined || profit === null) {
      // If no profit data but we have sell price, show settled
      if (sellPrice !== undefined && sellPrice !== null) {
        return <Badge variant="outline">Settled</Badge>;
      }
      // If no profit and no sell price, still show as settled since these are from profit table
      return <Badge variant="outline">Settled</Badge>;
    }

    if (profit > 0) {
      return <Badge className="bg-green-500 hover:bg-green-600 text-white">+${profit.toFixed(2)}</Badge>;
    } else if (profit < 0) {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white">${profit.toFixed(2)}</Badge>;
    } else {
      return <Badge variant="outline">$0.00</Badge>;
    }
  };

  const exportToCsv = () => {
    if (!data?.entries.length) return;

    const headers = [
      'Contract ID', 'Transaction ID', 'Symbol', 'Longcode', 'Shortcode',
      'Buy Price', 'Sell Price', 'Payout', 'Profit/Loss',
      'Purchase Time', 'Sell Time', 'Duration', 'App ID', 'Account Type'
    ];
    
    const rows = data.entries.map(entry => [
      entry.contractId,
      entry.transactionId || '',
      entry.symbol || '',
      entry.longcode,
      entry.shortcode,
      entry.buyPriceDisplay.toFixed(2),
      entry.sellPriceDisplay?.toFixed(2) || '',
      entry.payoutDisplay.toFixed(2),
      entry.profitDisplay?.toFixed(2) || '',
      formatDateTime(entry.purchaseTime),
      entry.sellTime ? formatDateTime(entry.sellTime) : '',
      formatDuration(entry.durationType),
      entry.appId || '',
      entry.accountType
    ].map(item => `"${String(item).replace(/"/g, '""')}"`));

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `profit_table_${accountType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = data ? Math.ceil(data.pagination.total / pageSize) : 0;

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profit Table ({accountType.toUpperCase()})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading profit table data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle>Profit Table ({accountType.toUpperCase()})</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? `${data.pagination.total} total entries` : 'No data available'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchProfitTable(currentPage)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportToCsv}
            disabled={!data?.entries.length}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Error: {error}</p>
            <Button onClick={() => fetchProfitTable(currentPage)} variant="outline">
              Try Again
            </Button>
          </div>
        ) : !data?.entries.length ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No profit table data available.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Sync your profit table data to see historical trading information.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract ID</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Buy Price</TableHead>
                    <TableHead>Sell Price</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>P/L</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Purchase Time</TableHead>
                    <TableHead>Sell Time</TableHead>
                    <TableHead>App ID</TableHead>
                    <TableHead className="max-w-[200px]">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      {/* Contract ID */}
                      <TableCell className="font-mono text-xs">
                        {String(entry.contractId).slice(-8)}...
                      </TableCell>

                      {/* Transaction ID */}
                      <TableCell className="font-mono text-xs">
                        {entry.transactionId ? String(entry.transactionId).slice(-8) + '...' : 'N/A'}
                      </TableCell>

                      {/* Symbol */}
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {entry.symbol || 'N/A'}
                        </Badge>
                      </TableCell>

                      {/* Buy Price */}
                      <TableCell className="text-right font-medium">
                        ${entry.buyPriceDisplay.toFixed(2)}
                      </TableCell>

                      {/* Sell Price */}
                      <TableCell className="text-right">
                        {entry.sellPriceDisplay !== null && entry.sellPriceDisplay !== undefined
                          ? `$${entry.sellPriceDisplay.toFixed(2)}`
                          : '-'
                        }
                      </TableCell>

                      {/* Payout */}
                      <TableCell className="text-right">
                        ${entry.payoutDisplay.toFixed(2)}
                      </TableCell>

                      {/* Profit/Loss */}
                      <TableCell className="text-right">
                        {getProfitBadge(entry.profitDisplay, entry.sellPriceDisplay)}
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="text-sm">
                        {formatDuration(entry.durationType)}
                      </TableCell>

                      {/* Purchase Time */}
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span>{formatDateTime(entry.purchaseTime).split(' ')[0]}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(entry.purchaseTime).split(' ')[1]}
                          </span>
                        </div>
                      </TableCell>

                      {/* Sell Time */}
                      <TableCell className="text-sm">
                        {entry.sellTime ? (
                          <div className="flex flex-col">
                            <span>{formatDateTime(entry.sellTime).split(' ')[0]}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(entry.sellTime).split(' ')[1]}
                            </span>
                          </div>
                        ) : '-'}
                      </TableCell>

                      {/* App ID */}
                      <TableCell className="font-mono text-xs">
                        {entry.appId || 'N/A'}
                      </TableCell>

                      {/* Description */}
                      <TableCell className="max-w-[200px]">
                        <div className="text-xs">
                          <div className="font-medium truncate" title={entry.longcode}>
                            {entry.longcode}
                          </div>
                          <div className="text-muted-foreground truncate" title={entry.shortcode}>
                            {entry.shortcode}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchProfitTable(currentPage - 1)}
                    disabled={currentPage === 0 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchProfitTable(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1 || isLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
});

ProfitTableDisplay.displayName = 'ProfitTableDisplay';
