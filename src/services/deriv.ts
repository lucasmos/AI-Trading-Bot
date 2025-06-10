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
  granularity: number = 60
): Promise<CandleData[]> {
  console.log('[DerivService/getCandles Client-Side Check] process.env.NEXT_PUBLIC_DERIV_WS_URL inside getCandles:', process.env.NEXT_PUBLIC_DERIV_WS_URL);
  console.log('[DerivService/getCandles Client-Side Check] process.env.NEXT_PUBLIC_DERIV_APP_ID inside getCandles:', process.env.NEXT_PUBLIC_DERIV_APP_ID);
  console.log('[DerivService/getCandles Client-Side Check] DERIV_API_URL inside getCandles:', DERIV_API_URL);
  // Get the correct symbol for the Deriv API
  const symbol = instrumentToDerivSymbol(instrument);
  const decimalPlaces = getInstrumentDecimalPlaces(instrument);

  const ws = new WebSocket(DERIV_API_URL);

  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      // First authorize if we have a token
      if (DERIV_API_TOKEN) {
        ws.send(JSON.stringify({ authorize: DERIV_API_TOKEN }));
      }

      // Wait a short moment after authorization before sending the ticks request
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
      }, DERIV_API_TOKEN ? 1000 : 0); // Wait 1 second if we need to authorize
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        console.log('[DerivService/getCandles] Received response:', response);
        
        if (response.error) {
          console.error('[DerivService/getCandles] API Error:', response.error);
          reject(new Error(response.error.message || 'Unknown API error'));
          ws.close();
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
          resolve(candles.slice(-count));
          ws.close();
        } else if (response.msg_type === 'authorize') {
          if (response.error) {
            console.error('[DerivService/getCandles] Authorization Error:', response.error);
            reject(new Error(`Authorization failed: ${response.error.message}`));
            ws.close();
        }
          // Successfully authorized, waiting for candles
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

            const proposalRequest: any = {
              proposal: 1,
              subscribe: 1, // Useful to get updates, can be removed if not needed
              amount: tradeDetails.amount,
              basis: tradeDetails.basis,
              contract_type: tradeDetails.contract_type,
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
