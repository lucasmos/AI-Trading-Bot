// import WebSocket from 'ws'; // Removed: 'ws' is for Node.js, browser has native WebSocket
// Types import - ensuring CandleData is recognized
import type { InstrumentType, PriceTick, CandleData } from '@/types';
import { getInstrumentDecimalPlaces } from '@/lib/utils';

let derivAppIdForUrl = process.env.NEXT_PUBLIC_DERIV_APP_ID;
if (!derivAppIdForUrl) {
  console.error("CRITICAL: NEXT_PUBLIC_DERIV_APP_ID is not set for Deriv API URL construction in deriv.ts. WebSocket connections for market data may fail or use an invalid App ID.");
  // Using a placeholder that will intentionally fail, to make missing configuration obvious.
  // In a real production scenario, you might throw an error or have a different handling strategy.
  derivAppIdForUrl = 'APP_ID_NOT_CONFIGURED';
}
const DERIV_API_URL = `wss://ws.derivws.com/websockets/v3?app_id=${derivAppIdForUrl}`;
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
const instrumentToDerivSymbol = (instrument: InstrumentType): string => {
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
  userAccessToken?: string // <<< NEW OPTIONAL PARAMETER
): Promise<CandleData[]> {
  // Get the correct symbol for the Deriv API
  const symbol = instrumentToDerivSymbol(instrument);
  const decimalPlaces = getInstrumentDecimalPlaces(instrument);

  const ws = new WebSocket(DERIV_API_URL); // DERIV_API_URL uses NEXT_PUBLIC_DERIV_APP_ID

  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      const tokenToUse = userAccessToken || DERIV_API_TOKEN; // Use user's token if provided, else global

      if (tokenToUse) {
        console.log(`[DerivService/getCandles] Authorizing with token: ${typeof userAccessToken === 'string' ? 'USER_TOKEN' : 'GLOBAL_DEMO_TOKEN'}`);
        ws.send(JSON.stringify({ authorize: tokenToUse }));
      }

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
      }, tokenToUse ? 1000 : 0); // Wait if authorization was attempted
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data as string);
        // console.log('[DerivService/getCandles] Received response:', response); // Keep existing log or adjust
        
        if (response.error) {
          console.error('[DerivService/getCandles] API Error:', response.error.message, response.error.code);
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
            console.error('[DerivService/getCandles] Authorization Error:', response.error.message, response.error.code);
            reject(new Error(`Authorization failed: ${response.error.message}`));
            ws.close();
          } else {
            console.log('[DerivService/getCandles] Authorized successfully for candles request.');
          }
          // Successfully authorized (or already was), waiting for candles
        }
      } catch (e) {
        console.error('[DerivService/getCandles] Error processing message:', e);
        reject(e);
        ws.close();
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
      reject(new Error(errorMessage));
      ws.close();
    };

    ws.onclose = (event) => {
      console.log('[DerivService/getCandles] WebSocket connection closed. Code:', event.code, 'Reason:', event.reason ? event.reason.toString() : 'N/A');
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

// --- New Additions Start Here ---

export interface DerivProposalRequest {
  proposal: 1;
  subscribe?: 1;
  amount: number;
  basis: 'payout' | 'stake';
  contract_type: 'CALL' | 'PUT' | 'DIGITMATCH' | 'DIGITDIFF' | string;
  currency: string;
  symbol: string;
  duration: number;
  duration_unit: 's' | 'm' | 'h' | 'd' | 't';
  barrier?: string | number;
  loginid?: string;
}

export interface DerivProposalResponse {
  echo_req: DerivProposalRequest & { [key: string]: any };
  proposal?: {
    ask_price: number;
    display_value: string;
    id: string;
    longcode: string;
    payout: number;
    spot: number;
    spot_time: number;
  };
  subscription?: {
    id: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  msg_type: 'proposal' | string;
}

export interface DerivBuyRequest {
  buy: string;
  price: number;
  loginid?: string;
}

export interface DerivBuyResponse {
  echo_req: DerivBuyRequest & { [key: string]: any };
  buy?: {
    contract_id: number;
    longcode: string;
    payout: number;
    purchase_time: number;
    shortcode: string;
    start_time: number;
    buy_price: number;
    transaction_id: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  msg_type: 'buy' | string;
}

// --- Interfaces for getContractUpdateInfo ---
export interface DerivOpenContractRequest {
  proposal_open_contract: 1;
  contract_id: number;
  subscribe?: 0 | 1;
}

export interface DerivOpenContractResponse {
  echo_req: DerivOpenContractRequest & { [key: string]: any };
  proposal_open_contract?: {
    contract_id: number;
    buy_price: number;
    sell_price?: number;
    profit?: number;
    status: 'open' | 'sold' | 'won' | 'lost' | 'cancelled' | string;
    is_valid_to_sell?: 0 | 1;
    is_expired?: 0 | 1;
    is_settleable?: 0 | 1;
    profit_percentage?: number;
    sell_time?: number;
    validation_error?: string;
  };
  subscription?: {
    id: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  msg_type: 'proposal_open_contract' | string;
}


const DERIV_SERVICE_TIMEOUT_MS = 20000;

async function makeDerivApiRequest<TResponse>(
  userAccessToken: string,
  requestPayload: object,
  expectedResponseType: string
): Promise<TResponse> {
  if (!userAccessToken) {
    return Promise.reject(new Error('User access token is required for Deriv API request.'));
  }
  if (!process.env.NEXT_PUBLIC_DERIV_APP_ID) {
    console.error("CRITICAL: NEXT_PUBLIC_DERIV_APP_ID is not set for Deriv API URL construction in makeDerivApiRequest.");
    return Promise.reject(new Error('Deriv App ID is not configured.'));
  }

  const ws = new WebSocket(DERIV_API_URL);

  return new Promise<TResponse>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let authorized = false;

    const cleanupAndReject = (error: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      reject(error);
    };

    const cleanupAndResolve = (data: TResponse) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
         ws.close();
      }
      resolve(data);
    };

    ws.onopen = () => {
      console.log(`[DerivService/makeDerivApiRequest] WebSocket open. Authorizing for ${expectedResponseType} request.`);
      ws.send(JSON.stringify({ authorize: userAccessToken }));
    };

    ws.onmessage = (event) => {
      const rawData = event.data.toString();
      try {
        const response = JSON.parse(rawData);

        if (response.error) {
          console.error(`[DerivService/makeDerivApiRequest] API Error for ${expectedResponseType}:`, response.error);
          cleanupAndReject(new Error(`Deriv API Error (${response.error.code}): ${response.error.message}`));
          return;
        }

        if (response.msg_type === 'authorize') {
          if (response.authorize) {
            console.log(`[DerivService/makeDerivApiRequest] Authorized for ${expectedResponseType}. Sending actual request.`);
            authorized = true;
            ws.send(JSON.stringify(requestPayload));
          } else {
            console.error(`[DerivService/makeDerivApiRequest] Authorization failed for ${expectedResponseType}:`, response);
            cleanupAndReject(new Error('Deriv authorization failed.'));
          }
        } else if (response.msg_type === expectedResponseType) {
          console.log(`[DerivService/makeDerivApiRequest] Received expected response type ${expectedResponseType}:`, response);
          cleanupAndResolve(response as TResponse);
        } else {
          console.log(`[DerivService/makeDerivApiRequest] Received other message type ${response.msg_type} for ${expectedResponseType}, ignoring. Full response:`, response);
        }
      } catch (e) {
        console.error(`[DerivService/makeDerivApiRequest] Error processing message for ${expectedResponseType}:`, e, "Raw data:", rawData);
        cleanupAndReject(e instanceof Error ? e : new Error('Failed to process message from Deriv.'));
      }
    };

    ws.onerror = (errorEvent) => {
      console.error(`[DerivService/makeDerivApiRequest] WebSocket error for ${expectedResponseType}:`, errorEvent);
      cleanupAndReject(new Error('WebSocket connection error.'));
    };

    ws.onclose = (event) => {
      console.log(`[DerivService/makeDerivApiRequest] WebSocket closed for ${expectedResponseType}. Code: ${event.code}, Reason: ${event.reason ? event.reason.toString() : 'N/A'}`);
    };

    timeoutId = setTimeout(() => {
      console.warn(`[DerivService/makeDerivApiRequest] Interaction timed out for ${expectedResponseType} after ${DERIV_SERVICE_TIMEOUT_MS}ms.`);
      cleanupAndReject(new Error(`Deriv API interaction for ${expectedResponseType} timed out.`));
    }, DERIV_SERVICE_TIMEOUT_MS);
  });
}

