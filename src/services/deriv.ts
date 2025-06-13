// IMPORTANT: Deriv API Service
// This service requires the following environment variables to be set:
// 1. NEXT_PUBLIC_DERIV_WS_URL: The base WebSocket URL for the Deriv API (e.g., wss://ws.derivws.com/websockets/v3).
// 2. NEXT_PUBLIC_DERIV_APP_ID: Your specific Deriv application ID.
// The application will fail to start if these are not correctly configured.

// import WebSocket from 'ws'; // Removed: 'ws' is for Node.js, browser has native WebSocket
// Types import - ensuring CandleData is recognized
import type { InstrumentType, PriceTick, CandleData } from '@/types';
import { getInstrumentDecimalPlaces } from '@/lib/utils';

console.log('[DerivService Client-Side Check] Initial process.env.NEXT_PUBLIC_DERIV_WS_URL:', process.env.NEXT_PUBLIC_DERIV_WS_URL);
console.log('[DerivService Client-Side Check] Initial process.env.NEXT_PUBLIC_DERIV_APP_ID:', process.env.NEXT_PUBLIC_DERIV_APP_ID);

const NEXT_PUBLIC_DERIV_WS_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL;
const NEXT_PUBLIC_DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID;

if (!NEXT_PUBLIC_DERIV_WS_URL) {
  throw new Error("NEXT_PUBLIC_DERIV_WS_URL environment variable is not set.");
}
if (!NEXT_PUBLIC_DERIV_APP_ID) {
  throw new Error("NEXT_PUBLIC_DERIV_APP_ID environment variable is not set.");
}

const DERIV_API_URL = `${NEXT_PUBLIC_DERIV_WS_URL}?app_id=${NEXT_PUBLIC_DERIV_APP_ID}`;
console.log('[DerivService Client-Side Check] Constructed DERIV_API_URL at module scope:', DERIV_API_URL);
const DERIV_API_TOKEN = process.env.NEXT_PUBLIC_DERIV_API_TOKEN_DEMO; // Example: using a demo token

// Define the instrument map
const DERIV_INSTRUMENT_MAP: Partial<Record<InstrumentType, string>> = {
  'Volatility 10 Index': 'R_10',
  'Volatility 25 Index': 'R_25',
  'Volatility 50 Index': 'R_50',
  'Volatility 75 Index': 'R_75',
  'Volatility 100 Index': 'R_100',
  // Forex, Crypto, Commodities usually use their direct symbols, but map if needed
  'EUR/USD': 'frxEURUSD',
  'GBP/USD': 'frxGBPUSD',
  'BTC/USD': 'cryBTCUSD',
  // Add other mappings as necessary
};

