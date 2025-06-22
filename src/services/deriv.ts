// IMPORTANT: Deriv API Service
// This service requires the following environment variables to be set:
// 1. NEXT_PUBLIC_DERIV_WS_URL: The base WebSocket URL for the Deriv API (e.g., wss://ws.derivws.com/websockets/v3).
// 2. NEXT_PUBLIC_DERIV_APP_ID: Your specific Deriv application ID.
// The application will fail to start if these are not correctly configured.

// import WebSocket from 'ws'; // Removed: 'ws' is for Node.js, browser has native WebSocket
// Types import - ensuring CandleData is recognized
import type { InstrumentType, PriceTick, CandleData } from '@/types';
import type { DerivSymbolSpecificTradingData } from '../types/trading-times'; // Added import
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

export interface DerivContractOffering {
  contract_type?: string;
  contract_category?: string;
  market?: string;
  submarket?: string;
  underlying_symbol?: string;
  min_contract_duration?: string;
  max_contract_duration?: string;
  expiry_type?: string;
  start_type?: string;
  // Add any other fields you might need for validation
}

// --- Start of Corrected Global Trading Durations Interfaces ---
export interface TradingDurationDetail {
  display_name: string;
  max: number;
  min: number;
  name: string;
}

export interface TradeTypeDurations {
  durations: TradingDurationDetail[];
  trade_type: {
    display_name: string;
    name: string;
  };
}

// Interface for the new getFullContractDetails function
export interface DerivFullContractDetails {
  contract_type: string;
  contract_category: string;
  contract_category_display: string;
  contract_display: string;
  market: string;
  submarket: string;
  underlying_symbol: string;
  expiry_type?: string;
  min_contract_duration?: string;
  max_contract_duration?: string;
  multiplier_range?: number[];
  cancellation_range?: string[];
  // Add other relevant fields as they become necessary for AI or UI
}

/**
 * Fetches the full contract details for a given instrument symbol using Deriv's `contracts_for` API.
 * @param instrumentSymbol The Deriv API symbol for the instrument (e.g., "R_100", "frxEURUSD").
 * @param token Optional Deriv API token for authorization.
 * @returns A promise that resolves to an array of DerivFullContractDetails.
 */
export async function getFullContractDetails(instrumentSymbol: string, token?: string): Promise<DerivFullContractDetails[]> {
  let ws: WebSocket | null = null;
  const operationTimeoutDuration = 15000; // 15 seconds
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  const req_id = Date.now(); // Unique req_id for this operation

  const cleanupAndLog = (logMessage: string, isError: boolean = false, wsToClose: WebSocket | null = ws) => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
    const fullLogMessage = `[DerivService/getFullContractDetails] Symbol: ${instrumentSymbol}. ${logMessage}.`;
    if (isError) console.error(fullLogMessage);
    else console.log(fullLogMessage);

    if (wsToClose && wsToClose.readyState !== WebSocket.CLOSED && wsToClose.readyState !== WebSocket.CLOSING) {
      wsToClose.close(1000, logMessage.substring(0, 100));
    }
  };

  const promiseLogic = new Promise<DerivFullContractDetails[]>((resolve, reject) => {
    ws = new WebSocket(DERIV_API_URL);
    console.log(`[DerivService/getFullContractDetails] Attempting to connect for symbol: ${instrumentSymbol}`);

    const sendContractsForRequest = () => {
      const contractsForPayload = {
        contracts_for: instrumentSymbol,
        currency: "USD",
        product_type: "basic", // Ensures comprehensive details
        req_id: req_id,
      };
      console.log(`[DerivService/getFullContractDetails] Sending contracts_for request (req_id: ${req_id}):`, JSON.stringify(contractsForPayload));
      ws!.send(JSON.stringify(contractsForPayload));
    };

    ws.onopen = () => {
      cleanupAndLog("WebSocket connection opened.", false, null);
      if (token) {
        const authReqId = req_id + 1; // Distinct req_id for authorization
        console.log(`[DerivService/getFullContractDetails] Sending authorize request (authReqId: ${authReqId}) for symbol: ${instrumentSymbol}`);
        ws!.send(JSON.stringify({ authorize: token, req_id: authReqId }));
      } else {
        // contracts_for typically requires authorization for most symbols or to get full details.
        // Proceeding without token might result in limited or no data.
        console.warn(`[DerivService/getFullContractDetails] No token provided for symbol ${instrumentSymbol}. Full contract details might require authorization.`);
        sendContractsForRequest();
      }
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);

        if (response.error) {
          const errorMessage = response.error.message || `Unknown API error for getFullContractDetails on ${instrumentSymbol}.`;
          cleanupAndLog(`API Error: ${errorMessage}`, true);
          reject(new Error(errorMessage));
          return;
        }

        const authReqId = token ? req_id + 1 : null;

        if (response.msg_type === 'authorize') {
          if (authReqId && response.req_id === authReqId) {
            if (response.authorize) {
              console.log(`[DerivService/getFullContractDetails] Authorization successful (authReqId: ${authReqId}). Now sending contracts_for request.`);
              sendContractsForRequest();
            } else {
              const authFailedMsg = `Authorization failed in getFullContractDetails (authReqId: ${authReqId}).`;
              cleanupAndLog(authFailedMsg, true);
              reject(new Error(authFailedMsg));
            }
          } else {
            // Log other authorize messages if necessary, but don't fail the main request yet
             console.warn(`[DerivService/getFullContractDetails] Received an authorize message with unexpected req_id: ${response.req_id}. Ignoring for main promise.`);
          }
        } else if (response.msg_type === 'contracts_for') {
          if (response.req_id === req_id) {
            if (response.contracts_for && Array.isArray(response.contracts_for.available)) {
              cleanupAndLog(`Received contracts_for response for ${instrumentSymbol}.`);
              resolve(response.contracts_for.available as DerivFullContractDetails[]);
            } else {
              const noDataMsg = `No 'contracts_for.available' data in response for ${instrumentSymbol}.`;
              cleanupAndLog(noDataMsg, true); // Log as error because data is expected
              reject(new Error(noDataMsg));
            }
          } else {
            console.warn(`[DerivService/getFullContractDetails] Received contracts_for with mismatched req_id. Expected ${req_id}, got ${response.req_id}. Ignoring.`);
          }
        } else {
          console.log(`[DerivService/getFullContractDetails] Received other message type: ${response.msg_type}. Waiting for contracts_for or error.`);
        }
      } catch (e: any) {
        const processErrorMsg = `Error processing message for ${instrumentSymbol}: ${e?.message || String(e)}`;
        cleanupAndLog(processErrorMsg, true);
        reject(new Error(processErrorMsg));
      }
    };

    ws.onerror = (event) => {
      const errorMsg = `WebSocket error in getFullContractDetails for ${instrumentSymbol}. Type: ${(event as any)?.type}`;
      cleanupAndLog(errorMsg, true);
      reject(new Error(errorMsg));
    };

    ws.onclose = (event) => {
      cleanupAndLog(`WebSocket connection closed for ${instrumentSymbol}. Code: ${event.code}, Reason: ${event.reason}`, !event.wasClean);
      // If the promise hasn't settled and it wasn't a clean closure after data, consider it an error (handled by timeout).
    };
  });

  return Promise.race([
    promiseLogic,
    new Promise<DerivFullContractDetails[]>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        const reason = `getFullContractDetails operation timed out for symbol ${instrumentSymbol}.`;
        cleanupAndLog(reason, true);
        reject(new Error(reason));
      }, operationTimeoutDuration);
    })
  ]);
}

export interface SymbolInfo { // Represents one entry in the "symbol" array
    display_name: string;
    name: string;
}

export interface SymbolTradeDurations {
  symbol: SymbolInfo[]; // Array of symbols that share these trade_durations
  trade_durations: TradeTypeDurations[];
}

export interface MarketOfferings { // Represents one market entry in the main array
  data: SymbolTradeDurations[];
  market: {
    display_name: string;
    name: string;
  };
  submarket: {
    display_name: string;
    name: string;
  };
}

// This is the actual structure of the `trading_durations` field in the response
export type TradingDurationsData = MarketOfferings[];

export interface GetGlobalTradingDurationsApiResponse { // Top-level API response
  trading_durations: TradingDurationsData;
  echo_req: any;
  msg_type: 'trading_durations';
  req_id?: number;
}
// --- End of Corrected Global Trading Durations Interfaces ---

/**
 * Maps user-friendly instrument names to Deriv API symbols.
 */
