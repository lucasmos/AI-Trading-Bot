import type { ForexCryptoCommodityInstrumentType, InstrumentType } from '@/types';
import type { DerivMarketTimes, DerivTradingEvent, DerivSymbolSpecificTradingData } from '../types/trading-times'; // Added imports

// Local definitions of DerivMarketTimes, DerivTradingEvent, DerivSymbolSpecificTradingData are removed.

// Helper function for time conversion (internal to this module)
function convertGmtToTargetTimezone(gmtTime: string, targetTimeZone: string): string {
  if (!gmtTime || !targetTimeZone) return 'N/A';
  try {
    const today = new Date();
    const [hours, minutes, seconds] = gmtTime.split(':').map(Number);

    const dateInGmt = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hours, minutes, seconds || 0));

    return dateInGmt.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: targetTimeZone,
      hour12: false,
    });
  } catch (e) {
    console.error(`Error formatting time ${gmtTime} for timezone ${targetTimeZone}:`, e);
    return 'N/A';
  }
}

/**
 * Formats trading hours and events for display in multiple timezones.
 * @param tradingTimesData Raw trading times data for a symbol.
 * @param targetTimezones Array of IANA timezone strings.
 * @returns A formatted string for display.
 */
export function formatTradingHoursForDisplay(
  tradingTimesData: DerivSymbolSpecificTradingData | null | undefined,
  targetTimezones: string[] = ['GMT', 'UTC', 'Africa/Nairobi']
): string {
  if (!tradingTimesData || !tradingTimesData.times || !tradingTimesData.times.opens || !tradingTimesData.times.closes) {
    return "Trading hours data not available.";
  }

  const { times, events } = tradingTimesData;
  let displayString = "";

  if (times.opens.length > 0 && times.opens.length === times.closes.length) {
    targetTimezones.forEach(tz => {
      const tzSessions = times.opens.map((openTime, index) => {
        const closeTime = times.closes[index];
        const displayOpen = convertGmtToTargetTimezone(openTime, tz);
        const displayClose = convertGmtToTargetTimezone(closeTime, tz);
        // Check if conversion was successful
        if (displayOpen === 'N/A' || displayClose === 'N/A') {
          return `(Time conversion error for ${tz})`;
        }
        return `${displayOpen}-${displayClose}`;
      }).join(", ");
      displayString += `Open: ${tzSessions} [${tz}]. `;
    });
  } else {
    displayString += "Trading session times are unclear or incomplete. ";
  }

  if (events && events.length > 0) {
    displayString += "Relevant Events: ";
    const eventStrings = events.map(event => {
      let eventStr = `${event.descrip} (${event.dates})`;
      if (event.times) {
        // For simplicity, displaying event times in GMT as provided.
        // Could be converted similarly if a target timezone display is needed for event times.
        eventStr += ` at ${event.times} GMT`;
      }
      return eventStr;
    });
    displayString += eventStrings.join("; ");
  }

  return displayString.trim() || "Trading hours information processed.";
}

/**
 * Determines the current market status (open/closed) for a symbol based on its trading times.
 * @param tradingTimesData Raw trading times data for a symbol.
 * @returns An object indicating if the market is open, a message, and optionally next event details.
 */
