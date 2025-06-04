import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { InstrumentType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInstrumentDecimalPlaces(instrument: InstrumentType): number {
  switch (instrument) {
    // Forex
    case 'EUR/USD':
    case 'GBP/USD':
      return 5; // Deriv typically uses 5 for major FX pairs
    // Crypto
    case 'BTC/USD':
    case 'ETH/USD':
      return 2;
    // Commodities
    case 'XAU/USD': // Gold
    case 'Palladium/USD':
    case 'Platinum/USD':
      return 2;
    case 'Silver/USD':
      return 4;
    // Volatility Indices
    case 'Volatility 10 Index':
      return 3; // Example, verify specific index
    case 'Volatility 25 Index':
      return 3; // Example, verify specific index
    case 'Volatility 50 Index':
      return 2; // Example, verify specific index
    case 'Volatility 75 Index':
      return 4; // Example, verify specific index (often has more decimals)
    case 'Volatility 100 Index':
      return 2; // Example, verify specific index
    case 'Boom 500 Index':
    case 'Boom 600 Index':
    case 'Boom 900 Index':
    case 'Boom 1000 Index':
    case 'Crash 500 Index':
    case 'Crash 600 Index':
    case 'Crash 900 Index':
    case 'Crash 1000 Index':
      return 3;
    case 'Jump 10 Index':
    case 'Jump 25 Index':
    case 'Jump 50 Index':
    case 'Jump 75 Index':
    case 'Jump 100 Index':
      return 2;
    default:
      // This should ideally not be reached if InstrumentType is exhaustive.
      // If new instruments are added, this function should be updated.
      console.warn(`Unhandled instrument in getInstrumentDecimalPlaces: ${instrument}. Defaulting to 2 decimal places.`);
      return 2; // A general fallback
  }
}
