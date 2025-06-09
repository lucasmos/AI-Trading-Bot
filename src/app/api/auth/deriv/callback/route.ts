// src/app/api/auth/deriv/callback/route.ts (with added logging)
import { NextResponse, NextRequest } from 'next/server';
import WebSocket from 'ws';

const DERIV_API_TIMEOUT_MS = 20000; // 20 seconds timeout

interface DerivAccount {
  account?: string;
  token?: string;
  currency?: string;
}

interface DerivAuthorizeResponse {
    authorize?: {
        account_list: Array<{ loginid: string; is_virtual: 0 | 1; balance?: number; }>;
        email: string;
        fullname?: string;
        user_id: string;
        loginid: string;
    };
    error?: { code: string; message: string; };
    // msg_type: 'authorize'; // This was removed as per subtask_report from 2024-07-16T09:58:47.815Z, keeping it removed.
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseRedirectPath = '/auth/deriv/process-login';
  let redirectUrl = new URL(baseRedirectPath, request.nextUrl.origin);

  console.log('[Deriv Callback] Received callback with params:', Object.fromEntries(searchParams.entries()));

  const derivAppId = process.env.NEXT_PUBLIC_DERIV_APP_ID;
  if (!derivAppId) {
    console.error('[Deriv Callback] CRITICAL: Deriv App ID (NEXT_PUBLIC_DERIV_APP_ID) is not configured.');
    redirectUrl.searchParams.set('error', 'config_error_missing_deriv_app_id');
    return NextResponse.redirect(redirectUrl);
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
    redirectUrl.searchParams.set('error', 'deriv_auth_failed_no_token');
    return NextResponse.redirect(redirectUrl);
  }

  const firstToken = accounts[0].token;
  console.log(`[Deriv Callback] Attempting to authorize with token: ${firstToken.substring(0, 5)}... (token truncated for log)`);

  try {
    console.log(`[Deriv Callback] Connecting to WebSocket: wss://ws.derivws.com/websockets/v3?app_id=${derivAppId}`);

    console.log('[Deriv Callback] About to instantiate WebSocket...'); // <<< NEW LOG
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppId}`);
    console.log('[Deriv Callback] WebSocket instantiated successfully.'); // <<< NEW LOG

    const finalRedirectUrl = await new Promise<URL>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      const cleanupAndReject = (error: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
        reject(error);
      };

      ws.on('open', () => {
        console.log('[Deriv Callback] WebSocket connection opened.');
        const authMessage = JSON.stringify({ authorize: firstToken, req_id: 1 });
        console.log('[Deriv Callback] Sending authorize message:', authMessage);
        ws.send(authMessage);
      });

      ws.on('message', (data) => {
        const rawData = data.toString();
        console.log('[Deriv Callback] Received raw WebSocket message:', rawData);
        try {
          const response = JSON.parse(rawData) as DerivAuthorizeResponse; // Explicitly cast
          console.log('[Deriv Callback] Parsed WebSocket message:', response);

          if (response.error) {
            console.error('[Deriv Callback] Deriv API error in message:', response.error);
            cleanupAndReject(new Error(`Deriv API Error: ${response.error.message} (Code: ${response.error.code})`));
            return;
          }

          // Check if msg_type is present and is 'authorize', or if authorize object exists
          // Deriv's authorize response should contain the 'authorize' object on success.
          if (response.authorize) { // Removed check for response.msg_type === 'authorize'
            const derivUser = response.authorize;
            console.log('[Deriv Callback] Authorization successful. User data:', derivUser);

            const userId = derivUser.user_id;
            const email = derivUser.email;
            const name = derivUser.fullname || derivUser.loginid || 'Deriv User';

            if (!userId || !email) {
              console.error('[Deriv Callback] Missing essential user_id or email from Deriv response.');
              cleanupAndReject(new Error('Missing essential user_id or email from Deriv.'));
              return;
            }

            const successRedirect = new URL(baseRedirectPath, request.nextUrl.origin);
            successRedirect.searchParams.set('derivUserId', userId);
            successRedirect.searchParams.set('email', email);
            successRedirect.searchParams.set('name', name);
            successRedirect.searchParams.set('accessToken', firstToken);

            if (timeoutId) clearTimeout(timeoutId);
            ws.close(); // Close WebSocket on successful processing
            resolve(successRedirect);
          } else {
            console.warn('[Deriv Callback] Received message is not the expected authorize response or is missing authorize object:', response);
            // Not necessarily an error to reject immediately, could be other message types.
            // However, for this flow, we only expect 'authorize' or an error.
            // If it's not 'authorize' and not an 'error' message, it could lead to timeout.
            // Consider if other message types should be handled or ignored. For now, let it timeout if not authorize.
          }
        } catch (innerError) {
          console.error('[Deriv Callback] Error parsing WebSocket message JSON:', innerError, 'Raw data:', rawData);
          cleanupAndReject(innerError instanceof Error ? innerError : new Error('WebSocket message JSON parsing error'));
        }
      });

      ws.on('error', (err) => { // More specific error event from 'ws'
        console.error('[Deriv Callback] WebSocket error event (ws.on("error")):', err);
        cleanupAndReject(err); // err is an Error object
      });

      ws.on('unexpected-response', (req, res) => {
        console.error(`[Deriv Callback] WebSocket unexpected response. Status: ${res.statusCode}, Message: ${res.statusMessage}`);
        cleanupAndReject(new Error(`WebSocket unexpected response: ${res.statusCode}`));
      });

      ws.on('close', (code, reason) => {
        console.log(`[Deriv Callback] WebSocket connection closed. Code: ${code}, Reason: ${reason ? reason.toString() : 'No reason given'}`);
        // If the promise hasn't been settled by a message or error, this might indicate a premature close.
        // The timeout will eventually catch this if it wasn't an explicit cleanupAndReject call.
      });

      timeoutId = setTimeout(() => {
        console.warn('[Deriv Callback] WebSocket interaction timed out after', DERIV_API_TIMEOUT_MS, 'ms.');
        cleanupAndReject(new Error('Deriv API interaction timed out.'));
      }, DERIV_API_TIMEOUT_MS);
    });

    return NextResponse.redirect(finalRedirectUrl);

  } catch (error) {
    console.error('[Deriv Callback] Error in Deriv OAuth flow processing (outer catch):', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    redirectUrl.searchParams.set('error', encodeURIComponent(errorMessage));
    return NextResponse.redirect(redirectUrl);
  }
}