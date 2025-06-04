import type { ForexCryptoCommodityInstrumentType, InstrumentType } from '@/types';

/**
 * Checks if a given UTC date and time falls within typical Forex trading hours.
 * Forex market is generally open from Sunday ~21:00 UTC to Friday ~21:00 UTC.
 * This is a simplified check and doesn't account for all public holidays or specific broker downtimes.
 *
 * @param date The current date and time in UTC.
 * @returns True if the Forex market is likely open, false otherwise.
 */
function isGenerallyForexMarketOpen(date: Date): boolean {
  const dayUTC = date.getUTCDay(); // 0 (Sunday) to 6 (Saturday)
  const hourUTC = date.getUTCHours();

  // Closed on Saturday
  if (dayUTC === 6) { // Saturday
    return false;
  }

  // Closed on Sunday before 21:00 UTC
  if (dayUTC === 0 && hourUTC < 21) { // Sunday before 21:00 UTC
    return false;
  }

  // Closed on Friday after 21:00 UTC
  if (dayUTC === 5 && hourUTC >= 21) { // Friday after 21:00 UTC
    return false;
  }

  // Otherwise, it's likely open (Sunday 21:00 UTC to Friday 20:59 UTC)
  return true;
}

/**
 * Determines the trading status (open/closed) for a given instrument.
 * - Volatility Indices and Crypto are considered 24/7.
 * - Forex and XAU/USD follow general Forex market hours.
 *
 * @param instrument The trading instrument to check.
 * @param currentDate The current date and time (ideally in UTC).
 * @returns An object with `isOpen` (boolean) and a `message` (string).
 */
export function getMarketStatus(
  instrument: InstrumentType,
  currentDate: Date = new Date() // Default to now
): { isOpen: boolean; statusMessage: string } {
  const forexCommodityInstruments: InstrumentType[] = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'Palladium/USD', 'Platinum/USD', 'Silver/USD'];
  const cryptoInstruments: InstrumentType[] = ['BTC/USD', 'ETH/USD'];

  if (forexCommodityInstruments.includes(instrument as ForexCryptoCommodityInstrumentType)) {
    const isOpen = isGenerallyForexMarketOpen(currentDate);
    return {
      isOpen,
      statusMessage: isOpen ? `${instrument} market is likely Open.` : `${instrument} market is likely Closed. (Standard Forex Hours: Sun 21:00 - Fri 21:00 UTC)`
    };
  }

  if (cryptoInstruments.includes(instrument as ForexCryptoCommodityInstrumentType)) {
    return {
      isOpen: true,
      statusMessage: `${instrument} market is Open 24/7.`
    };
  }

  // Assuming all other instruments are Volatility Indices from Deriv
  // or any other instrument type considered 24/7.
  // Add more specific checks if other non-24/7 types are introduced.
  if (instrument.startsWith('Volatility') || instrument.startsWith('Boom') || instrument.startsWith('Crash') || instrument.startsWith('Jump')) {
     return {
        isOpen: true,
        statusMessage: `${instrument} market is Open 24/7.`
        };
  }
  
  // Fallback for any other unhandled but potentially valid InstrumentType
  // We'll assume they are Forex-like if not Volatility or known Crypto.
  const isForexLike = !(instrument.startsWith('Volatility') || instrument.startsWith('Boom') || instrument.startsWith('Crash') || instrument.startsWith('Jump')) && !cryptoInstruments.includes(instrument as ForexCryptoCommodityInstrumentType);
  if (isForexLike) {
    const isOpen = isGenerallyForexMarketOpen(currentDate);
     return {
      isOpen,
      statusMessage: isOpen ? `${instrument} market is likely Open.` : `${instrument} market is likely Closed. (Assumed Forex Hours)`
    };
  }

  // Default for truly unknown or if logic needs refinement for new types
  return {
    isOpen: false, // Default to closed for unhandled to prevent unexpected live trading
    statusMessage: `${instrument} market status is undetermined, assumed Closed.`
  };
} 