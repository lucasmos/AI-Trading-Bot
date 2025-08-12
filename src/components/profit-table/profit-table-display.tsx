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
  duration?: number;
  accountType: string;
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
    if (!durationType || !duration) return 'N/A';
    
    const typeMap: Record<string, string> = {
      't': 'tick',
      'm': 'min',
      'h': 'hour',
      'd': 'day'
    };
    
    return `${duration} ${typeMap[durationType] || durationType}${duration !== 1 ? 's' : ''}`;
  };

  const getProfitBadge = (profit?: number, sellPrice?: number) => {
    if (sellPrice === undefined || sellPrice === null) {
      return <Badge variant="secondary">Open</Badge>;
    }
    
    if (profit === undefined || profit === null) {
      return <Badge variant="outline">Settled</Badge>;
    }
    
    if (profit > 0) {
      return <Badge className="bg-green-500 hover:bg-green-600">+${profit.toFixed(2)}</Badge>;
    } else if (profit < 0) {
      return <Badge className="bg-red-500 hover:bg-red-600">${profit.toFixed(2)}</Badge>;
    } else {
      return <Badge variant="outline">$0.00</Badge>;
    }
  };

  const exportToCsv = () => {
    if (!data?.entries.length) return;

    const headers = [
      'Contract ID', 'Symbol', 'Longcode', 'Shortcode', 
      'Buy Price', 'Sell Price', 'Payout', 'Profit/Loss',
      'Purchase Time', 'Sell Time', 'Duration', 'Account Type'
    ];
    
    const rows = data.entries.map(entry => [
      entry.contractId,
      entry.symbol || '',
      entry.longcode,
      entry.shortcode,
      entry.buyPriceDisplay.toFixed(2),
      entry.sellPriceDisplay?.toFixed(2) || '',
      entry.payoutDisplay.toFixed(2),
      entry.profitDisplay?.toFixed(2) || '',
      formatDateTime(entry.purchaseTime),
      entry.sellTime ? formatDateTime(entry.sellTime) : '',
      formatDuration(entry.durationType, entry.duration),
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Buy Price</TableHead>
                    <TableHead>Sell Price</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>P/L</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Purchase Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs">
                        <div>
                          <div className="font-medium">#{entry.contractId.slice(-8)}</div>
                          <div className="text-muted-foreground truncate max-w-xs" title={entry.longcode}>
                            {entry.shortcode}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {entry.symbol || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>${entry.buyPriceDisplay.toFixed(2)}</TableCell>
                      <TableCell>
                        {entry.sellPriceDisplay !== null && entry.sellPriceDisplay !== undefined 
                          ? `$${entry.sellPriceDisplay.toFixed(2)}` 
                          : '-'
                        }
                      </TableCell>
                      <TableCell>${entry.payoutDisplay.toFixed(2)}</TableCell>
                      <TableCell>
                        {getProfitBadge(entry.profitDisplay, entry.sellPriceDisplay)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDuration(entry.durationType, entry.duration)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDateTime(entry.purchaseTime)}
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
