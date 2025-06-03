import { NextResponse } from 'next/server';
import WebSocket from 'ws';

// Remember to replace with your actual App ID, ideally from an environment variable
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${process.env.NEXT_PUBLIC_DERIV_APP_ID || 'YOUR_FALLBACK_APP_ID'}`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { derivAccessToken } = body;

    if (!derivAccessToken) {
      return NextResponse.json({ error: 'Deriv access token is required' }, { status: 400 });
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(DERIV_WS_URL);
      let responseSent = false;

      const timeoutId = setTimeout(() => {
        if (!responseSent) {
          console.error('[Deriv Authorize API] WebSocket request timed out');
          ws.close();
          // Resolve with NextResponse.json, not reject, as per Next.js API route patterns
          resolve(NextResponse.json({ error: 'Deriv API request timed out' }, { status: 504 }));
          responseSent = true;
        }
      }, 10000); // 10-second timeout

      ws.onopen = () => {
        console.log('[Deriv Authorize API] WebSocket connected, sending authorize request.');
        ws.send(JSON.stringify({ authorize: derivAccessToken }));
      };

      ws.onmessage = (event) => {
        if (responseSent) return; // Avoid processing if response already sent (e.g., by timeout)

        try {
          const response = JSON.parse(event.data.toString());
          console.log('[Deriv Authorize API] Received message from Deriv:', JSON.stringify(response, null, 2));

          if (response.error) {
            console.error('[Deriv Authorize API] Deriv API error:', response.error);
            clearTimeout(timeoutId); // Clear timeout as we got a response
            resolve(NextResponse.json({ error: response.error.message || 'Deriv API error' }, { status: response.error.code === 'InvalidToken' ? 401 : 400 }));
            responseSent = true;
          } else if (response.msg_type === 'authorize' && response.authorize) {
            clearTimeout(timeoutId); // Clear timeout as we got a successful response
            const { user_id, email, fullname, loginid } = response.authorize;

            const userIdToUse = user_id || loginid;

            if (!userIdToUse || !email) {
               console.error('[Deriv Authorize API] Missing user_id/loginid or email in Deriv response.');
               resolve(NextResponse.json({ error: 'Essential user details missing in Deriv response' }, { status: 500 }));
            } else {
               resolve(NextResponse.json({
                 derivUserId: String(userIdToUse),
                 email: email,
                 name: fullname || '',
               }));
            }
            responseSent = true;
          } else {
            // Handle other message types or unexpected responses if necessary
            // Potentially clear timeout here too if this is considered a "final" but unexpected response
            console.warn('[Deriv Authorize API] Received unexpected message type:', response.msg_type, ' Full response:', response);
            // Do not resolve here unless this is a definitive end state.
            // If more messages are expected, let the timeout handle it or add more specific logic.
          }
        } catch (e: any) {
          clearTimeout(timeoutId);
          console.error('[Deriv Authorize API] Error processing Deriv message:', e);
          resolve(NextResponse.json({ error: 'Failed to process Deriv response', details: e.message }, { status: 500 }));
          responseSent = true;
        } finally {
          // Close WebSocket only if a response has been sent and it's a terminal message (authorize or error)
          // If an unexpected message is received and more messages might follow, don't close yet.
          if (responseSent) {
            ws.close();
          }
        }
      };

      ws.onerror = (error) => {
        if (responseSent) return;
        clearTimeout(timeoutId);
        console.error('[Deriv Authorize API] WebSocket error:', error.message);
        resolve(NextResponse.json({ error: 'Deriv WebSocket connection error', details: error.message }, { status: 500 }));
        responseSent = true;
        // ws.close() will be called by onclose typically
      };

      ws.onclose = (event) => {
        clearTimeout(timeoutId);
        console.log('[Deriv Authorize API] WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
        if (!responseSent) {
          resolve(NextResponse.json({ error: 'WebSocket connection closed prematurely' }, { status: 500 }));
          responseSent = true;
        }
      };
    });

  } catch (error: any) {
    console.error('[Deriv Authorize API] Error in POST handler:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