// Define formatTickTime function
const formatTickTime = (epoch: number): string => {
  return new Date(epoch * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

/**
 * Represents a tick data point for a financial instrument.
 */
export interface Tick {
  /**
   * The epoch timestamp (in seconds) of the tick.
   */
  epoch: number;
  /**
   * The price of the instrument at the time of the tick.
   */
  price: number;
  /**
   * Formatted time string for display on the chart.
   */
  time: string;
}

/**
 * Maps user-friendly instrument names to Deriv API symbols.
 */
export const instrumentToDerivSymbol = (instrument: InstrumentType): string => {
  switch (instrument) {
    case 'EUR/USD':
      return 'frxEURUSD';
    case 'GBP/USD':
      return 'frxGBPUSD';
    case 'BTC/USD':
      return 'cryBTCUSD';
    case 'XAU/USD':
      return 'frxXAUUSD'; // Gold vs USD
    case 'ETH/USD':
      return 'cryETHUSD'; // Ethereum vs USD
    case 'Palladium/USD':
      return 'frxXPDUSD';
    case 'Platinum/USD':
      return 'frxXPTUSD';
    case 'Silver/USD':
      return 'frxXAGUSD';
    case 'Volatility 10 Index':
      return 'R_10';
    case 'Volatility 25 Index':
      return 'R_25';
    case 'Volatility 50 Index':
      return 'R_50';
    case 'Volatility 75 Index':
      return 'R_75';
    case 'Volatility 100 Index':
      return 'R_100';
    default:
      // This case handles any string that wasn't explicitly matched.
      // It might be an instrument symbol not yet in TradingInstrument type,
      // or an unexpected value. Defaulting to a common Volatility Index or logging error.
      console.warn(`[instrumentToDerivSymbol] Unknown instrument symbol: ${instrument}. Defaulting to R_100. Consider adding it to TradingInstrument type and DERIV_INSTRUMENT_MAP if valid.`);
      // const exhaustiveCheck: never = instrument; // This will error if instrument is not 'never', which it isn't here.
      return 'R_100'; // Fallback to a common Volatility Index
  }
};

/**
 * Fetches historical candle data for a given instrument from Deriv API.
 * @param instrument The trading instrument.
 * @param count Number of candles to fetch (default 120).
 * @param granularity Seconds per candle (default 60 for 1-minute candles).
 * @returns A promise that resolves to an array of CandleData.
 */
export async function getCandles(
  instrument: InstrumentType,
  count: number = 120,
  granularity: number = 60,
  token?: string // Optional token parameter
): Promise<CandleData[]> {
  // console.log('[DerivService/getCandles Client-Side Check] process.env.NEXT_PUBLIC_DERIV_WS_URL inside getCandles:', process.env.NEXT_PUBLIC_DERIV_WS_URL);
  // console.log('[DerivService/getCandles Client-Side Check] process.env.NEXT_PUBLIC_DERIV_APP_ID inside getCandles:', process.env.NEXT_PUBLIC_DERIV_APP_ID);
  // console.log('[DerivService/getCandles Client-Side Check] DERIV_API_URL inside getCandles:', DERIV_API_URL);
  // Get the correct symbol for the Deriv API
  const symbol = instrumentToDerivSymbol(instrument);
  const decimalPlaces = getInstrumentDecimalPlaces(instrument);

  const ws = new WebSocket(DERIV_API_URL);

  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      let authorized = false;
      if (token) {
        console.log('[DerivService/getCandles] Authorizing with provided token.');
        ws.send(JSON.stringify({ authorize: token }));
        authorized = true;
      } else if (DERIV_API_TOKEN) { // Fallback to global demo token if no specific token provided
        console.log('[DerivService/getCandles] Authorizing with global DERIV_API_TOKEN.');
        ws.send(JSON.stringify({ authorize: DERIV_API_TOKEN }));
        authorized = true;
      } else {
        console.log('[DerivService/getCandles] No token provided, proceeding without explicit authorization for candles.');
      }

      // Wait a short moment after authorization attempt before sending the ticks request
      // or send immediately if no authorization was attempted.
      setTimeout(() => {
        const request = {
          ticks_history: symbol,
          adjust_start_time: 1,
          count: count,
          end: 'latest',
          start: 1,
          style: 'candles',
          granularity: granularity,
        };
        
        console.log('[DerivService/getCandles] Sending request:', request);
        ws.send(JSON.stringify(request));
      }, authorized ? 500 : 0); // Reduced delay if authorized, 0 if not.
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        // console.log('[DerivService/getCandles] Received response:', response); // Verbose, can be enabled for debug
        
        if (response.error) {
          console.error('[DerivService/getCandles] API Error:', response.error);
          reject(new Error(response.error.message || 'Unknown API error'));
          ws.close();
          return;
        }
        
        if (response.msg_type === 'candles') {
          const candles: CandleData[] = (response.candles || []).map((candle: any) => ({
            time: formatTickTime(candle.epoch), // Ensure formatTickTime is defined
            epoch: candle.epoch,
            open: parseFloat(candle.open.toFixed(decimalPlaces)),
            high: parseFloat(candle.high.toFixed(decimalPlaces)),
            low: parseFloat(candle.low.toFixed(decimalPlaces)),
            close: parseFloat(candle.close.toFixed(decimalPlaces)),
          }));
          resolve(candles.slice(-count)); // Ensure only requested count is resolved
          ws.close();
        } else if (response.msg_type === 'authorize') {
          if (response.error) {
            console.error('[DerivService/getCandles] Authorization Error:', response.error);
            // Don't necessarily reject here, as candle data might still be public for some symbols.
            // The ticks_history request will be sent after the timeout.
            // If ticks_history fails due to auth, its own error handling will trigger.
          } else {
            console.log('[DerivService/getCandles] Authorization successful/response received.');
          }
          // The main logic for sending ticks_history is in the setTimeout after onopen.
        } else if (response.msg_type === 'tick_history') { // Alternative response type for ticks_history
             console.warn('[DerivService/getCandles] Received tick_history instead of candles. This might indicate an issue or different API version for the symbol.');
             // Attempt to process if structure is similar or known, otherwise reject or handle as error.
             // For now, let's assume it might be an error in expectation for 'candles' style.
             reject(new Error("Received 'tick_history' msg_type when 'candles' was expected."));
             ws.close();
        }
      } catch (e) {
        console.error('[DerivService/getCandles] Error processing message:', e);
        reject(e);
        ws.close();
      }
    };

    ws.onerror = (event) => {
      let errorMessage = 'WebSocket error fetching candles.';
      // Attempt to get more details from the event
      if (event && typeof event === 'object') {
        // For a standard ErrorEvent, `message` might be available.
        // For a generic Event from WebSocket, it might not have a direct 'message'.
        // We can log the type or stringify it.
        // Browsers usually log the Event object well, but in Node.js or some environments it might be just '{}'.
        // The console.error below will show the object, this is for the rejected Error.
        if ('message' in event && (event as any).message) {
            errorMessage = `WebSocket Error: ${(event as any).message}`;
        } else {
            errorMessage = `WebSocket Error: type=${event.type}. Check browser console for the full event object.`;
        }
      }
      console.error('[DerivService/getCandles] WebSocket Error Event:', event); // Log the full event object
      reject(new Error(errorMessage)); // Reject with a more informative message
        ws.close();
    };

    ws.onclose = (event) => {
      console.log('[DerivService/getCandles] WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
    };
  });
}

function parseDurationToMinutes(durationString: string): number {
  if (!durationString || typeof durationString !== 'string') {
    return 0;
  }
  const match = durationString.match(/^(\d+)([smhd])$/);
  if (!match) {
    console.warn(`[DerivService/parseDurationToMinutes] Invalid duration string format: ${durationString}`);
    return 0;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return Math.ceil(value / 60); // Treat seconds by rounding up to the nearest minute for step generation
    case 'm':
      return value;
    case 'h':
      return value * 60;
    case 'd':
      return value * 24 * 60;
    default:
      return 0;
  }
}

function formatMinutesToDurationString(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  } else if (minutes < 24 * 60) {
    if (minutes % 60 === 0) {
      return `${minutes / 60}h`;
    }
    return `${minutes}m`; // Or handle as hours and minutes e.g. "1h 30m" - simplified for now
  } else {
    if (minutes % (24 * 60) === 0) {
      return `${minutes / (24 * 60)}d`;
    }
    return `${minutes}m`; // Or handle as days and hours/minutes - simplified for now
  }
}

