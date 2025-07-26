'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, UserCheck, Briefcase } from 'lucide-react';
import type { ListenerStatus } from '@/services/deriv-balance-listener';

interface BalanceDisplayProps {
  balance: number; // Assuming balance might be 0 initially but not null if account is loaded
  currency?: string;
  selectedAccountType: 'demo' | 'real' | null;
  displayAccountId: string | null;
  syncStatus?: ListenerStatus;
  sessionProfitLoss?: number;
  completedTrades?: number;
}

export function BalanceDisplay({
  balance,
  currency = 'USD',
  selectedAccountType,
  displayAccountId,
  syncStatus = 'idle',
  sessionProfitLoss = 0,
  completedTrades = 0
}: BalanceDisplayProps) {
  const [formattedBalance, setFormattedBalance] = useState<string | null>(null);

  useEffect(() => {
    if (balance === null) {
      setFormattedBalance(null);
    } else {
      setFormattedBalance(
        Number(balance).toLocaleString(undefined, {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      );
    }
  }, [balance, currency]);

  const isValidDerivAccount = selectedAccountType === 'demo' || selectedAccountType === 'real';
  const AccountIcon = selectedAccountType === 'real' ? Briefcase : UserCheck;

  let accountLabel = 'Paper Balance'; // Default for null or non-Deriv
  if (selectedAccountType === 'demo') {
    accountLabel = `Demo Account ${displayAccountId ? `(${displayAccountId})` : ''}`;
  } else if (selectedAccountType === 'real') {
    accountLabel = `Real Account ${displayAccountId ? `(${displayAccountId})` : ''}`;
  } else if (selectedAccountType === null) { // Guest or user without Deriv link
     accountLabel = 'Practice Balance'; // Or "Paper Trading Balance"
  }


  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
          <AccountIcon className={`mr-2 h-5 w-5 ${selectedAccountType === 'real' ? 'text-green-500' : (selectedAccountType === 'demo' ? 'text-blue-500' : 'text-gray-500')}`} />
          {accountLabel}
        </CardTitle>
        <DollarSign className="h-5 w-5 text-accent" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">
          { balance === null
            ? 'Syncing...'
            : formattedBalance !== null
              ? formattedBalance
              : `${currency === 'USD' ? '$' : currency}0.00 (Unavailable)` }
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isValidDerivAccount
            ? `Available for trading in your selected Deriv ${selectedAccountType} account.`
            : "Practice balance for trading."}
        </p>
        {(sessionProfitLoss !== 0 || completedTrades > 0) && (
          <div className="mt-2 p-2 bg-muted rounded-md">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Session:</span>
              <span className="font-medium">{completedTrades} trades</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-1">
              <span className="text-muted-foreground">P/L:</span>
              <span className={`font-semibold ${sessionProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {sessionProfitLoss >= 0 ? '+' : ''}${sessionProfitLoss.toFixed(2)}
              </span>
            </div>
          </div>
        )}
        {isValidDerivAccount && syncStatus !== 'idle' && (
          <p className={`text-xs mt-1 ${
            syncStatus === 'connected' ? 'text-green-500' :
            syncStatus === 'error' || syncStatus === 'disconnected' ? 'text-red-500' :
            'text-amber-500' // connecting, reconnecting
          }`}>
            {syncStatus === 'connected' && 'Live sync active'}
            {syncStatus === 'connecting' && 'Syncing live balance...'}
            {syncStatus === 'reconnecting' && 'Reconnecting live balance...'}
            {syncStatus === 'disconnected' && 'Live balance sync offline.'}
            {syncStatus === 'error' && 'Live balance sync error.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}