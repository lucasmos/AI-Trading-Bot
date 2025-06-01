import type { 
  ForexCryptoCommodityInstrumentType, 
  VolatilityInstrumentType,
  TradingInstrument 
} from '../types'; // Adjust path if your types file is elsewhere relative to src/config

/**
 * Array of supported Forex, Crypto, and Commodity instruments.
 * These should match the string literals defined in ForexCryptoCommodityInstrumentType.
 */
export const FOREX_CRYPTO_COMMODITY_INSTRUMENTS: ForexCryptoCommodityInstrumentType[] = [
  'EUR/USD', 
  'GBP/USD', 
  'BTC/USD', 
  'XAU/USD', 
  'ETH/USD'
];

/**
 * Array of supported Volatility Index instruments.
 * These should match the string literals defined in VolatilityInstrumentType.
 */
export const VOLATILITY_INSTRUMENTS: VolatilityInstrumentType[] = [
  'Volatility 10 Index',
  'Volatility 25 Index',
  'Volatility 50 Index',
  'Volatility 75 Index',
  'Volatility 100 Index'
];

/**
 * Represents a supported instrument with its type.
 */
export interface SupportedInstrument {
  id: TradingInstrument;
  name: string; // User-friendly name
  type: 'Forex' | 'Crypto' | 'Commodity' | 'Volatility';
  defaultDecimalPlaces: number;
}

/**
 * Comprehensive list of all supported instruments by the platform.
 * This array is used throughout the application to populate instrument selectors,
 * fetch data, and guide AI anlysis.
 */
export const SUPPORTED_INSTRUMENTS: SupportedInstrument[] = [
  // Forex
  { id: 'EUR/USD', name: 'EUR/USD', type: 'Forex', defaultDecimalPlaces: 5 },
  { id: 'GBP/USD', name: 'GBP/USD', type: 'Forex', defaultDecimalPlaces: 5 },
  // Crypto
  { id: 'BTC/USD', name: 'BTC/USD', type: 'Crypto', defaultDecimalPlaces: 2 },
  { id: 'ETH/USD', name: 'ETH/USD', type: 'Crypto', defaultDecimalPlaces: 2 },
  // Commodities
  { id: 'XAU/USD', name: 'Gold (XAU/USD)', type: 'Commodity', defaultDecimalPlaces: 2 },
  // Volatility Indices
  { id: 'Volatility 10 Index', name: 'Volatility 10 Index', type: 'Volatility', defaultDecimalPlaces: 3 },
  { id: 'Volatility 25 Index', name: 'Volatility 25 Index', type: 'Volatility', defaultDecimalPlaces: 3 },
  { id: 'Volatility 50 Index', name: 'Volatility 50 Index', type: 'Volatility', defaultDecimalPlaces: 2 },
  { id: 'Volatility 75 Index', name: 'Volatility 75 Index', type: 'Volatility', defaultDecimalPlaces: 4 },
  { id: 'Volatility 100 Index', name: 'Volatility 100 Index', type: 'Volatility', defaultDecimalPlaces: 2 },
];

/**
 * Default instrument to be selected when the application loads or when an invalid instrument is chosen.
 */
export const DEFAULT_INSTRUMENT: TradingInstrument = FOREX_CRYPTO_COMMODITY_INSTRUMENTS[0];

/**
 * Helper function to get a specific supported instrument object.
 * @param instrumentId The ID of the instrument (TradingInstrument).
 * @returns The SupportedInstrument object or undefined if not found.
 */
export function getSupportedInstrument(instrumentId: TradingInstrument): SupportedInstrument | undefined {
  return SUPPORTED_INSTRUMENTS.find(inst => inst.id === instrumentId);
} 