function generateDurationSteps(minMinutes: number, maxMinutes: number): string[] {
  const stepsInMinutes = [
    1, 2, 3, 5, 10, 15, 30, 45,
    60, // 1h
    120, // 2h
    180, // 3h
    240, // 4h
    360, // 6h
    480, // 8h
    720, // 12h
    1440, // 1d
    2 * 1440, // 2d
    // Add more steps if needed, e.g., for weekly options
  ];

  const durations = new Set<string>();

  // Add the precise min and max durations if they are valid
  if (minMinutes > 0) durations.add(formatMinutesToDurationString(minMinutes));
  if (maxMinutes > 0 && maxMinutes !== minMinutes) durations.add(formatMinutesToDurationString(maxMinutes));

  stepsInMinutes.forEach(step => {
    if (step >= minMinutes && step <= maxMinutes) {
      durations.add(formatMinutesToDurationString(step));
    }
  });

  // Sort numerically then by unit (simple sort for now)
  return Array.from(durations).sort((a, b) => parseDurationToMinutes(a) - parseDurationToMinutes(b));
}


/**
 * Fetches available trading durations for a given instrument symbol from Deriv API.
 * @param instrumentSymbol The Deriv API symbol for the instrument (e.g., "R_100", "frxEURUSD").
 * @param token Optional Deriv API token for authorization if required for the specific symbol or account.
 * @returns A promise that resolves to an array of unique duration strings (e.g., ["1m", "5m", "30s"]).
 */
export async function getTradingDurations(instrumentSymbol: string, token?: string): Promise<string[]> {
  const ws = new WebSocket(DERIV_API_URL);
  const timeoutDuration = 10000; // 10 seconds for the operation

  return new Promise((resolve, reject) => {
    let operationTimeout = setTimeout(() => {
      console.error('[DerivService/getTradingDurations] Operation timed out.');
      ws.close();
      reject(new Error('Fetching trading durations timed out.'));
    }, timeoutDuration);

    ws.onopen = () => {
      console.log('[DerivService/getTradingDurations] WebSocket connection opened.');
      if (token) {
        console.log('[DerivService/getTradingDurations] Authorizing...');
        ws.send(JSON.stringify({ authorize: token }));
      } else {
        console.log('[DerivService/getTradingDurations] Sending contracts_for request without prior authorization.');
        ws.send(JSON.stringify({
          contracts_for: instrumentSymbol,
          currency: "USD",
          product_type: "basic"
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        console.log('[DerivService/getTradingDurations] Received API response:', response.msg_type);

        const symbolsToLog = ['frxEURUSD', 'frxGBPUSD', 'cryBTCUSD', 'cryETHUSD', 'frxXAUUSD', 'frxXPDUSD', 'frxXPTUSD', 'frxXAGUSD'];
        if (instrumentSymbol.startsWith('frx') || symbolsToLog.includes(instrumentSymbol) || instrumentSymbol.toLowerCase().includes('gold') || instrumentSymbol.toLowerCase().includes('silver') || instrumentSymbol.toLowerCase().includes('palladium') || instrumentSymbol.toLowerCase().includes('platinum')) {
          console.log(`[DerivService/getTradingDurations] RAW contracts_for response for ${instrumentSymbol}:`, JSON.stringify(response, null, 2));
        }

        if (response.error) {
          console.error('[DerivService/getTradingDurations] API Error:', response.error);
          clearTimeout(operationTimeout);
          ws.close();
          reject(new Error(response.error.message || 'Unknown API error fetching trading durations.'));
          return;
        }

        if (response.msg_type === 'authorize') {
          if (response.authorize?.loginid) {
            console.log('[DerivService/getTradingDurations] Authorization successful. Sending contracts_for request...');
            ws.send(JSON.stringify({
              contracts_for: instrumentSymbol,
              currency: "USD",
              product_type: "basic"
            }));
          } else {
            console.error('[DerivService/getTradingDurations] Authorization failed:', response);
            clearTimeout(operationTimeout);
            ws.close();
            reject(new Error('Authorization failed for fetching trading durations.'));
          }
        } else if (response.msg_type === 'contracts_for') {
          clearTimeout(operationTimeout);
          const foundDurations = new Set<string>();

          if (response.contracts_for && Array.isArray(response.contracts_for.available)) {
            response.contracts_for.available.forEach((contract: any) => {
              if (
                contract.contract_category === 'callput' &&
                contract.start_type === 'spot' &&
                contract.expiry_type === 'intraday' && // Focus on intraday Rise/Fall
                contract.min_contract_duration &&
                contract.max_contract_duration
              ) {
                const minMinutes = parseDurationToMinutes(contract.min_contract_duration);
                const maxMinutes = parseDurationToMinutes(contract.max_contract_duration);

                if (minMinutes > 0 && maxMinutes > 0 && maxMinutes >= minMinutes) {
                  const steps = generateDurationSteps(minMinutes, maxMinutes);
                  steps.forEach(step => foundDurations.add(step));
                  // For simplicity, we'll take the first valid contract type's range.
                  // If multiple callput/spot/intraday contracts exist, their ranges might differ.
                  // This could be expanded to merge or select the most appropriate range.
                  // For now, if we found one, we can break or just let the Set handle uniqueness.
                }
              }
            });
          }

          if (foundDurations.size === 0) {
             console.warn(`[DerivService/getTradingDurations] No 'callput/spot/intraday' durations found for ${instrumentSymbol}. Returning empty array.`);
             resolve([]);
          } else {
            console.log(`[DerivService/getTradingDurations] Extracted durations for ${instrumentSymbol}:`, Array.from(foundDurations));
            resolve(Array.from(foundDurations));
          }
          ws.close();
        }
      } catch (e) {
        console.error('[DerivService/getTradingDurations] Error processing message:', e);
        clearTimeout(operationTimeout);
        ws.close();
        reject(e instanceof Error ? e : new Error('Failed to process message for trading durations.'));
      }
    };

    ws.onerror = (event) => {
      let errorMessage = 'WebSocket error fetching trading durations.';
      if (event && typeof event === 'object') {
        if ('message' in event && (event as any).message) {
            errorMessage = `WebSocket Error: ${(event as any).message}`;
        } else {
            errorMessage = `WebSocket Error: type=${event.type}. Check console.`;
        }
      }
      console.error('[DerivService/getTradingDurations] WebSocket Error Event:', event);
      clearTimeout(operationTimeout);
      ws.close();
      reject(new Error(errorMessage));
    };

    ws.onclose = (event) => {
      console.log('[DerivService/getTradingDurations] WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
      clearTimeout(operationTimeout);
    };
  });
}

/**
 * Authorizes with the Deriv API using a given token.
 * @param token The Deriv API token.
 * @returns The authorization response.
 */
export async function authorizeDeriv(token: string): Promise<any> {
  const ws = new WebSocket(DERIV_API_URL);
  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log('[DerivService/authorizeDeriv] Sending authorize request.');
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        console.log('[DerivService/authorizeDeriv] Received response:', response);
        if (response.error) {
          console.error('[DerivService/authorizeDeriv] API Error:', response.error);
          reject(new Error(response.error.message || 'Authorization failed'));
        } else if (response.msg_type === 'authorize') {
          resolve(response);
        }
      } catch (e) {
        console.error('[DerivService/authorizeDeriv] Error processing message:', e);
        reject(e);
      } finally {
        ws.close();
      }
    };

    ws.onerror = (event) => {
      console.error('[DerivService/authorizeDeriv] WebSocket Error:', event);
      reject(new Error('WebSocket error during authorization'));
      ws.close();
    };
  });
}

