import { NextResponse } from 'next/server';
import WebSocket from 'ws';

const FALLBACK_APP_ID = 'YOUR_FALLBACK_APP_ID'; /**
 * Handles POST requests to authorize a user with the Deriv WebSocket API using an access token.
 *
 * Validates service configuration, parses the request body for a Deriv access token, and establishes a WebSocket connection to Deriv. Sends an authorization request and returns user details on success, or a structured error response on failure, timeout, or unexpected conditions.
 *
 * @param request - The incoming HTTP request containing a JSON body with a `derivAccessToken` field.
 * @returns A JSON response with the user's Deriv ID, email, and name on successful authorization, or a structured error object with an appropriate HTTP status code on failure.
 *
 * @remark Returns HTTP 500 if the Deriv App ID is missing or invalid, HTTP 400 for missing or invalid parameters, HTTP 504 for Deriv API timeouts, HTTP 401 for invalid tokens, and HTTP 500 for other errors or unexpected responses.
 */

export async function POST(request: Request) {
  const derivAppId = process.env.NEXT_PUBLIC_DERIV_APP_ID;

  if (!derivAppId || derivAppId === FALLBACK_APP_ID) {
    console.error('[Deriv Authorize API] Service configuration error: Deriv App ID not set or is fallback.');
    return NextResponse.json(
      { error: { message: 'Service configuration error: Deriv App ID not set.', code: 'CONFIG_ERROR' } },
      { status: 500 }
    );
  }

  const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${derivAppId}`;

  try {
    const body = await request.json();
    const { derivAccessToken } = body;

    if (!derivAccessToken) {
      return NextResponse.json(
        { error: { message: 'Deriv access token is required', code: 'MISSING_PARAM' } },
        { status: 400 }
      );
    }

    return new Promise((resolve) => {
      const ws = new WebSocket(DERIV_WS_URL);
      let responseSent = false;

      const timeoutId = setTimeout(() => {
        if (!responseSent) {
          console.error('[Deriv Authorize API] WebSocket request timed out');
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.terminate(); // Use terminate for forceful close on timeout
          } else {
            ws.close(); // Standard close if not connecting/open
          }
          resolve(NextResponse.json(
            { error: { message: 'Deriv API request timed out', code: 'DERIV_TIMEOUT' } },
            { status: 504 })
          );
          responseSent = true;
        }
      }, 10000); // 10-second timeout

      ws.onopen = () => {
        console.log('[Deriv Authorize API] WebSocket connected, sending authorize request.');
        ws.send(JSON.stringify({ authorize: derivAccessToken }));
      };

      ws.onmessage = (event) => {
        if (responseSent) return;

        try {
          const response = JSON.parse(event.data.toString());
          console.log('[Deriv Authorize API] Received message from Deriv:', JSON.stringify(response, null, 2));

          if (response.error) {
            clearTimeout(timeoutId);
            console.error('[Deriv Authorize API] Deriv API error:', response.error);
            resolve(NextResponse.json(
              { error: { message: response.error.message || 'Deriv API error', code: response.error.code || 'DERIV_API_ERROR' } },
              { status: response.error.code === 'InvalidToken' ? 401 : 400 }
            ));
            responseSent = true;
          } else if (response.msg_type === 'authorize' && response.authorize) {
            clearTimeout(timeoutId);
            const { user_id, email, fullname, loginid } = response.authorize;

            // TODO: Confirm with Deriv documentation if user_id is always present and the preferred unique identifier
            // for a user account, vs. loginid which might be specific to a trading account instance.
            // For providerAccountId, a stable, unique user identifier is essential.
            const userIdToUse = user_id || loginid;

            if (!userIdToUse || !email) {
               console.error('[Deriv Authorize API] Missing user_id/loginid or email in Deriv response.');
               resolve(NextResponse.json(
                 { error: { message: 'Essential user details missing in Deriv response', code: 'DERIV_DATA_INCOMPLETE' } },
                 { status: 500 }
               ));
            } else {
               resolve(NextResponse.json({
                 derivUserId: String(userIdToUse),
                 email: email,
                 name: fullname || '',
               }));
            }
            responseSent = true;
          } else {
            clearTimeout(timeoutId);
            console.warn('[Deriv Authorize API] Received unexpected message type:', response.msg_type, ' Full response:', response);
            resolve(NextResponse.json(
              { error: { message: 'Received unexpected response from Deriv', code: 'DERIV_UNEXPECTED_MESSAGE' } },
              { status: 500 }
            ));
            responseSent = true;
          }
        } catch (e: any) {
          clearTimeout(timeoutId);
          console.error('[Deriv Authorize API] Error processing Deriv message:', e);
          resolve(NextResponse.json(
            { error: { message: 'Failed to process Deriv response', details: e.message, code: 'PROCESSING_ERROR' } },
            { status: 500 }
          ));
          responseSent = true;
        } finally {
          if (responseSent) {
            ws.close();
          }
        }
      };

      ws.onerror = (error) => {
        if (responseSent) return;
        clearTimeout(timeoutId);
        console.error('[Deriv Authorize API] WebSocket error:', error.message);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.terminate(); // Forcefully close if an error occurs during an open/connecting state
        }
        resolve(NextResponse.json(
          { error: { message: 'Deriv WebSocket connection error', details: error.message, code: 'WEBSOCKET_ERROR' } },
          { status: 500 }
        ));
        responseSent = true;
      };

      ws.onclose = (event) => {
        clearTimeout(timeoutId);
        console.log('[Deriv Authorize API] WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
        if (!responseSent) {
          resolve(NextResponse.json(
            { error: { message: 'WebSocket connection closed prematurely', code: 'WEBSOCKET_CLOSED' } },
            { status: 500 }
          ));
          responseSent = true;
        }
      };
    });

  } catch (error: any) {
    console.error('[Deriv Authorize API] Error in POST handler:', error);
    // Check if error is due to JSON parsing of request body
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
       return NextResponse.json(
        { error: { message: 'Invalid JSON in request body', code: 'INVALID_JSON_BODY' } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { message: 'Internal server error', details: error.message, code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
