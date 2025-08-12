'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';

interface ProfitTableSyncProps {
  accountType: 'demo' | 'real';
  onSyncComplete?: () => void;
}

export function ProfitTableSync({ accountType, onSyncComplete }: ProfitTableSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const { toast } = useToast();
  const { userInfo } = useAuth();

  const syncProfitTable = async () => {
    if (!userInfo) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to sync profit table data.',
        variant: 'destructive'
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatus('Connecting to Deriv API...');

    try {
      const response = await fetch('/api/deriv/sync-profit-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountType })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Sync failed: ${response.status}`);
      }

      const result = await response.json();
      
      setSyncStatus('Sync completed successfully!');
      toast({
        title: 'Sync Successful',
        description: `Profit table data has been synchronized for your ${accountType} account.`,
        duration: 5000
      });

      // Call the callback to refresh the profit table display
      if (onSyncComplete) {
        setTimeout(onSyncComplete, 1000); // Give the backend time to process
      }

    } catch (error) {
      console.error('Profit table sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      
      setSyncStatus(`Sync failed: ${errorMessage}`);
      toast({
        title: 'Sync Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 8000
      });
    } finally {
      setIsSyncing(false);
      // Clear status message after a delay
      setTimeout(() => setSyncStatus(''), 5000);
    }
  };

  const getApiTokenStatus = () => {
    if (!userInfo) return { hasToken: false, message: 'User not authenticated' };
    
    const tokenField = accountType === 'demo' ? 'derivDemoApiToken' : 'derivRealApiToken';
    const accountField = accountType === 'demo' ? 'derivDemoAccountId' : 'derivRealAccountId';
    
    const hasToken = !!(userInfo as any)[tokenField];
    const hasAccount = !!(userInfo as any)[accountField];
    
    if (!hasToken) {
      return { 
        hasToken: false, 
        message: `${accountType} API token not configured` 
      };
    }
    
    if (!hasAccount) {
      return { 
        hasToken: false, 
        message: `${accountType} account ID not found` 
      };
    }
    
    return { hasToken: true, message: 'Ready to sync' };
  };

  const tokenStatus = getApiTokenStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Sync Profit Table ({accountType.toUpperCase()})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Synchronize your trading history from Deriv API
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge 
                variant={tokenStatus.hasToken ? 'default' : 'destructive'}
                className={tokenStatus.hasToken ? 'bg-green-500 hover:bg-green-600' : ''}
              >
                {tokenStatus.hasToken ? 'Ready' : 'Not Configured'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {tokenStatus.message}
              </span>
            </div>
          </div>
          
          <Button 
            onClick={syncProfitTable}
            disabled={!tokenStatus.hasToken || isSyncing}
            className="min-w-[100px]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {syncStatus && (
          <div className={`flex items-center gap-2 p-3 rounded-md ${
            syncStatus.includes('failed') || syncStatus.includes('error')
              ? 'bg-red-50 border border-red-200 text-red-700'
              : syncStatus.includes('successfully')
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-blue-50 border border-blue-200 text-blue-700'
          }`}>
            {syncStatus.includes('failed') || syncStatus.includes('error') ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            )}
            <span className="text-sm font-medium">{syncStatus}</span>
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
          <p>• This will fetch your complete trading history from Deriv</p>
          <p>• Large accounts may take several minutes to sync</p>
          <p>• Data is stored locally and updated incrementally</p>
        </div>
      </CardContent>
    </Card>
  );
}