/**
 * Fetches the list of accounts for the authorized user from Deriv API.
 * @param token The Deriv API token.
 * @returns The account_list response.
 */
export async function getDerivAccountList(token: string): Promise<any> {
  const functionStartTime = Date.now();
  console.log(`[DerivService/getDerivAccountList] Starting at ${new Date(functionStartTime).toISOString()}. Token: ${token ? token.substring(0, 5) + '...' : 'N/A'}`);

  const operationTimeout = 10000; // 10 seconds
  let timeoutId: NodeJS.Timeout;
  let ws: WebSocket | null = null; // Declare ws here to make it accessible in timeout and cleanup
  let connectedTime: number | null = null;
  let requestSentTime: number | null = null;

  const cleanup = (message: string, isError: boolean = false) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (ws) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        console.log(`[DerivService/getDerivAccountList] cleanup: Closing WebSocket (readyState: ${ws.readyState}). ${message}`);
        ws.close();
      } else {
        console.log(`[DerivService/getDerivAccountList] cleanup: WebSocket already closed or closing (readyState: ${ws.readyState}). ${message}`);
      }
    }
    const duration = Date.now() - functionStartTime;
    console.log(`[DerivService/getDerivAccountList] Finished. Duration: ${duration}ms. ${message}`);
    if (isError) {
        // console.error is already called by the specific error handlers typically
    }
  };

  return Promise.race([
    new Promise((resolve, reject) => {
      ws = new WebSocket(DERIV_API_URL);
      console.log(`[DerivService/getDerivAccountList] WebSocket instance created. URL: ${DERIV_API_URL}`);

      ws.onopen = () => {
        connectedTime = Date.now();
        const timeToConnect = connectedTime - functionStartTime;
        console.log(`[DerivService/getDerivAccountList] WebSocket connection opened at ${new Date(connectedTime).toISOString()}. Time to connect: ${timeToConnect}ms.`);

        console.log('[DerivService/getDerivAccountList] Authorizing...');
        ws!.send(JSON.stringify({ authorize: token }));
        // No explicit timeout here for auth, rely on overall operationTimeout.
        // Account list request will be sent on 'authorize' success or if no auth error for public data.
      };

      ws.onmessage = (event) => {
        const messageReceivedTime = Date.now();
        console.log(`[DerivService/getDerivAccountList] Message received at ${new Date(messageReceivedTime).toISOString()}.`);
        try {
          const response = JSON.parse(event.data as string);
          console.log('[DerivService/getDerivAccountList] Parsed response:', JSON.stringify(response, null, 2));

          if (response.error) {
            console.error(`[DerivService/getDerivAccountList] API Error: ${response.error.message}`, response.error);
            cleanup(`API Error: ${response.error.message}`, true);
            reject(new Error(response.error.message || 'Failed to process request due to API error'));
            return;
          }

          if (response.msg_type === 'authorize') {
            if (response.authorize) {
              console.log('[DerivService/getDerivAccountList] Authorization successful.');
              requestSentTime = Date.now();
              console.log(`[DerivService/getDerivAccountList] Sending account_list request at ${new Date(requestSentTime).toISOString()}.`);
              ws!.send(JSON.stringify({ account_list: 1 }));
            } else {
              // This case might not happen if error object is always present for auth failures
              console.error('[DerivService/getDerivAccountList] Authorization failed, response did not contain expected authorize object:', response);
              cleanup('Authorization failed.', true);
              reject(new Error('Authorization failed.'));
            }
          } else if (response.msg_type === 'account_list') {
            const timeToAccountList = requestSentTime ? messageReceivedTime - requestSentTime : messageReceivedTime - (connectedTime || functionStartTime);
            console.log(`[DerivService/getDerivAccountList] Account list received. Time from request/connect: ${timeToAccountList}ms.`);
            cleanup('Account list received successfully.');
            resolve(response);
          } else {
            console.log(`[DerivService/getDerivAccountList] Received other message type: ${response.msg_type}`);
            // Potentially handle other message types or ignore
          }
        } catch (e) {
          const errorTime = Date.now();
          console.error(`[DerivService/getDerivAccountList] Error processing message at ${new Date(errorTime).toISOString()}:`, e);
          cleanup('Error processing message.', true);
          reject(e instanceof Error ? e : new Error('Failed to process message for account list.'));
        }
      };

      ws.onerror = (event) => {
        const errorTime = Date.now();
        // Try to get more details from the event
        let errorMessage = 'WebSocket error during account list fetch.';
        if (event && typeof event === 'object') {
            if ('message' in event && (event as any).message) {
                errorMessage = `WebSocket Error: ${(event as any).message}`;
            } else {
                errorMessage = `WebSocket Error: type=${event.type}. Check browser console for the full event object.`;
            }
        }
        console.error(`[DerivService/getDerivAccountList] WebSocket Error Event at ${new Date(errorTime).toISOString()}: ${errorMessage}`, event);
        cleanup(`WebSocket error: ${errorMessage}`, true);
        reject(new Error(errorMessage));
      };

      ws.onclose = (event) => {
        const closeTime = Date.now();
        console.log(`[DerivService/getDerivAccountList] WebSocket connection closed at ${new Date(closeTime).toISOString()}. Code: ${event.code}, Reason: ${event.reason}, WasClean: ${event.wasClean}`);
        // If the promise hasn't been settled by an explicit resolve/reject (e.g. from onmessage or onerror)
        // or by the timeout, this means an unexpected closure.
        // We check if it's already being cleaned up to avoid redundant rejections.
        // This check might be tricky; relying on timeout to eventually reject if no other resolution.
        // For now, the cleanup function handles clearing timeout. If it's an unexpected close,
        // and no data received, the main promise might still be pending until timeout.
        // Consider rejecting here if !event.wasClean and no account_list received.
        // However, the timeout is the primary mechanism for unresolved promises.
        cleanup(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
        // Do not reject here if cleanup is already called by resolve/reject, to prevent "already settled" errors.
        // The timeout or specific handlers should be responsible for rejection.
      };
    }),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const timeoutTime = Date.now();
        const errorMessage = `Deriv API call for account list timed out after ${operationTimeout / 1000} seconds.`;
        console.error(`[DerivService/getDerivAccountList] Operation timed out at ${new Date(timeoutTime).toISOString()}.`);

        // Attempt to close WebSocket if it exists and is open
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          console.log('[DerivService/getDerivAccountList] Timeout: Attempting to close WebSocket.');
          ws.close(1000, "Operation timed out"); // 1000 is a normal closure
        }
        // Cleanup will be called by the main promise's onclose or onerror eventually if ws.close() triggers them,
        // but we ensure resources tied to this specific operation (like this timeout) are cleared.
        // Directly call cleanup for timeout specific logging and ensure rejection.
        cleanup(errorMessage, true); // Ensure cleanup logs reflect timeout
        reject(new Error(errorMessage));
      }, operationTimeout);
    })
  ]);
}

