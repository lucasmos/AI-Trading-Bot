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
    // Volatility Indices (CORRECTED with actual Deriv decimal places)
    case 'Volatility 10 Index':
      return 3; // 3 decimal places
    case 'Volatility 25 Index':
      return 3; // 3 decimal places
    case 'Volatility 50 Index':
      return 4; // 4 decimal places (CORRECTED from 2 to 4)
    case 'Volatility 75 Index':
      return 4; // 4 decimal places
    case 'Volatility 100 Index':
    case 'R_100':
      return 2; // 2 decimal places
    case 'R_10':
      return 3; // 3 decimal places
    case 'R_25':
      return 3; // 3 decimal places
    case 'R_50':
      return 4; // 4 decimal places (CORRECTED from 2 to 4)
    case 'R_75':
      return 4; // 4 decimal places
    // 1-Second Volatility Indices (ALL 2 decimal places per Deriv)
    case 'Volatility 10 (1s) Index':
    case '1HZ10V': // CRITICAL FIX: Add API symbol support
      return 2; // 2 decimal places (CORRECTED from 3 to 2)
    case 'Volatility 25 (1s) Index':
    case '1HZ25V': // CRITICAL FIX: Add API symbol support
      return 2; // 2 decimal places (CORRECTED from 3 to 2)
    case 'Volatility 50 (1s) Index':
    case '1HZ50V': // CRITICAL FIX: Add API symbol support
      return 2; // 2 decimal places
    case 'Volatility 75 (1s) Index':
    case '1HZ75V': // CRITICAL FIX: Add API symbol support
      return 2; // 2 decimal places (CORRECTED from 4 to 2)
    case 'Volatility 100 (1s) Index':
    case '1HZ100V': // CRITICAL FIX: Add API symbol support
      return 2; // 2 decimal places
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

import { UserTradeType as UserTradeTypeValue } from '@/types/ai-shared-types'; // Make sure this path is correct

export function getDisplayTradeTypeDetails(
  derivContractType: string,
  userSelectedTradeType?: UserTradeTypeValue | string,
  barrier?: string | number | null
): string {
  // First, handle specific Deriv contract types that are unambiguous
  switch (derivContractType) {
    case 'CALLE': return 'Rise or Equal';
    case 'PUTE': return 'Fall or Equal';
    case 'DIGITEVEN': return 'Digit Even';
    case 'DIGITODD': return 'Digit Odd';
    case 'DIGITMATCH':
      return barrier !== undefined && barrier !== null ? `Digit Matches ${barrier}` : 'Digit Matches';
    case 'DIGITDIFF':
      return barrier !== undefined && barrier !== null ? `Digit Differs ${barrier}` : 'Digit Differs';
    case 'ONETOUCH': return 'Touch';
    case 'NOTOUCH': return 'No Touch';
    case 'DIGITOVER':
      return barrier !== undefined && barrier !== null ? `Digit Over ${barrier}` : 'Digit Over';
    case 'DIGITUNDER':
      return barrier !== undefined && barrier !== null ? `Digit Under ${barrier}` : 'Digit Under';
  }

  // For CALL/PUT, the meaning depends on the user's selected high-level trade type
  if (derivContractType === 'CALL') {
    if (userSelectedTradeType === 'RiseFall') return 'Rise';
    if (userSelectedTradeType === 'HigherLower') {
      return barrier !== undefined && barrier !== null ? `Higher than ${barrier}` : 'Higher';
    }
    return 'Call'; // Generic Call
  }

  if (derivContractType === 'PUT') {
    if (userSelectedTradeType === 'RiseFall') return 'Fall';
    if (userSelectedTradeType === 'HigherLower') {
      return barrier !== undefined && barrier !== null ? `Lower than ${barrier}` : 'Lower';
    }
    return 'Put'; // Generic Put
  }

  return derivContractType; // Fallback to the raw Deriv contract type if no specific mapping found
}

// Helper function to convert user trade type to Deriv-style display name
export function getTradeTypeDisplayName(userTradeType: string | undefined, contractType?: string): string {
  if (contractType) {
    // Use contract type for more specific display
    switch (contractType) {
      case 'CALL': return 'Rise/Fall';
      case 'PUT': return 'Rise/Fall';
      case 'ONETOUCH': return 'Touch/No Touch';
      case 'NOTOUCH': return 'Touch/No Touch';
      case 'DIGITOVER': return 'Over/Under';
      case 'DIGITUNDER': return 'Over/Under';
      case 'DIGITEVEN': return 'Even/Odd';
      case 'DIGITODD': return 'Even/Odd';
      default: return contractType || 'N/A'; // CRITICAL FIX: Handle undefined/null contractType
    }
  }

  // Fallback to user trade type
  switch (userTradeType) {
    case 'RiseFall': return 'Rise/Fall';
    case 'HigherLower': return 'Higher/Lower';
    case 'TouchNoTouch': return 'Touch/No Touch';
    case 'DigitsOverUnder': return 'Over/Under';
    case 'DigitsEvenOdd': return 'Even/Odd';
    default: return userTradeType || 'N/A';
  }
}
