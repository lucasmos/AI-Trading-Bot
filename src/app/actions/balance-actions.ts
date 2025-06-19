'use server';

import { getDerivAccountBalance } from '@/services/deriv'; // Ensure this path is correct

interface UserBalanceIdentifiers {
  userId?: string; // Included for context, though not directly used by getDerivAccountBalance
  demoAccountId?: string | null;
  demoApiToken?: string | null;
  realAccountId?: string | null;
  realApiToken?: string | null;
}

interface UpdatedBalancesResponse {
  derivDemoBalance?: number | null;
  derivRealBalance?: number | null;
  error?: string | null;
  demoAccountError?: string | null;
  realAccountError?: string | null;
}

export async function getUpdatedUserBalances(
  identifiers: UserBalanceIdentifiers
): Promise<UpdatedBalancesResponse> {
  const { demoAccountId, demoApiToken, realAccountId, realApiToken } = identifiers;
  let demoBalance: number | null = null;
  let realBalance: number | null = null;
  let mainError: string | null = null;
  let demoError: string | null = null;
  let realError: string | null = null;

  console.log('[balance-actions] getUpdatedUserBalances called with identifiers:', identifiers);

  const results = await Promise.allSettled([
    (demoAccountId && demoApiToken)
      ? getDerivAccountBalance(demoApiToken, demoAccountId)
      : Promise.resolve(null), // Resolve with null if no demo details
    (realAccountId && realApiToken)
      ? getDerivAccountBalance(realApiToken, realAccountId)
      : Promise.resolve(null),  // Resolve with null if no real details
  ]);

  const demoResult = results[0];
  if (demoResult.status === 'fulfilled' && demoResult.value) {
    demoBalance = demoResult.value.balance;
    console.log(`[balance-actions] Fetched demo balance: ${demoBalance} for account ${demoAccountId}`);
  } else if (demoResult.status === 'rejected') {
    demoError = `Demo account (${demoAccountId || 'N/A'}) balance fetch failed: ${demoResult.reason?.message || demoResult.reason || 'Unknown error'}`;
    console.error(`[balance-actions] ${demoError}`);
  } else if (demoResult.status === 'fulfilled' && !demoResult.value && demoAccountId) {
    // This case means getDerivAccountBalance resolved with null, which shouldn't happen if called.
    // Or it was intentionally not called because token/ID was missing.
    if (demoAccountId && demoApiToken) { // Only an error if we expected to call it
        demoError = `Demo account (${demoAccountId}) balance fetch resolved null unexpectedly.`;
        console.error(`[balance-actions] ${demoError}`);
    }
  }


  const realResult = results[1];
  if (realResult.status === 'fulfilled' && realResult.value) {
    realBalance = realResult.value.balance;
    console.log(`[balance-actions] Fetched real balance: ${realBalance} for account ${realAccountId}`);
  } else if (realResult.status === 'rejected') {
    realError = `Real account (${realAccountId || 'N/A'}) balance fetch failed: ${realResult.reason?.message || realResult.reason || 'Unknown error'}`;
    console.error(`[balance-actions] ${realError}`);
  } else if (realResult.status === 'fulfilled' && !realResult.value && realAccountId) {
    if (realAccountId && realApiToken) { // Only an error if we expected to call it
        realError = `Real account (${realAccountId}) balance fetch resolved null unexpectedly.`;
        console.error(`[balance-actions] ${realError}`);
    }
  }

  if (demoError && realError) {
    mainError = "Failed to fetch balances for both demo and real accounts.";
  } else if (demoError) {
    mainError = "Failed to fetch demo account balance.";
  } else if (realError) {
    mainError = "Failed to fetch real account balance.";
  }


  return {
    derivDemoBalance: demoBalance,
    derivRealBalance: realBalance,
    error: mainError,
    demoAccountError: demoError,
    realAccountError: realError,
  };
}