export const instrumentToDerivSymbol = (instrument: InstrumentType): string => {
  const knownDerivSymbolPatterns = [
    /^frx[A-Z]+$/,    // Forex, e.g., frxEURUSD
    /^cry[A-Z]+$/,    // Crypto, e.g., cryBTCUSD
    /^R_\d+$/,        // Volatility Indices (old), e.g., R_100
    /^1HZ\d+V?$/,     // 1HZ Volatility Indices, e.g., 1HZ10V, 1HZ100V
    /^stpRNG\d*$/,    // Step Indices, e.g., stpRNG, stpRNG2
    /^(BOOM|CRASH)\d+N?$/, // Boom/Crash Indices, e.g., BOOM500, CRASH300N
    /^JD\d+$/,         // Jump Indices, e.g., JD10
    /^OTC_[A-Z0-9]+$/, // OTC Stock Indices, e.g., OTC_NDX
    /^WLD[A-Z]+$/      // Basket Indices, e.g., WLDAUD
  ];

  for (const pattern of knownDerivSymbolPatterns) {
    if (pattern.test(instrument)) {
      return instrument; // Input is already a Deriv symbol
    }
  }

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
  let operationTimeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutDuration = 15000; // 15 seconds for candles
  const symbolForTimeoutLog = symbol; // Capture for timeout log

  const cleanup = (isError: boolean = false, message?: string) => {
    if (operationTimeout) {
      clearTimeout(operationTimeout);
      operationTimeout = null;
    }
    if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
      const logMessage = `[DerivService/getCandles] Closing WebSocket for ${symbolForTimeoutLog}. ${message || (isError ? "Error occurred" : "Operation complete")}`;
      if (isError) console.error(logMessage); else console.log(logMessage);
      ws.close(1000, message || (isError ? "Error occurred" : "Operation complete"));
    }
  };

  const promiseLogic = new Promise<CandleData[]>((resolve, reject) => {
    ws.onopen = () => {
      let authorized = false;
      const authPayloadForLog = { authorize: token ? 'TOKEN_PRESENT' : (DERIV_API_TOKEN ? 'GLOBAL_DEMO_TOKEN_USED' : 'NO_TOKEN_SPECIFIED_FOR_AUTH') };
      if (token) {
        console.log('[DerivService/getCandles] Authorizing with provided token.');
        console.log('[DerivService/getCandles] Sending authorize request:', JSON.stringify(authPayloadForLog));
        ws.send(JSON.stringify({ authorize: token }));
        authorized = true;
      } else if (DERIV_API_TOKEN) { // Fallback to global demo token if no specific token provided
        console.log('[DerivService/getCandles] Authorizing with global DERIV_API_TOKEN.');
        console.log('[DerivService/getCandles] Sending authorize request:', JSON.stringify(authPayloadForLog));
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
        
        console.log('[DerivService/getCandles] Sending ticks_history request:', JSON.stringify(request));
        ws.send(JSON.stringify(request));
      }, authorized ? 500 : 0); // Reduced delay if authorized, 0 if not.
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        // console.log('[DerivService/getCandles] Received response:', response); // Verbose, can be enabled for debug
        
        if (response.error) {
          console.error('[DerivService/getCandles] API Error:', response.error);
          cleanup(true, response.error.message);
          reject(new Error(response.error.message || 'Unknown API error'));
          return;
        }
        
        if (response.msg_type === 'candles') {
          const candles: CandleData[] = (response.candles || []).map((candle: any) => ({
            time: formatTickTime(candle.epoch),
            epoch: candle.epoch,
            open: parseFloat(candle.open.toFixed(decimalPlaces)),
            high: parseFloat(candle.high.toFixed(decimalPlaces)),
            low: parseFloat(candle.low.toFixed(decimalPlaces)),
            close: parseFloat(candle.close.toFixed(decimalPlaces)),
          }));
          cleanup(false, "Candles received successfully");
          resolve(candles.slice(-count));
          return;
        } else if (response.msg_type === 'authorize') {
          if (response.error) {
            console.error('[DerivService/getCandles] Authorization Error:', response.error.message);
            // Don't reject here for auth error if public data might still be accessible
            // The ticks_history request will proceed and fail if auth was truly required.
          } else {
            console.log('[DerivService/getCandles] Authorization successful/response received.');
          }
        } else if (response.msg_type === 'tick_history') {
             console.warn('[DerivService/getCandles] Received tick_history instead of candles. This might indicate an issue or different API version for the symbol.');
             cleanup(true, "Received 'tick_history' msg_type when 'candles' was expected.");
             reject(new Error("Received 'tick_history' msg_type when 'candles' was expected."));
             return;
        }
      } catch (e) {
        console.error('[DerivService/getCandles] Error processing message:', e);
        cleanup(true, (e as Error).message);
        reject(e);
      }
    };

    ws.onerror = (event) => {
      let errorMessage = 'WebSocket error fetching candles.';
      if (event && typeof event === 'object') {
        if ('message' in event && (event as any).message) {
            errorMessage = `WebSocket Error: ${(event as any).message}`;
        } else {
            errorMessage = `WebSocket Error: type=${event.type}. Check browser console for the full event object.`;
        }
      }
      console.error('[DerivService/getCandles] WebSocket Error Event:', event);
      cleanup(true, errorMessage);
      reject(new Error(errorMessage));
    };

    ws.onclose = (event) => {
      console.log(`[DerivService/getCandles] WebSocket connection closed for ${symbolForTimeoutLog}. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
      cleanup(event.wasClean ? false : true, `WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
      // If the promise is still pending at this point (i.e., not resolved/rejected by onmessage, onerror, or timeout)
      // it implies an unexpected closure. The timeout should eventually catch this if it hangs.
      // However, if it closes cleanly before timeout AND before data, it's an issue.
      // The cleanup call above will clear the timeout. We might need to reject here if not already settled.
      // For now, relying on timeout or specific handlers to reject.
    };
  });

  return Promise.race([
    promiseLogic,
    new Promise<CandleData[]>((_, rejectTimeout) => {
      operationTimeout = setTimeout(() => {
        const reason = `getCandles operation timed out for symbol ${symbolForTimeoutLog}`;
        console.error(`[DerivService/getCandles] ${reason}`);
        cleanup(true, "Operation timed out");
        rejectTimeout(new Error(reason));
      }, timeoutDuration);
    })
  ]);
}

// --- START OF NEW getTicks FUNCTION ---
/**
 * Fetches historical tick data for a given instrument from Deriv API.
 * @param instrument The trading instrument.
 * @param count Number of ticks to fetch (default 100).
 * @param token Optional Deriv API token for authorization.
 * @returns A promise that resolves to an array of PriceTick.
 */
