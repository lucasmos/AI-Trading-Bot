'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, UserCheck, Briefcase } from 'lucide-react';

interface BalanceDisplayProps {
  balance: number;
  currency?: string;
  selectedAccountType: 'demo' | 'real' | null; // Changed from accountType: PaperTradingMode
  displayAccountId: string | null; // New prop for Deriv Account ID
}

export function BalanceDisplay({
  balance,
  currency = 'USD',
  selectedAccountType,
  displayAccountId
}: BalanceDisplayProps) {
  const [formattedBalance, setFormattedBalance] = useState<string | null>(null);

  useEffect(() => {
    setFormattedBalance(
      balance.toLocaleString(undefined, { 
        style: 'currency', 
        currency: currency, 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })
    );
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
          {formattedBalance !== null ? formattedBalance : `${currency === 'USD' ? '$' : currency}0.00 (Loading...`}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isValidDerivAccount
            ? `Available for trading in your selected Deriv ${selectedAccountType} account.`
            : "Practice balance for trading."}
        </p>
      </CardContent>
    </Card>
  );
}