import { NextResponse } from 'next/server';
import { authorizeDeriv, getDerivAccountList, getDerivAccountSettings } from '@/services/deriv';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
  }

  try {
    // 1. Authorize with Deriv API using the token
    const authResponse = await authorizeDeriv(token);
    if (!authResponse || !authResponse.authorize || !authResponse.authorize.loginid) {
      console.error('[API/deriv-profile] Deriv authorization failed:', authResponse);
      return NextResponse.json({ error: 'Deriv authorization failed' }, { status: 401 });
    }

    const derivLoginId = authResponse.authorize.loginid;
    const derivEmail = authResponse.authorize.email; // Assuming email is available in authorize response

    if (!derivEmail) {
      console.error('[API/deriv-profile] Deriv API did not return an email for login ID:', derivLoginId);
      return NextResponse.json({ error: 'Deriv email not found' }, { status: 500 });
    }

    // 2. Fetch account list and settings for more details
    const accountListResponse = await getDerivAccountList(token);
    const settingsResponse = await getDerivAccountSettings(token);

    let userName = derivLoginId; // Default name
    if (settingsResponse && settingsResponse.get_settings) {
      userName = settingsResponse.get_settings.first_name || settingsResponse.get_settings.last_name || derivEmail;
    }

    let derivDemoAccountId: string | undefined;
    let derivDemoBalance: number | undefined;
    let derivRealAccountId: string | undefined;
    let derivRealBalance: number | undefined;

    if (accountListResponse && accountListResponse.account_list) {
      const demoAccount = accountListResponse.account_list.find((acc: any) => acc.is_virtual === 1);
      const realAccount = accountListResponse.account_list.find((acc: any) => acc.is_virtual === 0);

      if (demoAccount) {
        derivDemoAccountId = demoAccount.loginid;
        // Fetch balance for demo account if available
        const demoBalanceResponse = await authorizeDeriv(demoAccount.token); // Re-authorize with specific account token if needed, or query balance
        if (demoBalanceResponse && demoBalanceResponse.authorize && typeof demoBalanceResponse.authorize.balance === 'number') {
          derivDemoBalance = demoBalanceResponse.authorize.balance;
        } else if (demoAccount.balance) { // Fallback if balance is in account_list
          derivDemoBalance = demoAccount.balance;
        }
      }
      if (realAccount) {
        derivRealAccountId = realAccount.loginid;
        // Fetch balance for real account
        const realBalanceResponse = await authorizeDeriv(realAccount.token);
        if (realBalanceResponse && realBalanceResponse.authorize && typeof realBalanceResponse.authorize.balance === 'number') {
          derivRealBalance = realBalanceResponse.authorize.balance;
        } else if (realAccount.balance) { // Fallback if balance is in account_list
          derivRealBalance = realAccount.balance;
        }
      }
    }

    // 3. Prepare the profile object for NextAuth
    const profile = {
      derivUserId: derivLoginId, // Use Deriv's loginid as the unique ID for Deriv provider
      email: derivEmail,
      name: userName,
      provider: 'deriv',
      derivAccountId: derivLoginId, // Main Deriv account ID
      derivDemoAccountId: derivDemoAccountId,
      derivDemoBalance: derivDemoBalance,
      derivRealAccountId: derivRealAccountId,
      derivRealBalance: derivRealBalance,
      // You can add other relevant fields from Deriv API here
    };

    console.log('[API/deriv-profile] Successfully fetched Deriv profile.', profile);
    return NextResponse.json(profile);

  } catch (error) {
    console.error('[API/deriv-profile] Error fetching Deriv profile:', error);
    return NextResponse.json({ error: 'Failed to fetch Deriv profile' }, { status: 500 });
  }
} 