export async function getTicks(
  instrument: InstrumentType,
  count: number = 100, // Default to 100 ticks
  token?: string
): Promise<PriceTick[]> {
  const symbol = instrumentToDerivSymbol(instrument);
  const decimalPlaces = getInstrumentDecimalPlaces(instrument); // For formatting price if needed, though ticks are usually raw

  const ws = new WebSocket(DERIV_API_URL);
  let operationTimeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutDuration = 15000; // 15 seconds for ticks history
  const symbolForTimeoutLog = symbol;

  const cleanup = (isError: boolean = false, message?: string) => {
    if (operationTimeout) {
      clearTimeout(operationTimeout);
      operationTimeout = null;
    }
    if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
      const logMessage = `[DerivService/getTicks] Closing WebSocket for ${symbolForTimeoutLog}. ${message || (isError ? "Error occurred" : "Operation complete")}`;
      if (isError) console.error(logMessage); else console.log(logMessage);
      ws.close(1000, message || (isError ? "Error occurred" : "Operation complete"));
    }
  };

  const promiseLogic = new Promise<PriceTick[]>((resolve, reject) => {
    ws.onopen = () => {
      let authorized = false;
      if (token) {
        console.log('[DerivService/getTicks] Authorizing with provided token.');
        ws.send(JSON.stringify({ authorize: token }));
        authorized = true;
      } else if (DERIV_API_TOKEN) { // Fallback to global demo token
        console.log('[DerivService/getTicks] Authorizing with global DERIV_API_TOKEN.');
        ws.send(JSON.stringify({ authorize: DERIV_API_TOKEN }));
        authorized = true;
      } else {
        console.log('[DerivService/getTicks] No token provided, proceeding without explicit authorization for ticks.');
      }

      setTimeout(() => {
        const request = {
          ticks_history: symbol,
          adjust_start_time: 1,
          count: count,
          end: 'latest',
          style: 'ticks', // Crucial difference: 'ticks' instead of 'candles'
          // granularity is NOT used with style: 'ticks'
        };
        console.log('[DerivService/getTicks] Sending ticks_history request (style:ticks):', JSON.stringify(request));
        ws.send(JSON.stringify(request));
      }, authorized ? 500 : 0);
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);

        if (response.error) {
          console.error('[DerivService/getTicks] API Error:', response.error);
          cleanup(true, response.error.message);
          reject(new Error(response.error.message || 'Unknown API error fetching ticks'));
          return;
        }

        if (response.msg_type === 'history') { // For style: 'ticks', msg_type is 'history'
          const prices = response.history?.prices || [];
          const times = response.history?.times || [];
          const ticks: PriceTick[] = prices.map((price: number, index: number) => ({
            epoch: times[index],
            price: parseFloat(price.toFixed(decimalPlaces)), // Apply decimal formatting
            time: formatTickTime(times[index]),
          }));
          cleanup(false, "Ticks received successfully");
          resolve(ticks.slice(-count)); // Ensure we only return the requested count
          return;
        } else if (response.msg_type === 'authorize') {
          if (response.error) {
            console.error('[DerivService/getTicks] Authorization Error:', response.error.message);
          } else {
            console.log('[DerivService/getTicks] Authorization successful/response received.');
          }
        } else if (response.msg_type === 'candles') {
             console.warn('[DerivService/getTicks] Received candles msg_type when history (for ticks) was expected. This might indicate an issue.');
             cleanup(true, "Received 'candles' msg_type when 'history' (for ticks) was expected.");
             reject(new Error("Received 'candles' msg_type when 'history' (for ticks) was expected."));
             return;
        }
      } catch (e) {
        console.error('[DerivService/getTicks] Error processing message:', e);
        cleanup(true, (e as Error).message);
        reject(e);
      }
    };

    ws.onerror = (event) => {
      let errorMessage = 'WebSocket error fetching ticks.';
      if (event && typeof event === 'object') {
        if ('message' in event && (event as any).message) {
            errorMessage = `WebSocket Error: ${(event as any).message}`;
        } else {
            errorMessage = `WebSocket Error: type=${event.type}. Check browser console for the full event object.`;
        }
      }
      console.error('[DerivService/getTicks] WebSocket Error Event:', event);
      cleanup(true, errorMessage);
      reject(new Error(errorMessage));
    };

    ws.onclose = (event) => {
      console.log(`[DerivService/getTicks] WebSocket connection closed for ${symbolForTimeoutLog}. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
      // cleanup(event.wasClean ? false : true, `WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
      // If promise is not settled, timeout should handle it. Avoid calling cleanup again if already called by resolve/reject.
      if (operationTimeout) { // Check if timeout is still active (meaning promise hasn't settled via other paths)
          cleanup(event.wasClean ? false : true, `WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
      }
    };
  });

  return Promise.race([
    promiseLogic,
    new Promise<PriceTick[]>((_, rejectTimeout) => {
      operationTimeout = setTimeout(() => {
        const reason = `getTicks operation timed out for symbol ${symbolForTimeoutLog}`;
        console.error(`[DerivService/getTicks] ${reason}`);
        // Ensure cleanup is called ONLY if the WebSocket is still in a state where it might need closing by timeout logic.
        // If it closed and promiseLogic already called cleanup, this might be redundant or error-prone.
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            cleanup(true, "Operation timed out");
        } else if (!ws) {
            // If ws is null, it means onopen might not have even fired.
             console.warn(`[DerivService/getTicks] Timeout occurred but WebSocket instance was null for ${symbolForTimeoutLog}.`);
        }
        rejectTimeout(new Error(reason));
      }, timeoutDuration);
    })
  ]);
}
// --- END OF NEW getTicks FUNCTION ---

// Local definitions of DerivMarketTimes, DerivTradingEvent, DerivSymbolSpecificTradingData are removed.

export async function getTradingTimes(date: string = 'today', token?: string): Promise<any | { error: string }> {
  let ws: WebSocket | null = null;
  const operationTimeoutDuration = 15000; // 15 seconds
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  const req_id = Date.now(); // Unique req_id for the trading_times request
  const startTime = Date.now();

  const cleanupAndLog = (logMessage: string, isError: boolean = false, wsToClose: WebSocket | null = ws) => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
    const duration = Date.now() - startTime;
    const fullLogMessage = `[DerivService/getTradingTimes] Date: ${date}. ${logMessage}. Duration: ${duration}ms.`;
    if (isError) console.error(fullLogMessage);
    else console.log(fullLogMessage);

    if (wsToClose && wsToClose.readyState !== WebSocket.CLOSED && wsToClose.readyState !== WebSocket.CLOSING) {
      wsToClose.close(1000, logMessage.substring(0, 100)); // Close with a normal status code
    }
  };

  const promiseLogic = new Promise<any>((resolve, reject) => {
    ws = new WebSocket(DERIV_API_URL);
    console.log(`[DerivService/getTradingTimes] Attempting to connect for trading_times, date: ${date}`);

    ws.onopen = () => {
      cleanupAndLog("WebSocket connection opened.", false, null);

      if (token) {
        const authReqId = req_id + 1; // Distinct req_id for authorization
        console.log(`[DerivService/getTradingTimes] Sending authorize request (authReqId: ${authReqId}) for date: ${date}`);
        ws!.send(JSON.stringify({ authorize: token, req_id: authReqId }));
        // The trading_times request will be sent upon successful authorization
      } else {
        console.log(`[DerivService/getTradingTimes] Sending trading_times request (req_id: ${req_id}) without prior auth for date: ${date}`);
        ws!.send(JSON.stringify({ trading_times: date, req_id: req_id }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);

        if (response.error) {
          const errorMessage = response.error.message || `Unknown API error fetching trading times.`;
          cleanupAndLog(`API Error: ${errorMessage}`, true);
          reject({ error: errorMessage });
          return;
        }

        // Use authReqId for checking authorization response if token was present
        const authReqId = token ? req_id + 1 : null;

        if (response.msg_type === 'authorize') {
          if (authReqId && response.req_id === authReqId) { // Check if this is the response to our specific auth request
            if (response.authorize) {
              console.log(`[DerivService/getTradingTimes] Authorization successful (authReqId: ${authReqId}) for date: ${date}. Now sending trading_times request (req_id: ${req_id}).`);
              ws!.send(JSON.stringify({ trading_times: date, req_id: req_id }));
            } else {
              const authFailedMsg = `Authorization failed in getTradingTimes (authReqId: ${authReqId}) for date: ${date}.`;
              cleanupAndLog(authFailedMsg, true);
              reject({ error: authFailedMsg });
            }
          } else {
            // Log unexpected authorize messages but don't necessarily fail the main request yet
            console.warn(`[DerivService/getTradingTimes] Received an authorize message with unexpected req_id: ${response.req_id} (expected ${authReqId}). Ignoring for main promise.`);
          }
        } else if (response.msg_type === 'trading_times') {
          if (response.req_id === req_id) { // Match with the main trading_times req_id
            cleanupAndLog(`Received trading_times response (req_id: ${req_id}) for date: ${date}.`);
            resolve(response.trading_times);
          } else {
            console.warn(`[DerivService/getTradingTimes] Received trading_times with mismatched req_id. Expected ${req_id}, got ${response.req_id}. Ignoring.`);
          }
        } else {
          console.log(`[DerivService/getTradingTimes] Received other message type: ${response.msg_type} for date: ${date}. Waiting for trading_times or error.`);
        }
      } catch (e: any) {
        const processErrorMsg = `Error processing message for date: ${date}: ${e?.message || String(e)}`;
        cleanupAndLog(processErrorMsg, true);
        reject({ error: processErrorMsg });
      }
    };

    ws.onerror = (event) => {
      const errorMsg = `WebSocket error in getTradingTimes for date: ${date}. Type: ${(event as any)?.type}`;
      cleanupAndLog(errorMsg, true);
      reject({ error: errorMsg });
    };

    ws.onclose = (event) => {
      cleanupAndLog(`WebSocket connection closed for date: ${date}. Code: ${event.code}, Reason: ${event.reason}`, !event.wasClean);
      // If the promise hasn't settled and it wasn't a clean closure after data, consider it an error.
      // This is tricky because resolve/reject might have already been called.
      // The timeout is the main guard against hangs. For now, just logging.
    };
  });

  return Promise.race([
    promiseLogic,
    new Promise<any>((_, reject) => { // Changed from Promise<any | { error: string }> to just Promise<any> for the race
      timeoutTimer = setTimeout(() => {
        const reason = `getTradingTimes operation timed out for date: ${date}.`;
        cleanupAndLog(reason, true);
        reject({ error: reason }); // Ensure timeout also rejects with the error object structure
      }, operationTimeoutDuration);
    })
  ]);
}

export async function getContractOfferings(instrumentSymbol: string, token?: string): Promise<DerivContractOffering[]> {
  const ws = new WebSocket(DERIV_API_URL);
  const timeoutDuration = 10000; // 10 seconds for the operation
  let operationTimeout: ReturnType<typeof setTimeout> | null = null;

  return new Promise((resolve, reject) => {
    operationTimeout = setTimeout(() => {
      console.error('[DerivService/getContractOfferings] Operation timed out for symbol:', instrumentSymbol);
      if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close(1000, "Operation timed out");
      }
      reject(new Error(`Fetching contract offerings for ${instrumentSymbol} timed out.`));
    }, timeoutDuration);

    ws.onopen = () => {
      console.log('[DerivService/getContractOfferings] WebSocket connection opened for symbol:', instrumentSymbol);
      if (token) {
        console.log('[DerivService/getContractOfferings] Authorizing for symbol:', instrumentSymbol);
        console.log('[DerivService/getContractOfferings] Sending authorize request:', JSON.stringify({ authorize: token ? 'TOKEN_PRESENT' : 'TOKEN_ABSENT' }));
        ws.send(JSON.stringify({ authorize: token }));
      } else {
        console.log('[DerivService/getContractOfferings] Sending contracts_for request without prior authorization for symbol:', instrumentSymbol);
        const contractsForPayload = {
          contracts_for: instrumentSymbol,
          currency: "USD",
          product_type: "basic" // Adjust as needed, "basic" is common for general offerings
        };
        console.log('[DerivService/getContractOfferings] Sending contracts_for request:', JSON.stringify(contractsForPayload));
        ws.send(JSON.stringify(contractsForPayload));
      }
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        // console.log(`[DerivService/getContractOfferings] Raw response for ${instrumentSymbol}:`, JSON.stringify(response, null, 2)); // Optional: for detailed debugging

        if (response.error) {
          console.error(`[DerivService/getContractOfferings] API Error for ${instrumentSymbol}:`, response.error);
          if (operationTimeout) clearTimeout(operationTimeout);
          ws.close();
          reject(new Error(response.error.message || `Unknown API error fetching contract offerings for ${instrumentSymbol}.`));
          return;
        }

        if (response.msg_type === 'authorize') {
          if (response.authorize?.loginid) {
            console.log(`[DerivService/getContractOfferings] Authorization successful for ${instrumentSymbol}. Sending contracts_for request...`);
            const contractsForPayload = {
              contracts_for: instrumentSymbol,
              currency: "USD",
              product_type: "basic"
            };
            console.log('[DerivService/getContractOfferings] Sending contracts_for request after auth:', JSON.stringify(contractsForPayload));
            ws.send(JSON.stringify(contractsForPayload));
          } else {
            console.error(`[DerivService/getContractOfferings] Authorization failed for ${instrumentSymbol}:`, response);
            if (operationTimeout) clearTimeout(operationTimeout);
            ws.close();
            reject(new Error(`Authorization failed for fetching contract offerings for ${instrumentSymbol}.`));
          }
        } else if (response.msg_type === 'contracts_for') {
          if (operationTimeout) clearTimeout(operationTimeout);
          const offerings: DerivContractOffering[] = [];
          if (response.contracts_for && Array.isArray(response.contracts_for.available)) {
            response.contracts_for.available.forEach((contract: any) => {
              if (contract.contract_category === 'callput' && contract.start_type === 'spot') {
                offerings.push({
                  contract_category: contract.contract_category,
                  market: contract.market,
                  submarket: contract.submarket,
                  underlying_symbol: contract.underlying_symbol,
                  min_contract_duration: contract.min_contract_duration,
                  max_contract_duration: contract.max_contract_duration,
                  expiry_type: contract.expiry_type,
                  start_type: contract.start_type,
                  // contract_type is often not at this level for general offerings,
                  // but specific to a trade type within the category.
                  // If Deriv includes it here, it can be mapped: contract_type: contract.contract_type
                });
              }
            });
          }
          if (offerings.length === 0) {
            console.warn(`[DerivService/getContractOfferings] No suitable 'callput/spot' offerings found for ${instrumentSymbol}.`);
          } else {
            console.log(`[DerivService/getContractOfferings] Found ${offerings.length} offerings for ${instrumentSymbol}.`);
          }
          resolve(offerings);
          ws.close();
        }
      } catch (e: any) {
        console.error(`[DerivService/getContractOfferings] Error processing message for ${instrumentSymbol}:`, e);
        if (operationTimeout) clearTimeout(operationTimeout);
        ws.close();
        reject(e instanceof Error ? e : new Error(`Failed to process message for contract offerings for ${instrumentSymbol}.`));
      }
    };

    ws.onerror = (event) => {
      let errorMessage = `WebSocket error fetching contract offerings for ${instrumentSymbol}.`;
      // Basic error event logging, could be expanded if specific Event types are expected
      console.error(`[DerivService/getContractOfferings] WebSocket Error Event for ${instrumentSymbol}:`, event);
      if (operationTimeout) clearTimeout(operationTimeout);
      ws.close();
      reject(new Error(errorMessage));
    };

    ws.onclose = (event) => {
      console.log(`[DerivService/getContractOfferings] WebSocket connection closed for ${instrumentSymbol}. Code: ${event.code}, Reason: ${event.reason}`);
      if (operationTimeout) clearTimeout(operationTimeout); // Ensure timeout is cleared on close
      // If promise hasn't settled, it might mean an unexpected close.
      // Consider rejecting if not already resolved/rejected, though timeout should handle most cases.
    };
  });
}

export async function getGlobalTradingOfferings(token?: string): Promise<TradingDurationsData> {
  let ws: WebSocket | null = null;
  const operationTimeoutDuration = 20000; // Increased timeout for potentially large response
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  const req_id = Date.now(); // Unique req_id for this call

  // Local cleanup function
  const cleanupAndLog = (logMessage: string, isError: boolean = false, wsToClose: WebSocket | null = ws) => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    timeoutTimer = null; // Important to nullify to prevent reuse by other logic if ws persists
    const fullLogMessage = `[DerivService/getGlobalTradingOfferings] ${logMessage}`;
    if (isError) console.error(fullLogMessage);
    else console.log(fullLogMessage);
    if (wsToClose && wsToClose.readyState !== WebSocket.CLOSED && wsToClose.readyState !== WebSocket.CLOSING) {
      wsToClose.close(1000, logMessage.substring(0, 100));
    }
  };

  const promiseLogic = new Promise<TradingDurationsData>((resolve, reject) => {
    ws = new WebSocket(DERIV_API_URL);
    console.log('[DerivService/getGlobalTradingOfferings] Attempting to connect...');

    ws.onopen = () => {
      cleanupAndLog("WebSocket connection opened.", false, null); // Log with context, prevent default close
      const authReqId = req_id + 1; // Separate req_id for auth

      if (token) {
        console.log('[DerivService/getGlobalTradingOfferings] Sending authorize request:', JSON.stringify({ authorize: 'TOKEN_PRESENT', req_id: authReqId }));
        ws!.send(JSON.stringify({ authorize: token, req_id: authReqId }));
        // Wait for auth response before sending trading_durations, handled in onmessage
      } else {
        // If no token, send trading_durations request directly
        console.log('[DerivService/getGlobalTradingOfferings] Sending trading_durations request (no auth):', JSON.stringify({ trading_durations: 1, req_id: req_id }));
        ws!.send(JSON.stringify({ trading_durations: 1, req_id: req_id }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string) as GetGlobalTradingDurationsApiResponse | { msg_type: string, error?: {code: string, message: string}, req_id?: number, authorize?: any };

        if (response.error) {
          cleanupAndLog(`API Error: ${response.error.message}`, true);
          reject(new Error(response.error.message || 'Deriv API error in getGlobalTradingOfferings'));
          return;
        }

        if (response.msg_type === 'authorize') {
          if (response.authorize) {
            console.log('[DerivService/getGlobalTradingOfferings] Authorization successful. Now sending trading_durations request.');
            console.log('[DerivService/getGlobalTradingOfferings] Sending trading_durations request (post-auth):', JSON.stringify({ trading_durations: 1, req_id: req_id }));
            ws!.send(JSON.stringify({ trading_durations: 1, req_id: req_id }));
          } else {
            cleanupAndLog('Authorization failed.', true);
            reject(new Error('Authorization failed in getGlobalTradingOfferings.'));
          }
        } else if (response.msg_type === 'trading_durations') {
          if (response.req_id === req_id) {
            cleanupAndLog('Received trading_durations response.');
            resolve((response as GetGlobalTradingDurationsApiResponse).trading_durations);
          } else {
             if (response.req_id === req_id + 1 && response.msg_type === 'authorize') {
                // This is the echo of the auth request, ignore it here as we only care about the trading_durations response for resolving this promise.
                console.log('[DerivService/getGlobalTradingOfferings] Received authorize echo, awaiting trading_durations response.');
                return;
             }
             cleanupAndLog(`Received trading_durations response with mismatched req_id. Expected ${req_id}, got ${response.req_id}. Ignoring.`, true);
             // Not rejecting here as the correct response might still arrive. Timeout will handle hangs.
          }
        } else {
          console.log(`[DerivService/getGlobalTradingOfferings] Received other message type: ${response.msg_type}. Waiting for trading_durations or error.`);
        }
      } catch (e: any) {
        cleanupAndLog(`Error processing message: ${e?.message || String(e)}`, true);
        reject(e);
      }
    };

    ws.onerror = (event) => {
      // The event itself in onerror is often not very descriptive.
      cleanupAndLog('WebSocket error.', true);
      reject(new Error('WebSocket error in getGlobalTradingOfferings.'));
    };

    ws.onclose = (event) => {
      cleanupAndLog(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`, !event.wasClean);
      // If the promise hasn't settled yet, it means an unexpected close or the timeout didn't fire first.
      // The reject in the timeout should handle unresolved promises if the close is due to a hang.
      // If it closes cleanly before data (and not due to resolve/reject in onmessage), it's an issue.
      // However, a simple reject here without checking if already settled can cause "already settled" errors.
      // Relying on timeout for unresolved cases.
    };
  });

  return Promise.race([
    promiseLogic,
    new Promise<TradingDurationsData>((_, reject) => { // Ensure type matches promiseLogic
      timeoutTimer = setTimeout(() => {
        cleanupAndLog('Operation timed out.', true);
        reject(new Error('getGlobalTradingOfferings operation timed out.'));
      }, operationTimeoutDuration);
    })
  ]);
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
        console.log('[DerivService/getTradingDurations] Sending authorize request:', JSON.stringify({ authorize: token ? 'TOKEN_PRESENT' : 'TOKEN_ABSENT_SHOULD_NOT_HAPPEN_HERE' }));
        ws.send(JSON.stringify({ authorize: token }));
      } else {
        console.log('[DerivService/getTradingDurations] Sending contracts_for request without prior authorization.');
        const contractsForPayload = {
          contracts_for: instrumentSymbol,
          currency: "USD",
          product_type: "basic"
        };
        console.log('[DerivService/getTradingDurations] Sending contracts_for request:', JSON.stringify(contractsForPayload));
        ws.send(JSON.stringify(contractsForPayload));
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
            const contractsForPayload = {
              contracts_for: instrumentSymbol,
              currency: "USD",
              product_type: "basic"
            };
            console.log('[DerivService/getTradingDurations] Sending contracts_for request:', JSON.stringify(contractsForPayload));
            ws.send(JSON.stringify(contractsForPayload));
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
  let timeoutId: ReturnType<typeof setTimeout>;
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

export interface DerivSellResponse {
  sell: {
    balance_after: number;
    contract_id: number;
    reference_id: number;
    sell_price: number;
    transaction_id: number;
  };
  echo_req: any;
  msg_type: 'sell';
}

export async function sellContract(
  contractId: number,
  price: number,
  token: string,
  accountId: string
): Promise<DerivSellResponse> {
  let ws: WebSocket | null = null;
  const operationTimeout = 15000;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  const startTime = Date.now();

  const cleanupAndLog = (logMessage: string, isError: boolean = false, wsToClose: WebSocket | null = ws) => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    const duration = Date.now() - startTime;
    const fullLogMessage = `[DerivService/sellContract] ContractID: ${contractId}, AccountID: ${accountId}. ${logMessage}. Duration: ${duration}ms.`;
    if (isError) console.error(fullLogMessage);
    else console.log(fullLogMessage);
    if (wsToClose && wsToClose.readyState !== WebSocket.CLOSED && wsToClose.readyState !== WebSocket.CLOSING) {
      wsToClose.close(1000, logMessage.substring(0, 100));
    }
  };

  const promiseLogic = new Promise<DerivSellResponse>((resolve, reject) => {
    ws = new WebSocket(DERIV_API_URL);
    ws.onopen = () => {
      ws!.send(JSON.stringify({ authorize: token }));
    };
    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        if (response.error) {
          cleanupAndLog(`API Error: ${response.error.message}`, true);
          reject(new Error(response.error.message || `Deriv API error selling contract ${contractId}`));
          return;
        }
        if (response.msg_type === 'authorize') {
          if (response.authorize?.loginid) {
            if (response.authorize.loginid !== accountId) {
              ws!.send(JSON.stringify({ account_switch: accountId }));
            } else {
              ws!.send(JSON.stringify({ sell: contractId, price: price }));
            }
          } else {
            cleanupAndLog('Authorization failed.', true);
            reject(new Error(`Authorization failed for sellContract on account ${accountId}.`));
          }
        } else if (response.msg_type === 'account_switch') {
          if (response.error) {
            cleanupAndLog(`Error switching account to ${accountId}: ${response.error.message}`, true);
            reject(new Error(response.error.message || `Failed to switch to Deriv account ${accountId} for selling.`));
            return;
          }
          const switchedToLoginId = response.account_switch?.current_loginid || response.account_switch?.loginid;
          if (switchedToLoginId === accountId) {
            ws!.send(JSON.stringify({ sell: contractId, price: price }));
          } else {
            cleanupAndLog(`Failed to switch to account ${accountId}. Active: ${switchedToLoginId}`, true);
            reject(new Error(`Failed to switch to Deriv account ${accountId} for selling contract.`));
          }
        } else if (response.msg_type === 'sell') {
          cleanupAndLog(`Sell request for contract ${contractId} processed. Sell price: ${response.sell?.sell_price}`);
          resolve(response as DerivSellResponse);
        }
      } catch (e: any) {
        cleanupAndLog(`Error processing message: ${e?.message || String(e)}`, true);
        reject(e);
      }
    };
    ws.onerror = (event) => { reject(new Error('WS error')); cleanupAndLog('WS error', true); };
    ws.onclose = (event) => { cleanupAndLog('WS closed'); }; // Consider if rejection is needed on unexpected close
  });

  return Promise.race([
    promiseLogic,
    new Promise<DerivSellResponse>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        const reason = `sellContract operation timed out for ${contractId}`;
        cleanupAndLog(reason, true);
        reject(new Error(reason));
      }, operationTimeout);
    })
  ]);
}