export async function getTradeProposal(
  userAccessToken: string,
  request: DerivProposalRequest
): Promise<DerivProposalResponse> {
  console.log('[DerivService/getTradeProposal] Requesting trade proposal:', request);
  return makeDerivApiRequest<DerivProposalResponse>(userAccessToken, { ...request, proposal: 1 }, 'proposal');
}

export async function buyContract(
  userAccessToken: string,
  request: DerivBuyRequest
): Promise<DerivBuyResponse> {
  console.log('[DerivService/buyContract] Requesting to buy contract:', request);
  return makeDerivApiRequest<DerivBuyResponse>(userAccessToken, { ...request, buy: request.buy }, 'buy');
}

/**
 * Fetches the current status and details of an open contract from Deriv API.
 * @param userAccessToken The user's Deriv API token.
 * @param contractId The ID of the contract to check.
 * @returns A promise that resolves to the contract status response.
 */
export async function getContractUpdateInfo(
  userAccessToken: string,
  contractId: number
): Promise<DerivOpenContractResponse> {
  console.log(`[DerivService/getContractUpdateInfo] Requesting update for contract ID: ${contractId}`);
  const requestPayload: DerivOpenContractRequest = {
    proposal_open_contract: 1,
    contract_id: contractId,
    // subscribe: 0, // For a one-time fetch. Remove or set to 1 for streaming.
  };
  // The generic handler will wait for a msg_type matching 'proposal_open_contract'.
  return makeDerivApiRequest<DerivOpenContractResponse>(userAccessToken, requestPayload, 'proposal_open_contract');
}

// TODO: Implement getContractOutcome (or similar for proposal_open_contract) - This comment was part of the previous addition.
// export async function getContractOutcome(userAccessToken: string, contractId: number): Promise<any> {
//   console.log('[DerivService/getContractOutcome] Requesting outcome for contract:', contractId);
//   const payload = { proposal_open_contract: 1, contract_id: contractId, subscribe: 0 };
//   return makeDerivApiRequest<any>(userAccessToken, payload, 'proposal_open_contract');
// }
