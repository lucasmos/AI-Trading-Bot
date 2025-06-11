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
  const ws = new WebSocket(DERIV_API_URL);
  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log('[DerivService/getDerivAccountList] Sending account_list request.');
      ws.send(JSON.stringify({ authorize: token })); // Authorize first
      setTimeout(() => {
        ws.send(JSON.stringify({ account_list: 1 }));
      }, 500); // Small delay after authorization
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        console.log('[DerivService/getDerivAccountList] Received response:', response);
        if (response.error) {
          console.error('[DerivService/getDerivAccountList] API Error:', response.error);
          reject(new Error(response.error.message || 'Failed to get account list'));
        } else if (response.msg_type === 'account_list') {
          resolve(response);
        }
      } catch (e) {
        console.error('[DerivService/getDerivAccountList] Error processing message:', e);
        reject(e);
      } finally {
        ws.close();
      }
    };

    ws.onerror = (event) => {
      console.error('[DerivService/getDerivAccountList] WebSocket Error:', event);
      reject(new Error('WebSocket error during account list fetch'));
      ws.close();
    };
  });
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
 * Places a trade on the Deriv API.
 * @param tradeDetails The details of the trade to place.
 * @returns A promise that resolves with the contract details or rejects with an error.
 */
export async function placeTrade(tradeDetails: TradeDetails): Promise<PlaceTradeResponse> {
  const ws = new WebSocket(DERIV_API_URL);
  // Using a Promise to handle WebSocket interactions asynchronously
  return new Promise((resolve, reject) => {
    let proposalId: string | null = null;
    let entrySpot: number | null = null;
    const timeoutDuration = 15000; // 15 seconds for the entire operation

    const operationTimeout = setTimeout(() => {
      console.error('[DerivService/placeTrade] Operation timed out.');
      ws.close();
      reject(new Error('Trade operation timed out.'));
    }, timeoutDuration);

    ws.onopen = () => {
      console.log('[DerivService/placeTrade] WebSocket connection opened. Authorizing...');
      ws.send(JSON.stringify({ authorize: tradeDetails.token }));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        console.log('[DerivService/placeTrade] Received response:', response);

        if (response.error) {
          console.error('[DerivService/placeTrade] API Error:', response.error);
          clearTimeout(operationTimeout);
          ws.close();
          reject(new Error(response.error.message || 'Unknown API error during trade placement.'));
          return;
        }

        if (response.msg_type === 'authorize') {
          if (response.authorize?.loginid) {
            console.log('[DerivService/placeTrade] Authorization successful. Requesting proposal...');

            let apiContractType: "CALL" | "PUT";
            if (tradeDetails.contract_type === 'CALL') {
              apiContractType = 'PUT'; // User's CALL (predicts rise) maps to Deriv's PUT for Rise/Fall
            } else { // Assuming it's 'PUT'
              apiContractType = 'CALL'; // User's PUT (predicts fall) maps to Deriv's CALL for Rise/Fall
            }

            const proposalRequest: any = {
              proposal: 1,
              subscribe: 1, // Useful to get updates, can be removed if not needed
              amount: tradeDetails.amount,
              basis: tradeDetails.basis,
              contract_type: apiContractType,
              currency: tradeDetails.currency,
              duration: tradeDetails.duration,
              duration_unit: tradeDetails.duration_unit,
              symbol: tradeDetails.symbol,
            };

            // Removed conditional stop_loss and take_profit addition
            // if (tradeDetails.stop_loss !== undefined) {
            //   proposalRequest.stop_loss = tradeDetails.stop_loss;
            // }
            // if (tradeDetails.take_profit !== undefined) {
            //   proposalRequest.take_profit = tradeDetails.take_profit;
            // }

            console.log('[DerivService/placeTrade] Sending proposal request:', proposalRequest);
            ws.send(JSON.stringify(proposalRequest));
          } else {
            console.error('[DerivService/placeTrade] Authorization failed:', response);
            clearTimeout(operationTimeout);
            ws.close();
            reject(new Error('Authorization failed.'));
          }
        } else if (response.msg_type === 'proposal') {
          if (response.proposal && response.proposal.id && response.proposal.spot) {
            proposalId = response.proposal.id;
            entrySpot = response.proposal.spot; // Store the spot price from proposal
            console.log(`[DerivService/placeTrade] Proposal received. ID: ${proposalId}, Entry Spot: ${entrySpot}. Buying contract...`);

            // Unsubscribe from proposal stream if it was subscribed
            if (response.subscription && response.subscription.id) {
              ws.send(JSON.stringify({ forget: response.subscription.id }));
            }

            const buyRequest = {
              buy: proposalId,
              price: tradeDetails.amount, // This should match the amount in the proposal
              // subscribe: 1 // Optional: if you want updates on this specific contract
            };
            console.log('[DerivService/placeTrade] Sending buy request:', buyRequest);
            ws.send(JSON.stringify(buyRequest));
          } else {
            console.error('[DerivService/placeTrade] Invalid proposal response:', response);
            clearTimeout(operationTimeout);
            ws.close();
            reject(new Error('Invalid proposal response received from Deriv API.'));
          }
        } else if (response.msg_type === 'buy') {
          if (response.buy && response.buy.contract_id) {
            console.log('[DerivService/placeTrade] Contract purchased successfully:', response.buy);
            clearTimeout(operationTimeout);

            // Unsubscribe from buy stream if it was subscribed (if subscribe:1 was added to buy request)
            // if (response.subscription && response.subscription.id) {
            //   ws.send(JSON.stringify({ forget: response.subscription.id }));
            // }

            ws.close();
            resolve({
              contract_id: response.buy.contract_id,
              buy_price: response.buy.buy_price,
              longcode: response.buy.longcode,
              entry_spot: entrySpot!, // Non-null assertion as it's set when proposal is valid
            });
          } else {
            console.error('[DerivService/placeTrade] Buy contract error:', response);
            clearTimeout(operationTimeout);
            ws.close();
            reject(new Error(response.error?.message || 'Failed to buy contract.'));
          }
        }
      } catch (e) {
        console.error('[DerivService/placeTrade] Error processing message:', e);
        clearTimeout(operationTimeout);
        ws.close();
        reject(e instanceof Error ? e : new Error('Failed to process message from Deriv API.'));
      }
    };

    ws.onerror = (event) => {
      let errorMessage = 'WebSocket error during trade placement.';
       if (event && typeof event === 'object') {
        if ('message' in event && (event as any).message) {
            errorMessage = `WebSocket Error: ${(event as any).message}`;
        } else {
            errorMessage = `WebSocket Error: type=${event.type}. Check console for details.`;
        }
      }
      console.error('[DerivService/placeTrade] WebSocket Error Event:', event);
      clearTimeout(operationTimeout);
      ws.close(); // Ensure closed on error
      reject(new Error(errorMessage));
    };

    ws.onclose = (event) => {
      console.log('[DerivService/placeTrade] WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
      clearTimeout(operationTimeout); // Clear timeout if connection closes prematurely for other reasons
      // If the promise hasn't been resolved/rejected yet, it might mean an unexpected closure
      // For example, if it closes before 'buy' response after 'proposal' was successful
      // This specific case needs careful handling or could be part of the timeout logic
    };
  });
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