export async function getContractStatus(
  contractId: number,
  token: string,
  accountId: string
): Promise<DerivContractStatusData> {
  let ws: WebSocket | null = null;
  const operationTimeout = 15000;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  const startTime = Date.now();

  const cleanupAndLog = (logMessage: string, isError: boolean = false, wsToClose: WebSocket | null = ws) => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    const duration = Date.now() - startTime;
    const fullLogMessage = `[DerivService/getContractStatus] ContractID: ${contractId}, AccountID: ${accountId}. ${logMessage}. Duration: ${duration}ms.`;
    if (isError) console.error(fullLogMessage);
    else console.log(fullLogMessage);
    if (wsToClose && wsToClose.readyState !== WebSocket.CLOSED && wsToClose.readyState !== WebSocket.CLOSING) {
      wsToClose.close(1000, logMessage.substring(0, 100));
    }
  };

  const promiseLogic = new Promise<DerivContractStatusData>((resolve, reject) => {
    ws = new WebSocket(DERIV_API_URL);

    ws.onopen = () => {
      ws!.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        if (response.error) {
          cleanupAndLog(`API Error: ${response.error.message}`, true);
          reject(new Error(response.error.message || `Deriv API error for contract ${contractId}`));
          return;
        }
        if (response.msg_type === 'authorize') {
          if (response.authorize?.loginid) {
            if (response.authorize.loginid !== accountId) {
              ws!.send(JSON.stringify({ account_switch: accountId }));
            } else {
              ws!.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId }));
            }
          } else {
            cleanupAndLog('Authorization failed.', true);
            reject(new Error(`Authorization failed for getContractStatus on account ${accountId}.`));
          }
        } else if (response.msg_type === 'account_switch') {
          if (response.error) {
            cleanupAndLog(`Error switching to account ${accountId}: ${response.error.message}`, true);
            reject(new Error(response.error.message || `Failed to switch to Deriv account ${accountId}.`));
            return;
          }
          const switchedToLoginId = response.account_switch?.current_loginid || response.account_switch?.loginid;
          if (switchedToLoginId === accountId) {
            ws!.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId }));
          } else {
            cleanupAndLog(`Failed to switch to account ${accountId}. Active: ${switchedToLoginId}`, true);
            reject(new Error(`Failed to switch to Deriv account ${accountId} for contract status.`));
          }
        } else if (response.msg_type === 'proposal_open_contract') {
          if (response.proposal_open_contract && response.proposal_open_contract.contract_id === contractId) {
            cleanupAndLog(`Status received for contract ${contractId}.`);
            resolve(response.proposal_open_contract as DerivContractStatusData);
          } else if (response.proposal_open_contract) {
            cleanupAndLog(`Received status for wrong contract: ${response.proposal_open_contract.contract_id}`, true);
            reject(new Error(`Received status for wrong contract ID (expected ${contractId}).`));
          } else {
            cleanupAndLog(`Contract ${contractId} not found or error. ${response.error?.message || 'No proposal_open_contract data.'}`, true);
            reject(new Error(response.error?.message || `Contract ${contractId} not found or no data.`));
          }
        }
      } catch (e: any) {
        cleanupAndLog(`Error processing message: ${e?.message || String(e)}`, true);
        reject(e);
      }
    };
    ws.onerror = (event) => { reject(new Error('WS error')); cleanupAndLog('WS error', true); };
    ws.onclose = (event) => { cleanupAndLog('WS closed'); }; // Consider if rejection is needed on unexpected close
  });

  return Promise.race([
    promiseLogic,
    new Promise<DerivContractStatusData>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        const reason = `getContractStatus timed out for contract ${contractId}`;
        cleanupAndLog(reason, true);
        reject(new Error(reason));
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
  let timeoutId: ReturnType<typeof setTimeout>;
  let ws: WebSocket | null = null;

  const startTime = Date.now();
  console.log(`[DerivService/getDerivAccountBalance] Initiated for accountId: ${accountId} at ${new Date(startTime).toISOString()}`);

  let effectiveToken: string;
  const staticDemoToken = process.env.NEXT_PUBLIC_DERIV_API_TOKEN_DEMO;
  const staticRealToken = process.env.NEXT_PUBLIC_DERIV_API_TOKEN;

  if (accountId === 'VRTC13200397' && staticDemoToken) {
    effectiveToken = staticDemoToken;
    console.log(`[DerivService/getDerivAccountBalance] Using static demo token for account ${accountId}.`);
  } else if (accountId === 'CR8821305' && staticRealToken) {
    effectiveToken = staticRealToken;
    console.log(`[DerivService/getDerivAccountBalance] Using static real token (from NEXT_PUBLIC_DERIV_API_TOKEN) for account ${accountId}.`);
  } else {
    effectiveToken = token;
    console.log(`[DerivService/getDerivAccountBalance] Using dynamic session token for account ${accountId}.`);
    if (accountId === 'VRTC13200397' && !staticDemoToken) {
      console.warn(`[DerivService/getDerivAccountBalance] Static demo token (NEXT_PUBLIC_DERIV_API_TOKEN_DEMO) not found for VRTC13200397, falling back to session token.`);
    }
    if (accountId === 'CR8821305' && !staticRealToken) {
       console.warn(`[DerivService/getDerivAccountBalance] Static real token (NEXT_PUBLIC_DERIV_API_TOKEN) not found for CR8821305, falling back to session token.`);
    }
  }

  if (!effectiveToken) {
    const errorMessage = `[DerivService/getDerivAccountBalance] No effective API token available for account ${accountId}.`;
    console.error(errorMessage);
    return Promise.reject(new Error(errorMessage.substring(errorMessage.indexOf("No effective API token"))));
  }

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
        wsToClose.close(1000, logMessage.substring(0, 100));
      }
    };

    ws.onopen = () => {
      const openTime = Date.now();
      console.log(`[DerivService/getDerivAccountBalance] WebSocket opened for accountId: ${accountId} at ${new Date(openTime).toISOString()}. Time to open: ${openTime - startTime}ms.`);
      console.log(`[DerivService/getDerivAccountBalance] Sending authorize request with effective token for accountId: ${accountId}.`);
      ws!.send(JSON.stringify({ authorize: effectiveToken }));
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
          if (response.authorize?.loginid === accountId) {
            console.log(`[DerivService/getDerivAccountBalance] Authorization successful with account-specific token for ${accountId}. User: ${response.authorize.loginid}. Sending balance request.`);
            ws!.send(JSON.stringify({ balance: 1, subscribe: 0 }));
          } else if (response.authorize?.loginid) {
            cleanupAndLog(`Authorization successful, but for unexpected account ${response.authorize.loginid} when targeting ${accountId}. This might indicate a token mismatch.`, true);
            reject(new Error(`Token authorized for ${response.authorize.loginid}, but expected ${accountId}.`));
          } else {
            cleanupAndLog(`Authorization failed for account ${accountId}. Response: ${JSON.stringify(response)}`, true);
            reject(new Error(`Deriv authorization failed for account ${accountId}.`));
          }
        } else if (response.msg_type === 'balance') {
          console.log(`[DerivService/getDerivAccountBalance] Balance response received for ${accountId}.`);
          let targetAccountData;
          if (response.balance?.loginid === accountId) {
              targetAccountData = response.balance;
              console.log(`[DerivService/getDerivAccountBalance] Using main balance object for ${accountId} as it matches the authorized account.`);
          }

          if (targetAccountData) {
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
  symbol: string;
  contract_type: string;
  duration?: number;
  duration_unit?: "s" | "m" | "h" | "d" | "t";
  amount: number;
  currency: string;
  stop_loss?: number;
  take_profit?: number;
  basis: "stake" | "payout"; // Usually "stake"
  token: string; // API token

  // Optional parameters based on contract_type
  barrier?: string | number; // For Higher/Lower (price offset/value), Touch/No Touch (price offset/value), Digits Over/Under (predicted digit 0-9)
  // barrier2?: string | number; // For some contracts like Ends In/Out, not in current scope

  // For Multipliers (though not the primary focus now, good to keep if generalizing)
  multiplier?: number;
}

export interface DerivContractStatusData {
  contract_id: number;
  status: 'open' | 'won' | 'lost' | 'sold' | 'cancelled';
  profit: number;
  profit_percentage: number;
  buy_price: number;
  sell_price?: number;
  current_spot?: number;
  current_spot_time?: number;
  entry_spot?: number;
  exit_tick?: number;
  exit_tick_time?: number;
  is_valid_to_sell?: 0 | 1;
  is_settleable_now?: 0 | 1;
  is_expired?: 0 | 1;
  is_sold?: 0 | 1;
  longcode?: string;
  // Add any other fields from proposal_open_contract you need
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
  let operationTimeout: ReturnType<typeof setTimeout> | null = null;
  let proposalId: string | null = null;
  let entrySpot: number | null = null;
  let proposalSubscriptionId: string | null = null; // Added this line
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
      console.log('[DerivService/placeTrade] Sending authorize request:', JSON.stringify({ authorize: tradeDetails.token ? 'TOKEN_PRESENT' : 'TOKEN_ABSENT' }));
      ws!.send(JSON.stringify({ authorize: tradeDetails.token }));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        // console.log(`[DerivService/placeTrade] Raw response for ${accountId}:`, JSON.stringify(response, null, 2));

        if (response.error) {
          console.error(`[DerivService/placeTrade] Full error response from Deriv:`, JSON.stringify(response, null, 2));

          // Check if this error is for a proposal that had a subscription
          if (response.echo_req?.proposal === 1 && response.subscription?.id) {
            console.log(`[DerivService/placeTrade] Forgetting subscription ${response.subscription.id} due to error in proposal response.`);
            if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ forget: response.subscription.id }));
          }
          // Check if this error is for a buy attempt AND we had a prior successful proposal subscription
          else if (response.echo_req?.buy && proposalSubscriptionId) {
            console.log(`[DerivService/placeTrade] Forgetting stored subscription ${proposalSubscriptionId} due to error in buy response.`);
            if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ forget: proposalSubscriptionId }));
            proposalSubscriptionId = null; // Clear it as we've actioned it
          }

          cleanupAndLog(`API Error: ${response.error.message}`, true); // cleanupAndLog also closes the WebSocket
          reject(new Error(response.error.message || `Deriv API error for account ${accountId}.`));
          return;
        }

        if (response.msg_type === 'authorize') {
          if (response.authorize?.loginid) {
            const currentLoginId = response.authorize.loginid;
            console.log(`[DerivService/placeTrade] Authorization successful. Token's current active account: ${currentLoginId}. Target account for trade: ${accountId}.`);

            if (currentLoginId !== accountId) {
              const errorMessage = `Session not active on target trade account. Current active: ${currentLoginId}, Target: ${accountId}. Please re-select account in UI or ensure Deriv session is active on target.`;
              console.error(`[DerivService/placeTrade] Account mismatch: ${errorMessage}`);
              cleanupAndLog(`Account mismatch: ${errorMessage}`, true); // cleanupAndLog is defined in placeTrade
              reject(new Error(errorMessage));
              return; // Stop further processing
            }

            // If we reach here, currentLoginId === accountId, so we are on the correct account.
            console.log(`[DerivService/placeTrade] Session already active on target account ${accountId}. Proceeding to proposal...`);

            // Construct and send proposal request
            const apiContractType = tradeDetails.contract_type;

            // Base proposal request
            const proposalRequest: any = {
              proposal: 1,
              subscribe: 1, // Subscribe to proposal updates
              amount: tradeDetails.amount,
              basis: tradeDetails.basis, // "stake" or "payout"
              contract_type: apiContractType,
              currency: tradeDetails.currency,
              symbol: tradeDetails.symbol,
            };

            // Add duration and duration_unit for contract types that require them
            // These are typically NOT used for Multipliers.
            if (apiContractType !== 'MULTUP' && apiContractType !== 'MULTDOWN') {
              if (tradeDetails.duration && tradeDetails.duration_unit) {
                proposalRequest.duration = tradeDetails.duration;
                proposalRequest.duration_unit = tradeDetails.duration_unit;
              } else {
                // For non-multiplier types, duration is usually mandatory.
                // For Digits, duration and duration_unit are critical.
                if (apiContractType.startsWith("DIGIT")) {
                    throw new Error(`Duration and duration_unit are required for ${apiContractType} contract. Symbol: ${tradeDetails.symbol}`);
                }
                console.warn(`[DerivService/placeTrade] Duration or duration_unit might be missing for non-multiplier contract ${apiContractType} on symbol ${tradeDetails.symbol}`);
              }
            }


            // Type-specific parameter handling for barriers and multipliers
            switch (apiContractType) {
              case 'CALL': // Rise/Fall (Rise), Higher/Lower (Higher)
              case 'PUT':  // Rise/Fall (Fall), Higher/Lower (Lower)
                if (tradeDetails.barrier !== undefined) { // For Higher/Lower
                  // Barrier for CALL/PUT (Higher/Lower) is a price level (string starting with +/-, or absolute)
                  proposalRequest.barrier = String(tradeDetails.barrier);
                }
                // No specific barrier for simple Rise/Fall (entry spot is implicit barrier)
                // product_type "basic" is usually needed for these options.
                proposalRequest.product_type = "basic";
                break;
              case 'ONETOUCH':
              case 'NOTOUCH':
                if (tradeDetails.barrier !== undefined) {
                  // Barrier for Touch/NoTouch is a price level (string starting with +/-, or absolute)
                  proposalRequest.barrier = String(tradeDetails.barrier);
                } else {
                  throw new Error(`Barrier is required for ${apiContractType} contract. Symbol: ${tradeDetails.symbol}`);
                }
                proposalRequest.product_type = "basic";
                break;
              case 'DIGITEVEN':
              case 'DIGITODD':
                // No 'barrier' parameter for these specific contract types in proposal.
                // Prediction is inherent in contract_type.
                // Duration must be in ticks.
                if (tradeDetails.duration_unit !== 't') {
                    throw new Error(`Duration unit must be 't' (ticks) for ${apiContractType}. Symbol: ${tradeDetails.symbol}`);
                }
                proposalRequest.product_type = "basic";
                break;
              case 'DIGITOVER':
              case 'DIGITUNDER':
                if (tradeDetails.barrier !== undefined &&
                    !isNaN(Number(tradeDetails.barrier)) &&
                    Number(tradeDetails.barrier) >= 0 && Number(tradeDetails.barrier) <= 9) {
                   // Barrier here is the predicted digit (0-9), sent as a string.
                  proposalRequest.barrier = String(Math.floor(Number(tradeDetails.barrier)));
                } else {
                  throw new Error(`A valid integer barrier (predicted digit 0-9) is required for ${apiContractType}. Symbol: ${tradeDetails.symbol}`);
                }
                 // Duration must be in ticks.
                if (tradeDetails.duration_unit !== 't') {
                    throw new Error(`Duration unit must be 't' (ticks) for ${apiContractType}. Symbol: ${tradeDetails.symbol}`);
                }
                proposalRequest.product_type = "basic";
                break;
              case 'MULTUP':
              case 'MULTDOWN':
                if (typeof tradeDetails.multiplier === 'number') {
                  proposalRequest.multiplier = tradeDetails.multiplier;
                } else {
                  throw new Error(`Multiplier is required for ${apiContractType} contract. Symbol: ${tradeDetails.symbol}`);
                }
                // Stop Loss and Take Profit for Multipliers
                if (tradeDetails.stop_loss !== undefined || tradeDetails.take_profit !== undefined) {
                  proposalRequest.limit_order = {};
                  if (tradeDetails.stop_loss !== undefined) {
                    proposalRequest.limit_order.stop_loss = tradeDetails.stop_loss;
                  }
                  if (tradeDetails.take_profit !== undefined) {
                    proposalRequest.limit_order.take_profit = tradeDetails.take_profit;
                  }
                }
                // product_type is NOT used for multipliers
                break;
              default:
                // This case should ideally not be hit if contract_type is validated upstream
                // or if all supported types are explicitly handled.
                cleanupAndLog(`Unsupported or unknown contract_type for proposal construction: ${apiContractType}. Symbol: ${tradeDetails.symbol}`, true);
                throw new Error(`Unsupported contract_type for proposal: ${apiContractType}`);
            }

            // Note: product_type="basic" is added within the switch for relevant cases.
            // If a contract type was missed, it might lack product_type if needed.

            console.log('[DerivService/placeTrade] Sending proposal request:', JSON.stringify(proposalRequest));
            ws!.send(JSON.stringify(proposalRequest));

          } else {
            // Authorization itself failed (e.g., invalid token)
            const authFailedMsg = 'Authorization failed. No loginid in response.';
            console.error(`[DerivService/placeTrade] ${authFailedMsg}`, JSON.stringify(response));
            cleanupAndLog(authFailedMsg, true);
            reject(new Error(authFailedMsg));
            return;
          }
        } else if (response.msg_type === 'proposal') {
            if (response.error) { // Explicit error in proposal response
                console.error(`[DerivService/placeTrade] Full error response on proposal (msg_type: proposal):`, JSON.stringify(response, null, 2));
                cleanupAndLog(`API Error on proposal: ${response.error.message}`, true);
                if (response.subscription && response.subscription.id) {
                    console.log('[DerivService/placeTrade] Attempting to forget subscription from erroring proposal:', response.subscription.id);
                    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ forget: response.subscription.id }));
                }
                reject(new Error(response.error.message || `Proposal API error for account ${accountId}. Details: ${response.error.code}`));
                return;
            }

            if (response.proposal && response.proposal.id && response.proposal.spot !== undefined) { // spot can be 0
              proposalId = response.proposal.id;
              entrySpot = response.proposal.spot;
              console.log(`[DerivService/placeTrade] Proposal received for account ${accountId}. ID: ${proposalId}, Proposal Spot: ${entrySpot}. Buying contract...`);

              if (response.subscription && response.subscription.id) {
                proposalSubscriptionId = response.subscription.id;
                console.log(`[DerivService/placeTrade] Stored proposal subscription ID: ${proposalSubscriptionId}`);
              }

              const buyRequest = { buy: proposalId, price: tradeDetails.amount };
              console.log(`[DerivService/placeTrade] Sending buy request for account ${accountId}:`, JSON.stringify(buyRequest));
              ws!.send(JSON.stringify(buyRequest));
            } else {
              const errorMsg = `Invalid proposal response structure for account ${accountId}. Proposal ID or Spot missing.`;
              cleanupAndLog(errorMsg + `: ${JSON.stringify(response)}`, true);
              if (response.subscription && response.subscription.id) {
                  console.log('[DerivService/placeTrade] Attempting to forget subscription from malformed proposal:', response.subscription.id);
                  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ forget: response.subscription.id }));
              }
              reject(new Error(errorMsg));
            }
        } else if (response.msg_type === 'buy') {
            let buyError = false;
            if (response.buy && response.buy.contract_id) { // Successful buy
              cleanupAndLog(`Contract purchased successfully on account ${accountId}: ${JSON.stringify(response.buy)}`);
              resolve({
                contract_id: response.buy.contract_id,
                buy_price: response.buy.buy_price,
                longcode: response.buy.longcode,
                entry_spot: entrySpot !== null ? entrySpot : (response.buy.purchase_time_spot !== undefined ? response.buy.purchase_time_spot : 0),
              });
            } else { // Error in buy response or malformed success
              buyError = true;
              // Error should have been caught by the top-level if(response.error)
              // This branch handles cases where `response.error` is not set but `response.buy` is malformed.
              const errorMsg = response.error?.message || `Malformed buy response on account ${accountId}. Contract ID missing.`;
              console.error(`[DerivService/placeTrade] Buy Error/Malformed: ${errorMsg}`, JSON.stringify(response));
              cleanupAndLog(`Buy Error/Malformed: ${errorMsg}`, true);
              reject(new Error(errorMsg));
            }

            if (proposalSubscriptionId) {
              console.log(`[DerivService/placeTrade] Forgetting subscription ${proposalSubscriptionId} after buy message processed (Error: ${buyError}).`);
              if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ forget: proposalSubscriptionId }));
              proposalSubscriptionId = null;
            }
        } else {
          console.log(`[DerivService/placeTrade] Received other message type for ${accountId}: ${response.msg_type}`, response);
        }
      } catch (e: any) {
        cleanupAndLog(`Error processing message for account ${accountId}: ${e?.message || String(e)}`, true);
        if (proposalSubscriptionId) {
            console.log(`[DerivService/placeTrade] Attempting to forget active subscription ${proposalSubscriptionId} due to processing error.`);
            if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ forget: proposalSubscriptionId }));
            proposalSubscriptionId = null;
        }
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
      if (proposalSubscriptionId) {
          console.log(`[DerivService/placeTrade] WebSocket error occurred with active proposal subscription ${proposalSubscriptionId}. It is now implicitly forgotten.`);
          proposalSubscriptionId = null;
      }
      reject(new Error(errorMessage));
    };

    ws.onclose = (event) => {
      const duration = Date.now() - startTime;
      console.log(`[DerivService/placeTrade] WebSocket connection closed for accountId: ${accountId}. Code: ${event.code}, Reason: '${event.reason}', WasClean: ${event.wasClean}. Duration: ${duration}ms.`);
      if (operationTimeout) clearTimeout(operationTimeout);
      if (proposalSubscriptionId) {
          console.log(`[DerivService/placeTrade] WebSocket closed with active proposal subscription ${proposalSubscriptionId}. It is now implicitly forgotten.`);
          proposalSubscriptionId = null;
      }
    };
  });

  return Promise.race([
    promiseLogic,
    new Promise<PlaceTradeResponse>((_, reject) => {
      operationTimeout = setTimeout(() => {
        const reason = `Trade operation timed out after ${timeoutDuration / 1000} seconds for accountId: ${accountId}.`;
        console.error(`[DerivService/placeTrade] Timeout: ${reason}`);
        if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
          console.log(`[DerivService/placeTrade] Timeout: Attempting to close WebSocket for accountId: ${accountId}.`);
          ws.close(1000, "Operation timed out");
        } else if (!ws) {
           console.log(`[DerivService/placeTrade] Timeout: WebSocket instance was null for accountId: ${accountId}.`);
        }
        if (proposalSubscriptionId) {
            console.log(`[DerivService/placeTrade] Timeout occurred with active proposal subscription ${proposalSubscriptionId}. It is now implicitly forgotten.`);
            proposalSubscriptionId = null;
        }
        reject(new Error(reason));
      }, timeoutDuration);
    })
  ]);
}