/**
 * Fetches the balance for a specific Deriv account.
 * @param token The Deriv API token.
 * @param accountId The loginid of the Deriv account for which to fetch the balance.
 * @returns A promise that resolves to an object containing the balance, currency, and loginid.
 */
export async function getDerivAccountBalance(token: string, accountId: string): Promise<{ balance: number, currency: string, loginid: string }> {
  const operationTimeout = 12000; // 12 seconds, slightly longer for auth + account_switch + balance
  let timeoutId: NodeJS.Timeout;
  let ws: WebSocket | null = null; // Initialize ws to null

  const startTime = Date.now();
  console.log(`[DerivService/getDerivAccountBalance] Initiated for accountId: ${accountId} at ${new Date(startTime).toISOString()}`);

  // This promise encapsulates the WebSocket logic
  const promiseLogic = new Promise<{ balance: number, currency: string, loginid: string }>((resolve, reject) => {
    ws = new WebSocket(DERIV_API_URL);

    const cleanupAndLog = (logMessage: string, isError: boolean = false, wsToClose: WebSocket | null = ws) => {
      if (timeoutId) clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      const fullLogMessage = `[DerivService/getDerivAccountBalance] AccountID: ${accountId}. ${logMessage}. Duration: ${duration}ms.`;
      if (isError) console.error(fullLogMessage);
      else console.log(fullLogMessage);

      if (wsToClose && wsToClose.readyState !== WebSocket.CLOSED && wsToClose.readyState !== WebSocket.CLOSING) {
        console.log(`[DerivService/getDerivAccountBalance] Closing WebSocket for accountId: ${accountId}. Original log: ${logMessage}`);
        wsToClose.close(1000, logMessage.substring(0, 100)); // Normal closure, reason limited
      }
    };

    ws.onopen = () => {
      const openTime = Date.now();
      console.log(`[DerivService/getDerivAccountBalance] WebSocket opened for accountId: ${accountId} at ${new Date(openTime).toISOString()}. Time to open: ${openTime - startTime}ms.`);
      console.log(`[DerivService/getDerivAccountBalance] Sending authorize request for accountId: ${accountId}.`);
      ws!.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (event) => {
      const messageTime = Date.now();
      try {
        const response = JSON.parse(event.data as string);

        if (response.error) {
          cleanupAndLog(`API Error: ${response.error.message}`, true);
          reject(new Error(response.error.message || `Deriv API error for account ${accountId}`));
          return;
        }

        if (response.msg_type === 'authorize') {
          if (response.authorize?.loginid) {
            const currentActiveAccountId = response.authorize.loginid;
            console.log(`[DerivService/getDerivAccountBalance] Authorization successful for initial token. User: ${currentActiveAccountId}. Target accountId for balance: ${accountId}.`);
            if (currentActiveAccountId === accountId) {
              console.log(`[DerivService/getDerivAccountBalance] Account ${accountId} is already active. Skipping account_switch. Sending balance request.`);
              ws!.send(JSON.stringify({ balance: 1, subscribe: 0 }));
            } else {
              console.log(`[DerivService/getDerivAccountBalance] Current active account ${currentActiveAccountId} is different from target ${accountId}. Attempting to switch.`);
              ws!.send(JSON.stringify({ account_switch: accountId }));
            }
          } else {
            cleanupAndLog('Authorization failed. Response did not contain expected authorize object.', true);
            reject(new Error(`Deriv authorization failed for account ${accountId}.`));
          }
        } else if (response.msg_type === 'account_switch') {
          if (response.error) {
            cleanupAndLog(`Error switching to account ${accountId}: ${response.error.message}`, true);
            reject(new Error(response.error.message || `Failed to switch to Deriv account ${accountId}.`));
            return;
          }

          let switchedCorrectly = false;
          const switchedToLoginId = response.account_switch?.current_loginid || response.account_switch?.loginid;
          if (response.echo_req && response.echo_req.account_switch === accountId) {
              switchedCorrectly = true;
          } else if (switchedToLoginId === accountId) {
              switchedCorrectly = true;
          }

          if (switchedCorrectly) {
              console.log(`[DerivService/getDerivAccountBalance] Successfully switched to account: ${accountId}. Sending balance request.`);
              ws!.send(JSON.stringify({ balance: 1, subscribe: 0 }));
          } else {
              cleanupAndLog(`Failed to switch to account ${accountId}. Expected ${accountId} but response indicates active account is ${switchedToLoginId || 'unknown'}. Full response: ${JSON.stringify(response)}`, true);
              reject(new Error(`Failed to confirm switch to Deriv account ${accountId}. Active account is ${switchedToLoginId || 'unknown'}.`));
          }

        } else if (response.msg_type === 'balance') {
          console.log(`[DerivService/getDerivAccountBalance] Balance response received for ${accountId}.`);
          let targetAccountData;
          if (response.balance?.loginid === accountId) {
              targetAccountData = response.balance;
              console.log(`[DerivService/getDerivAccountBalance] Using main balance object for ${accountId} as it matches the active/switched account.`);
          }

          if (targetAccountData && targetAccountData.loginid === accountId) {
            const result = {
              balance: parseFloat(targetAccountData.balance),
              currency: targetAccountData.currency,
              loginid: targetAccountData.loginid,
            };
            cleanupAndLog(`Balance successfully retrieved for ${accountId}.`);
            resolve(result);
          } else {
            const loginIdInResponse = response.balance?.loginid || 'N/A';
            cleanupAndLog(`Account ${accountId} not found or mismatch in balance response. Expected ${accountId}, got ${loginIdInResponse}. Full response: ${JSON.stringify(response)}`, true);
            reject(new Error(`Account ${accountId} balance not found or mismatch in Deriv balance response. Expected ${accountId}, got ${loginIdInResponse}.`));
          }
        } else {
          console.log(`[DerivService/getDerivAccountBalance] Received other message type for ${accountId}: ${response.msg_type}`, response);
        }
      } catch (e: any) {
        cleanupAndLog(`Error processing message: ${e?.message || String(e)}`, true);
        reject(e instanceof Error ? e : new Error('Failed to process message for balance.'));
      }
    };

    ws.onerror = (event) => {
      let errorMessage = 'WebSocket error during balance fetch.';
       if (event && typeof event === 'object') {
          if ('message' in event && (event as any).message) {
              errorMessage = `WebSocket Error: ${(event as any).message}`;
          } else {
              errorMessage = `WebSocket Error: type=${event.type}. Check browser console for the full event object.`;
          }
      }
      cleanupAndLog(`WebSocket Error: ${errorMessage}`, true);
      reject(new Error(errorMessage));
    };

    ws.onclose = (event) => {
      const duration = Date.now() - startTime;
      console.log(`[DerivService/getDerivAccountBalance] WebSocket connection closed for accountId: ${accountId}. Code: ${event.code}, Reason: ${event.reason}, WasClean: ${event.wasClean}. Duration: ${duration}ms.`);
      if (timeoutId) clearTimeout(timeoutId);
    };
  });

  return Promise.race([
    promiseLogic,
    new Promise<{ balance: number, currency: string, loginid: string }>((_, reject) => {
      timeoutId = setTimeout(() => {
        const reason = `Operation timed out after ${operationTimeout / 1000} seconds for accountId: ${accountId}.`;
        console.error(`[DerivService/getDerivAccountBalance] Timeout: ${reason}`);
        if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
          console.log(`[DerivService/getDerivAccountBalance] Timeout: Attempting to close WebSocket for accountId: ${accountId}.`);
          ws.close(1000, "Operation timed out");
        } else if (!ws) {
           console.log(`[DerivService/getDerivAccountBalance] Timeout: WebSocket instance was null for accountId: ${accountId}.`);
        }
        reject(new Error(reason));
      }, operationTimeout);
    })
  ]);
}


