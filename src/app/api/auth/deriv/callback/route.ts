'use client'; // This directive is not applicable for API routes, removing it.

import { NextResponse, NextRequest } from 'next/server';
import WebSocket from 'ws'; // Import WebSocket
import type { UserInfo } from '@/types'; // Assuming UserInfo might be useful for structuring data

const DERIV_API_TIMEOUT_MS = 10000; // 10 seconds timeout for API requests

interface DerivAccount {
  account?: string;
  token?: string;
  currency?: string;
}

interface DerivAuthorizeResponse {
  authorize: {
    email?: string;
    user_id?: string;
    loginid?: string;
    currency?: string;
    balance?: number;
    landing_company_name?: string;
    landing_company_shortcode?: string;
    full_name?: string;
    account_list?: Array<{
      loginid: string;
      is_virtual?: number;
      icon?: string;
      balance?: number;
      currency?: string;
    }>;
    // ... other fields from Deriv's authorize response
  };
  error?: {
    code: string;
    message: string;
  };
  echo_req: any;
  msg_type: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  console.log('[Deriv Callback] Received callback with params:', Object.fromEntries(searchParams.entries()));

  const derivAppId = process.env.NEXT_PUBLIC_DERIV_APP_ID;
  if (!derivAppId) {
    console.error('[Deriv Callback] Deriv App ID (NEXT_PUBLIC_DERIV_APP_ID) is not configured in environment variables.');
    return NextResponse.redirect(new URL('/auth/login?error=config_error', request.url));
  }

  const accounts: DerivAccount[] = [];
  let i = 1;
  while (searchParams.has(`acct${i}`) && searchParams.has(`token${i}`)) {
    accounts.push({
      account: searchParams.get(`acct${i}`) || undefined,
      token: searchParams.get(`token${i}`) || undefined,
      currency: searchParams.get(`cur${i}`) || undefined,
    });
    i++;
  }

  if (accounts.length === 0 || !accounts[0].token) {
    console.error('[Deriv Callback] No account tokens found in callback parameters.');
    return NextResponse.redirect(new URL('/auth/login?error=deriv_auth_failed&reason=no_token', request.url));
  }

  // For simplicity, using the first token. Consider allowing user to select if multiple accounts are returned.
  const firstToken = accounts[0].token;
  console.log('[Deriv Callback] Attempting to authorize with token:', firstToken);