/**
              const limitOrderDetails: any = {};
              if (typeof tradeDetails.take_profit === 'number') {
                limitOrderDetails.take_profit = tradeDetails.take_profit;
              }
              if (typeof tradeDetails.stop_loss === 'number') {
                limitOrderDetails.stop_loss = tradeDetails.stop_loss;
              }
              if (Object.keys(limitOrderDetails).length > 0) {
                proposalRequest.limit_order = limitOrderDetails;
              }
            }

            console.log('[DerivService/placeTrade] Sending proposal request:', JSON.stringify(proposalRequest));
            ws!.send(JSON.stringify(proposalRequest));

          } else {
            // Authorization itself failed (e.g., invalid token)
            const authFailedMsg = 'Authorization failed. No loginid in response.';
            console.error(`[DerivService/placeTrade] ${authFailedMsg}`, JSON.stringify(response));
            cleanupAndLog(authFailedMsg, true);
            reject(new Error(authFailedMsg));
            return;
          }
        } else if (response.msg_type === 'proposal') {
            // This path is for successful proposal or malformed successful proposal.
            // Errors in proposal response (e.g. "Trading not offered for this duration") should be caught by the top-level if(response.error)
            // However, adding a redundant check here for safety as per prompt.
            if (response.error) {
                console.error(`[DerivService/placeTrade] Full error response on proposal (msg_type: proposal):`, JSON.stringify(response, null, 2));
                cleanupAndLog(`API Error on proposal: ${response.error.message}`, true);
                if (response.subscription && response.subscription.id) {
                    console.log('[DerivService/placeTrade] Attempting to forget subscription from erroring proposal:', response.subscription.id);
                    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ forget: response.subscription.id }));
                }
                reject(new Error(response.error.message || `Proposal API error for account ${accountId}.`));
                return;
            }

            if (response.proposal && response.proposal.id && response.proposal.spot) {
              proposalId = response.proposal.id;
              entrySpot = response.proposal.spot;
              console.log(`[DerivService/placeTrade] Proposal received for account ${accountId}. ID: ${proposalId}, Entry Spot: ${entrySpot}. Buying contract...`);

              if (response.subscription && response.subscription.id) {
                proposalSubscriptionId = response.subscription.id; // Store it
                console.log(`[DerivService/placeTrade] Stored proposal subscription ID: ${proposalSubscriptionId}`);
                // DO NOT send forget here.
              }

              const buyRequest = { buy: proposalId, price: tradeDetails.amount };
              console.log(`[DerivService/placeTrade] Sending buy request for account ${accountId}:`, JSON.stringify(buyRequest));
              ws!.send(JSON.stringify(buyRequest));
            } else {
              // Invalid proposal response structure (e.g. missing proposal.id or proposal.spot on a success message)
              const errorMsg = `Invalid proposal response structure for account ${accountId}.`;
              cleanupAndLog(errorMsg + `: ${JSON.stringify(response)}`, true);
              // If there was a subscription ID in a malformed proposal, try to forget it.
              if (response.subscription && response.subscription.id) {
                  console.log('[DerivService/placeTrade] Attempting to forget subscription from malformed proposal:', response.subscription.id);
                  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ forget: response.subscription.id }));
              }
              reject(new Error(errorMsg));
            }
        } else if (response.msg_type === 'buy') {
            let buyError = false;
            if (response.buy && response.buy.contract_id) {
              // Successful buy
              cleanupAndLog(`Contract purchased successfully on account ${accountId}: ${JSON.stringify(response.buy)}`);
              resolve({
                contract_id: response.buy.contract_id,
                buy_price: response.buy.buy_price,
                longcode: response.buy.longcode,
                entry_spot: entrySpot!,
              });
            } else {
              // Malformed buy success response (should ideally be an error caught by top handler)
              buyError = true;
              const errorMsg = `Malformed buy success response on account ${accountId}.`;
              cleanupAndLog(errorMsg + `: ${JSON.stringify(response)}`, true);
              reject(new Error(errorMsg));
            }

            // After resolve or reject for the buy message
            if (proposalSubscriptionId) {
              console.log(`[DerivService/placeTrade] Forgetting subscription ${proposalSubscriptionId} after buy message processed (Error: ${buyError}).`);
              if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ forget: proposalSubscriptionId }));
              proposalSubscriptionId = null;
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