export function getCurrentMarketStatus(
  tradingTimesData: DerivSymbolSpecificTradingData | null | undefined,
  referenceDateUTC: Date
): { isOpen: boolean; message: string; nextEventTimeGMT?: string; nextEventType?: 'open' | 'close' } {
  if (!tradingTimesData || !tradingTimesData.times || !tradingTimesData.times.opens || !tradingTimesData.times.closes || tradingTimesData.times.opens.length === 0 || tradingTimesData.times.opens.length !== tradingTimesData.times.closes.length) {
    return { isOpen: false, message: "Trading hours data unavailable or incomplete." };
  }

  let isOpen = false;
  for (let i = 0; i < tradingTimesData.times.opens.length; i++) {
    if (isTimeInSession(referenceDateUTC, tradingTimesData.times.opens[i], tradingTimesData.times.closes[i], referenceDateUTC)) {
      isOpen = true;
      break;
    }
  }

  const nextEvent = findNextRelevantEvent(referenceDateUTC, tradingTimesData, referenceDateUTC);

  let message = isOpen ? `Market is Open.` : `Market is Closed.`;
  if (nextEvent.nextEventTimeGMT && nextEvent.nextEventType) {
    const displayEventTime = convertGmtToTargetTimezone(nextEvent.nextEventTimeGMT, 'GMT'); // Keep it GMT for this message
    message = isOpen
      ? `Market Open until ${displayEventTime} GMT`
      : `Market Closed until ${displayEventTime} GMT`;

    // Check if the next event is on a different day
    const [h,m,s] = nextEvent.nextEventTimeGMT.split(':').map(Number);
    const nextEventDateToday = new Date(Date.UTC(referenceDateUTC.getUTCFullYear(), referenceDateUTC.getUTCMonth(), referenceDateUTC.getUTCDate(), h, m, s || 0));
    if (nextEventDateToday <= referenceDateUTC && nextEvent.nextEventType === 'open') { // If next open is today but already passed, or is now (implying tomorrow)
        // This simple check assumes if next open time is <= current time, it must be for the next day.
        // A more robust check would involve comparing the full date object of the next event.
         message += " (likely next trading day)";
    } else if (nextEventDateToday.getUTCDate() !== referenceDateUTC.getUTCDate()){
         message += " (next day)";
    }
     if (nextEvent.eventDescription) {
        message += ` (${nextEvent.eventDescription})`;
    }

  } else if (nextEvent.eventDescription) { // If only a descriptive event is found
     message += ` (${nextEvent.eventDescription})`;
  }


  return {
    isOpen: isOpen,
    message: message,
    nextEventTimeGMT: nextEvent.nextEventTimeGMT,
    nextEventType: nextEvent.nextEventType
  };
}


// --- Helper Functions ---

function isTimeInSession(currentTimeUTC: Date, sessionOpenGMT: string, sessionCloseGMT: string, referenceDateUTC: Date): boolean {
  const [openH, openM, openS] = sessionOpenGMT.split(':').map(Number);
  const [closeH, closeM, closeS] = sessionCloseGMT.split(':').map(Number);

  const sessionOpenDateUTC = new Date(Date.UTC(referenceDateUTC.getUTCFullYear(), referenceDateUTC.getUTCMonth(), referenceDateUTC.getUTCDate(), openH, openM, openS || 0));
  let sessionCloseDateUTC = new Date(Date.UTC(referenceDateUTC.getUTCFullYear(), referenceDateUTC.getUTCMonth(), referenceDateUTC.getUTCDate(), closeH, closeM, closeS || 0));

  if (sessionCloseDateUTC <= sessionOpenDateUTC) { // Session crosses midnight
    // Create two windows:
    // 1. From sessionOpen on referenceDateUTC to end of referenceDateUTC
    // 2. From start of next day UTC to sessionClose on that next day UTC
    const endOfReferenceDay = new Date(Date.UTC(referenceDateUTC.getUTCFullYear(), referenceDateUTC.getUTCMonth(), referenceDateUTC.getUTCDate(), 23, 59, 59, 999));
    const startOfNextDay = new Date(Date.UTC(referenceDateUTC.getUTCFullYear(), referenceDateUTC.getUTCMonth(), referenceDateUTC.getUTCDate() + 1, 0, 0, 0, 0));

    // If current time is within the part of session on referenceDateUTC
    if (currentTimeUTC >= sessionOpenDateUTC && currentTimeUTC <= endOfReferenceDay) return true;
    // If current time is within the part of session on the next day
    // Update sessionCloseDateUTC to be on the next day for this check
    sessionCloseDateUTC.setUTCDate(sessionCloseDateUTC.getUTCDate() + 1);
    if (currentTimeUTC >= startOfNextDay && currentTimeUTC < sessionCloseDateUTC) return true;

    return false;

  } else { // Same-day session
    return currentTimeUTC >= sessionOpenDateUTC && currentTimeUTC < sessionCloseDateUTC;
  }
}