  try {
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppId}`);

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        console.log('[Deriv Callback] WebSocket connection opened.');
        ws.send(JSON.stringify({ authorize: firstToken, req_id: 1 }));
      };

      ws.onmessage = async (event) => {
        try {
          const response = JSON.parse(event.data.toString()) as DerivAuthorizeResponse;
          console.log('[Deriv Callback] Received WebSocket message:', response);

          if (response.error) {
            console.error('[Deriv Callback] Deriv API error:', response.error);
            ws.close();
            reject(new Error(`Deriv API Error: ${response.error.message} (Code: ${response.error.code})`));
            return;
          }

          if (response.msg_type === 'authorize' && response.authorize) {
            const derivUser = response.authorize;
            console.log('[Deriv Callback] Authorization successful. User data:', derivUser);

            // Extract necessary user information
            const userId = derivUser.user_id;
            const email = derivUser.email;
            const name = derivUser.full_name || derivUser.loginid;
            const loginid = derivUser.loginid; // The primary login ID of the authorized account
            
            // Find demo and real accounts from account_list for more detailed info
            let derivDemoAccountId: string | undefined;
            let derivRealAccountId: string | undefined;
            let derivDemoBalance: number | undefined;
            let derivRealBalance: number | undefined;

            if (derivUser.account_list) {
              const demoAccount = derivUser.account_list.find(acc => acc.is_virtual && acc.loginid.startsWith('VRTC'));
              const realAccount = derivUser.account_list.find(acc => !acc.is_virtual && acc.loginid.startsWith('CR'));
              
              derivDemoAccountId = demoAccount?.loginid;
              derivDemoBalance = demoAccount?.balance;
              derivRealAccountId = realAccount?.loginid;
              derivRealBalance = realAccount?.balance;
            }
            
             // Fallback if specific demo/real not found in list but primary account has info
            if (derivUser.loginid?.startsWith('VRTC') && derivDemoBalance === undefined) {
                derivDemoAccountId = derivUser.loginid;
                derivDemoBalance = derivUser.balance;
            } else if (derivUser.loginid?.startsWith('CR') && derivRealBalance === undefined) {
                derivRealAccountId = derivUser.loginid;
                derivRealBalance = derivUser.balance;
            }

            if (!userId || !email) {
              console.error('[Deriv Callback] Missing essential user_id or email from Deriv response.');
              ws.close();
              reject(new Error('Missing user_id or email from Deriv.'));
              return;
            }

            // Step 1: Call /api/auth/handle-users to create/update user in DB
            // This ensures the user exists in your system with Deriv ID as primary ID.
            console.log(`[Deriv Callback] Calling /api/auth/handle-users for Deriv user ${userId}`);
            const handleUserResponse = await fetch(`${request.nextUrl.origin}/api/auth/handle-users`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: userId,      // Deriv User ID as the primary ID
                email: email,        // Deriv Email
                name: name || 'Deriv User', // Deriv Full Name or LoginID
                // Potentially add other fields if your handle-users endpoint supports them e.g. auth_method: 'deriv'
              }),
            });

            if (!handleUserResponse.ok) {
              const errorBody = await handleUserResponse.text();
              console.error('[Deriv Callback] Failed to handle user in DB:', handleUserResponse.status, errorBody);
              ws.close();
              reject(new Error(`Failed to update user in DB: ${handleUserResponse.statusText}. Details: ${errorBody}`));
              return;
            }
            console.log('[Deriv Callback] Successfully handled user in DB.');

            // Step 2: Redirect to a client-side finalization page with user details
            // These details will be used by the client to call AuthContext.login()
            const finalizeUrl = new URL('/auth/deriv/finalize', request.nextUrl.origin);
            finalizeUrl.searchParams.set('derivUserId', userId);
            finalizeUrl.searchParams.set('email', email);
            if (name) finalizeUrl.searchParams.set('name', name);
            if (loginid) finalizeUrl.searchParams.set('loginid', loginid);
            if (derivDemoAccountId) finalizeUrl.searchParams.set('derivDemoAccountId', derivDemoAccountId);
            if (typeof derivDemoBalance === 'number') finalizeUrl.searchParams.set('derivDemoBalance', derivDemoBalance.toString());
            if (derivRealAccountId) finalizeUrl.searchParams.set('derivRealAccountId', derivRealAccountId);
            if (typeof derivRealBalance === 'number') finalizeUrl.searchParams.set('derivRealBalance', derivRealBalance.toString());
            // Add other necessary params like account currency etc.
            
            ws.close();
            resolve(); // Resolve the main promise
            // Perform redirect outside, after promise resolves/rejects
            // Cannot use NextResponse directly inside WebSocket event handlers if they don't return it up.

            // Store redirect URL to use after promise is done
            (request as any)._tempRedirectUrl = finalizeUrl.toString(); 
            return; // Exit onmessage handler
          }
        } catch (parseError) {
          console.error('[Deriv Callback] Error parsing WebSocket message or during processing:', parseError);
          ws.close();
          reject(parseError); // Reject the main promise
        }
      };

      ws.onerror = (error) => {
        console.error('[Deriv Callback] WebSocket error:', error);
        ws.close(); // Ensure closed on error
        reject(error); // Reject the main promise
      };

      ws.onclose = (event) => {
        console.log('[Deriv Callback] WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
        // If promise hasn't resolved or rejected yet (e.g. closed prematurely without expected message)
        // It might be good to reject here if not already handled.
        // However, typical flow is resolve/reject in onmessage or onerror.
      };

      // Timeout for the entire WebSocket interaction
      setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
           console.warn('[Deriv Callback] WebSocket interaction timed out.');
           ws.close();
           reject(new Error('Deriv API interaction timed out.'));
        }
      }, DERIV_API_TIMEOUT_MS);
    });

    // If we reached here, the promise resolved, and _tempRedirectUrl should be set.
    if ((request as any)._tempRedirectUrl) {
      return NextResponse.redirect((request as any)._tempRedirectUrl);
    }
    // Fallback if something went wrong with setting temp redirect URL but promise resolved (should not happen)
    console.error('[Deriv Callback] Promise resolved but no redirect URL was set.');
    return NextResponse.redirect(new URL('/auth/login?error=deriv_processing_failed&reason=internal_redirect_error', request.url));

  } catch (error) {
    console.error('[Deriv Callback] Error in Deriv OAuth flow:', error);
    let reason = 'processing_failed';
    if (error instanceof Error) {
        if (error.message.includes('Deriv API Error')) reason = 'deriv_api_error';
        else if (error.message.includes('timed out')) reason = 'timeout';
        else if (error.message.includes('Missing user_id or email')) reason = 'data_missing';
        else if (error.message.includes('Failed to update user in DB')) reason = 'db_error';
    }
    return NextResponse.redirect(new URL(`/auth/login?error=deriv_${reason}&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, request.url));
  }
} 