/**
 * Fetches user settings from Deriv API for the authorized user.
 * @param token The Deriv API token.
 * @returns The get_settings response.
 */
export async function getDerivAccountSettings(token: string): Promise<any> {
  const ws = new WebSocket(DERIV_API_URL);
  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log('[DerivService/getDerivAccountSettings] Sending get_settings request.');
      ws.send(JSON.stringify({ authorize: token })); // Authorize first
      setTimeout(() => {
        ws.send(JSON.stringify({ get_settings: 1 }));
      }, 500); // Small delay after authorization
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        console.log('[DerivService/getDerivAccountSettings] Received response:', response);
        if (response.error) {
          console.error('[DerivService/getDerivAccountSettings] API Error:', response.error);
          reject(new Error(response.error.message || 'Failed to get account settings'));
        } else if (response.msg_type === 'get_settings') {
          resolve(response);
        }
      } catch (e) {
        console.error('[DerivService/getDerivAccountSettings] Error processing message:', e);
        reject(e);
      } finally {
        ws.close();
      }
    };

    ws.onerror = (event) => {
      console.error('[DerivService/getDerivAccountSettings] WebSocket Error:', event);
      reject(new Error('WebSocket error during settings fetch'));
      ws.close();
    };
  });
}

export interface TradeDetails {
  symbol: string; // Deriv API symbol e.g. "R_100", "frxEURUSD"
  contract_type: "CALL" | "PUT";
  duration: number;
  duration_unit: "s" | "m" | "h" | "d" | "t"; // seconds, minutes, hours, days, ticks
  amount: number; // Stake amount
  currency: string; // e.g., "USD"
  stop_loss?: number; // Optional stop loss
  take_profit?: number; // Optional take profit
  basis: string; // e.g., "stake" or "payout"
  token: string; // Deriv API token for authorization
}