function findNextRelevantEvent(
  currentTimeUTC: Date,
  tradingTimesData: DerivSymbolSpecificTradingData,
  referenceDateUTC: Date
): { nextEventTimeGMT?: string; nextEventType?: 'open' | 'close'; eventDescription?: string } {
  let nextEventTimeGMT: string | undefined = undefined;
  let nextEventType: 'open' | 'close' | undefined = undefined;
  let eventDescription: string | undefined = undefined;
  let closestEventEpoch = Infinity;

  const createUtcDate = (timeStr: string, baseDate: Date): Date => {
    const [h, m, s] = timeStr.split(':').map(Number);
    return new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), h, m, s || 0));
  };

  // Check today's session times
  if (tradingTimesData.times) {
    for (let i = 0; i < tradingTimesData.times.opens.length; i++) {
      const openStr = tradingTimesData.times.opens[i];
      const closeStr = tradingTimesData.times.closes[i];

      let openDate = createUtcDate(openStr, referenceDateUTC);
      let closeDate = createUtcDate(closeStr, referenceDateUTC);

      if (closeDate <= openDate) { // Crosses midnight
        closeDate.setUTCDate(closeDate.getUTCDate() + 1);
      }

      if (openDate > currentTimeUTC && openDate.getTime() < closestEventEpoch) {
        closestEventEpoch = openDate.getTime();
        nextEventTimeGMT = openStr;
        nextEventType = 'open';
        eventDescription = 'Market session open';
      }
      if (closeDate > currentTimeUTC && closeDate.getTime() < closestEventEpoch) {
        closestEventEpoch = closeDate.getTime();
        nextEventTimeGMT = closeStr;
        nextEventType = 'close';
        eventDescription = 'Market session close';
      }
    }
  }

  // Check tomorrow's first open (simplified)
  if (tradingTimesData.times && tradingTimesData.times.opens.length > 0) {
      const firstOpenTomorrowStr = tradingTimesData.times.opens[0];
      const tomorrowDate = new Date(referenceDateUTC);
      tomorrowDate.setUTCDate(referenceDateUTC.getUTCDate() + 1);
      const firstOpenTomorrowDate = createUtcDate(firstOpenTomorrowStr, tomorrowDate);

      if (firstOpenTomorrowDate > currentTimeUTC && firstOpenTomorrowDate.getTime() < closestEventEpoch) {
          closestEventEpoch = firstOpenTomorrowDate.getTime();
          nextEventTimeGMT = firstOpenTomorrowStr;
          nextEventType = 'open';
          eventDescription = 'Market session open (next day)';
      }
  }

  // Basic event parsing (highly simplified)
  if (tradingTimesData.events) {
    for (const event of tradingTimesData.events) {
      if (event.times) { // Only consider events with specific times for now
        // Very basic date matching: "today" or specific date match
        const todayStrYYYYMMDD = referenceDateUTC.toISOString().split('T')[0];
        const eventDateMatchesToday = event.dates === todayStrYYYYMMDD ||
                                      event.dates.toLowerCase() === referenceDateUTC.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() + 's'; // e.g. "Fridays"

        if (eventDateMatchesToday) {
          const eventTimeDate = createUtcDate(event.times, referenceDateUTC);
          if (eventTimeDate > currentTimeUTC && eventTimeDate.getTime() < closestEventEpoch) {
            closestEventEpoch = eventTimeDate.getTime();
            nextEventTimeGMT = event.times; // HH:MM:SS GMT
            eventDescription = event.descrip;
            if (event.descrip.toLowerCase().includes('close')) {
              nextEventType = 'close';
            } else if (event.descrip.toLowerCase().includes('open') || event.descrip.toLowerCase().includes('re-open')) {
              nextEventType = 'open';
            } else {
              nextEventType = undefined; // Unknown event impact on open/close status
            }
          }
        }
      } else if (event.descrip.toLowerCase().includes('closed all day')) {
         // If it's "closed all day" and today matches the event.dates (simplified check)
         const todayStrYYYYMMDD = referenceDateUTC.toISOString().split('T')[0];
         if (event.dates === todayStrYYYYMMDD || event.dates.toLowerCase() === referenceDateUTC.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() + 's') {
            // If this event is more relevant than any found session opening
            if (nextEventType !== 'open' || !nextEventTimeGMT) { // Or if no next open was found from sessions
                // This implies market is closed for the day due to this event.
                // We might not have a specific "next open time" from this event alone.
                // For simplicity, if a "closed all day" event matches today, we might not find a next open time from *this* event.
                // The logic above for "tomorrow's first open" might still provide a next open.
                // If this event is the most "dominant" for today, we can set description.
                if (closestEventEpoch === Infinity) { // No other future events found yet
                    eventDescription = event.descrip;
                    // nextEventType and nextEventTimeGMT would remain undefined from this event.
                }
            }
         }
      }
    }
  }
  return { nextEventTimeGMT, nextEventType, eventDescription };
}


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