export interface PlaceTradeResponse {
  contract_id: number;
  buy_price: number;
  longcode: string;
  entry_spot: number; // Derived from proposal's spot_price
  // Potentially other fields like shortcode, purchase_time etc.
}

/**
 * Places a trade on the Deriv API for a specific account.
 * @param tradeDetails The details of the trade to place.
 * @param accountId The Deriv account ID (loginid) on which to place the trade.
 * @returns A promise that resolves with the contract details or rejects with an error.
 */
export async function placeTrade(tradeDetails: TradeDetails, accountId: string): Promise<PlaceTradeResponse> {
  let ws: WebSocket | null = null; // Initialize ws to null
  let operationTimeout: NodeJS.Timeout | null = null;
  let proposalId: string | null = null;
  let entrySpot: number | null = null;
  const startTime = Date.now();
  const timeoutDuration = 18000; // 18 seconds, slightly increased for account switching

  console.log(`[DerivService/placeTrade] Initiated for accountId: ${accountId}, symbol: ${tradeDetails.symbol} at ${new Date(startTime).toISOString()}`);

  const cleanupAndLog = (logMessage: string, isError: boolean = false, wsToClose: WebSocket | null = ws) => {
    if (operationTimeout) clearTimeout(operationTimeout);

    const duration = Date.now() - startTime;
    const fullLogMessage = `[DerivService/placeTrade] AccountID: ${accountId}. ${logMessage}. Duration: ${duration}ms.`;
    if (isError) console.error(fullLogMessage);
    else console.log(fullLogMessage);

    if (wsToClose && wsToClose.readyState !== WebSocket.CLOSED && wsToClose.readyState !== WebSocket.CLOSING) {
      console.log(`[DerivService/placeTrade] Closing WebSocket for accountId: ${accountId}. Original log: ${logMessage}`);
      wsToClose.close(1000, logMessage.substring(0, 100));
    }
  };

  // Using a Promise to handle WebSocket interactions asynchronously
  const promiseLogic = new Promise<PlaceTradeResponse>((resolve, reject) => {
    ws = new WebSocket(DERIV_API_URL);

    ws.onopen = () => {
      const openTime = Date.now();
      console.log(`[DerivService/placeTrade] WebSocket opened for accountId: ${accountId}. Time to open: ${openTime - startTime}ms. Authorizing...`);
      ws!.send(JSON.stringify({ authorize: tradeDetails.token }));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        // console.log(`[DerivService/placeTrade] Raw response for ${accountId}:`, JSON.stringify(response, null, 2));

        if (response.error) {
          cleanupAndLog(`API Error: ${response.error.message}`, true);
          reject(new Error(response.error.message || `Unknown API error during trade placement for account ${accountId}.`));
          return;
        }

        if (response.msg_type === 'authorize') {
          if (response.authorize?.loginid) {
            console.log(`[DerivService/placeTrade] Authorization successful for account ${accountId}. Current loginid: ${response.authorize.loginid}. Attempting to switch to target accountId: ${accountId}.`);
            ws!.send(JSON.stringify({ account_switch: accountId }));
          } else {
            cleanupAndLog('Authorization failed. No loginid in response.', true);
            reject(new Error(`Authorization failed for placing trade on account ${accountId}.`));
          }
        } else if (response.msg_type === 'account_switch') {
          if (response.error) {
            cleanupAndLog(`Error switching to account ${accountId}: ${response.error.message}`, true);
            reject(new Error(response.error.message || `Failed to switch to Deriv account ${accountId}.`));
            return;
          }

          const switchedToLoginId = response.account_switch?.current_loginid || response.account_switch?.loginid; // Deriv API might use either
          if (switchedToLoginId === accountId) {
            console.log(`[DerivService/placeTrade] Successfully switched to account: ${accountId}. Requesting proposal...`);

            // Construct and send proposal request
            let apiContractType: "CALL" | "PUT";
            if (tradeDetails.contract_type === 'CALL') {
              apiContractType = 'PUT';
            } else {
              apiContractType = 'CALL';
            }
            const proposalRequest: any = {
              proposal: 1,
              subscribe: 1,
              amount: tradeDetails.amount,
              basis: tradeDetails.basis,
              contract_type: apiContractType,
              currency: tradeDetails.currency,
              duration: tradeDetails.duration,
              duration_unit: tradeDetails.duration_unit,
              symbol: tradeDetails.symbol,
            };
            console.log(`[DerivService/placeTrade] Sending proposal request for account ${accountId}:`, proposalRequest);
            ws!.send(JSON.stringify(proposalRequest));
          } else {
            cleanupAndLog(`Failed to switch to account ${accountId}. Expected ${accountId} but got ${switchedToLoginId}. Response: ${JSON.stringify(response)}`, true);
            reject(new Error(`Failed to switch to Deriv account ${accountId}. Active account is ${switchedToLoginId}.`));
          }
        } else if (response.msg_type === 'proposal') {
          if (response.proposal && response.proposal.id && response.proposal.spot) {
            proposalId = response.proposal.id;
            entrySpot = response.proposal.spot;
            console.log(`[DerivService/placeTrade] Proposal received for account ${accountId}. ID: ${proposalId}, Entry Spot: ${entrySpot}. Buying contract...`);

            if (response.subscription && response.subscription.id) {
              ws!.send(JSON.stringify({ forget: response.subscription.id }));
            }

            const buyRequest = { buy: proposalId, price: tradeDetails.amount };
            console.log(`[DerivService/placeTrade] Sending buy request for account ${accountId}:`, buyRequest);
            ws!.send(JSON.stringify(buyRequest));
          } else {
            cleanupAndLog(`Invalid proposal response for account ${accountId}: ${JSON.stringify(response)}`, true);
            reject(new Error(`Invalid proposal response received from Deriv API for account ${accountId}.`));
          }
        } else if (response.msg_type === 'buy') {
          if (response.buy && response.buy.contract_id) {
            cleanupAndLog(`Contract purchased successfully on account ${accountId}: ${JSON.stringify(response.buy)}`);
            resolve({
              contract_id: response.buy.contract_id,
              buy_price: response.buy.buy_price,
              longcode: response.buy.longcode,
              entry_spot: entrySpot!,
            });
          } else {
            cleanupAndLog(`Buy contract error on account ${accountId}: ${JSON.stringify(response)}`, true);
            reject(new Error(response.error?.message || `Failed to buy contract on account ${accountId}.`));
          }
        } else {
          console.log(`[DerivService/placeTrade] Received other message type for ${accountId}: ${response.msg_type}`, response);
        }
      } catch (e: any) {
        cleanupAndLog(`Error processing message for account ${accountId}: ${e?.message || String(e)}`, true);
        reject(e instanceof Error ? e : new Error(`Failed to process message from Deriv API for account ${accountId}.`));
      }
    };

    ws.onerror = (event) => {
      let errorMessage = 'WebSocket error during trade placement.';
      if (event && typeof event === 'object' && 'message' in event && (event as any).message) {
        errorMessage = `WebSocket Error: ${(event as any).message}`;
      } else if (event) {
        errorMessage = `WebSocket Error: type=${event.type}. Check console for details.`;
      }
      cleanupAndLog(`WebSocket Error Event for account ${accountId}: ${errorMessage}`, true, ws);
      reject(new Error(errorMessage));
    };

    ws.onclose = (event) => {
      const duration = Date.now() - startTime;
      console.log(`[DerivService/placeTrade] WebSocket connection closed for accountId: ${accountId}. Code: ${event.code}, Reason: '${event.reason}', WasClean: ${event.wasClean}. Duration: ${duration}ms.`);
      if (operationTimeout) clearTimeout(operationTimeout); // Ensure timeout is cleared
      // If promise is still pending, it means it wasn't resolved by 'buy' or rejected by other handlers/timeout.
      // This could happen if connection drops unexpectedly after proposal but before buy confirmation.
      // The timeout is the primary mechanism for such cases.
    };
  });

  return Promise.race([
    promiseLogic,
    new Promise<PlaceTradeResponse>((_, reject) => {
      operationTimeout = setTimeout(() => {
        const reason = `Trade operation timed out after ${timeoutDuration / 1000} seconds for accountId: ${accountId}.`;
        // cleanupAndLog is called by promiseLogic's handlers if ws.close() triggers them.
        // Direct call here for timeout specific logging & ensuring rejection.
        console.error(`[DerivService/placeTrade] Timeout: ${reason}`);
        if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
          console.log(`[DerivService/placeTrade] Timeout: Attempting to close WebSocket for accountId: ${accountId}.`);
          ws.close(1000, "Operation timed out");
        } else if (!ws) {
           console.log(`[DerivService/placeTrade] Timeout: WebSocket instance was null for accountId: ${accountId}.`);
        }
        reject(new Error(reason));
      }, timeoutDuration);
    })
  ]);
}


/**
 * Represents the order book depth for a financial instrument.
 */
export interface OrderBookDepth {
  /**
   * The asks (sell orders) in the order book.
   */
  asks: Array<[number, number]>;
  /**
   * The bids (buy orders) in the order book.
   */
  bids: Array<[number, number]>;
}

/**
 * Asynchronously retrieves the order book depth for a given symbol.
 *
 * @param instrument The trading instrument for which to retrieve the order book depth.
 * @returns A promise that resolves to an OrderBookDepth object.
 */
export async function getOrderBookDepth(instrument: InstrumentType): Promise<OrderBookDepth> {
  console.warn(`getOrderBookDepth for ${instrument} is not yet implemented with real API.`);
  // Mock data, replace with actual API call if needed
  return {
    asks: [
      [1.2346, 10],
      [1.2347, 20],
    ],
    bids: [
      [1.2344, 15],
      [1.2343, 25],
    ],
  };
}
