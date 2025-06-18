import type { ForexCryptoCommodityInstrumentType, InstrumentType } from '@/types';

// --- Start of Trading Times Data Structures ---
export interface DerivMarketTimes {
  opens: string[]; // HH:MM:SS GMT
  closes: string[]; // HH:MM:SS GMT
  settlement?: string;
}

export interface DerivTradingEvent {
  dates: string; // e.g., "Fridays", "2023-12-25"
  descrip: string; // e.g., "Closes early"
  times?: string; // e.g., "HH:MM:SS GMT"
}

export interface DerivSymbolSpecificTradingData {
  feed_license?: string;
  events: DerivTradingEvent[];
  times?: DerivMarketTimes;
}
// --- End of Trading Times Data Structures ---

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
  tradingTimesData: DerivSymbolSpecificTradingData | null | undefined
): { isOpen: boolean; message: string; nextEventTime?: string; nextEventType?: 'open' | 'close' } {
  if (!tradingTimesData || !tradingTimesData.times || !tradingTimesData.times.opens || !tradingTimesData.times.closes || tradingTimesData.times.opens.length === 0 || tradingTimesData.times.opens.length !== tradingTimesData.times.closes.length) {
    return { isOpen: false, message: "Trading hours data unavailable or incomplete." };
  }

  const { times, events } = tradingTimesData;
  const nowUtc = new Date();

  let marketIsOpen = false;
  let currentSessionClosesGmt: string | null = null;
  let nextSessionOpenGmt: string | null = null;
  let closestNextEventTimeEpoch = Infinity;
  let nextEventType: 'open' | 'close' | undefined = undefined;
  let nextEventTimeStr: string | undefined = undefined;

  // Helper to create a Date object for today GMT with given HH:MM:SS
  const createGmtDate = (timeStr: string): Date => {
    const [h, m, s] = timeStr.split(':').map(Number);
    return new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), h, m, s || 0));
  };

  // Helper to compare and find the earliest future time
  const updateNextEvent = (eventTimeGmtStr: string, type: 'open' | 'close') => {
    const eventDate = createGmtDate(eventTimeGmtStr);
    if (eventDate > nowUtc && eventDate.getTime() < closestNextEventTimeEpoch) {
      closestNextEventTimeEpoch = eventDate.getTime();
      nextEventType = type;
      nextEventTimeStr = eventTimeGmtStr;
    }
  };


  for (let i = 0; i < times.opens.length; i++) {
    const openStr = times.opens[i];
    const closeStr = times.closes[i];

    const sessionOpenDate = createGmtDate(openStr);
    let sessionCloseDate = createGmtDate(closeStr);

    if (sessionCloseDate <= sessionOpenDate) { // Crosses midnight
      // If current time is on the "open" day or the "close" day
      // This logic needs to be careful about which "today" it's comparing against.
      // Let's test a window: from open (today) to close (tomorrow)
      // And also from open (yesterday, if it crossed midnight) to close (today)

      let potentialCloseTomorrow = new Date(sessionCloseDate.getTime());
      potentialCloseTomorrow.setUTCDate(sessionOpenDate.getUTCDate() + 1); // Close is on the next calendar day in UTC

      if (nowUtc >= sessionOpenDate && nowUtc < potentialCloseTomorrow) {
        marketIsOpen = true;
        currentSessionClosesGmt = closeStr;
        break;
      }
      // Consider if the session started yesterday and closes today
      let potentialOpenYesterday = new Date(sessionOpenDate.getTime());
      potentialOpenYesterday.setUTCDate(sessionCloseDate.getUTCDate() -1);
      if (nowUtc >= potentialOpenYesterday && nowUtc < sessionCloseDate && openStr > closeStr) { // openStr > closeStr indicates overnight
         marketIsOpen = true;
         currentSessionClosesGmt = closeStr;
         break;
      }

    } else { // Same day session
      if (nowUtc >= sessionOpenDate && nowUtc < sessionCloseDate) {
        marketIsOpen = true;
        currentSessionClosesGmt = closeStr;
        break;
      }
    }
  }

  // Determine next event if market is closed, or the close time of current session if open
  if (marketIsOpen && currentSessionClosesGmt) {
    updateNextEvent(currentSessionClosesGmt, 'close');
  } else {
    // Market is closed, find the next opening time
    times.opens.forEach(openStr => {
      // Check if this opening time is in the future today
      let openDateToday = createGmtDate(openStr);
      if (openDateToday > nowUtc) {
        updateNextEvent(openStr, 'open');
      } else {
        // If past today's open, check tomorrow's open (simplification, assumes it opens at same time next day)
        let openDateTomorrow = new Date(openDateToday.getTime());
        openDateTomorrow.setUTCDate(openDateTomorrow.getUTCDate() + 1);
        // We only want the *next* immediate open. If all of today's opens are past,
        // the closest one for "tomorrow" (at same HH:MM:SS) is a candidate.
        // This needs to be compared with other future opens.
         if (openDateTomorrow.getTime() < closestNextEventTimeEpoch) { // Only if it's earlier than any other found future event
            closestNextEventTimeEpoch = openDateTomorrow.getTime();
            nextEventType = 'open';
            nextEventTimeStr = openStr; // Still display as HH:MM:SS for "next day"
         }
      }
    });
  }

  // Crude event handling (mainly for "Closed" events like holidays)
  // This does not precisely parse event.dates like "Fridays" or "2023-12-25" vs current date.
  // It's a very basic check.
  for (const event of events) {
    if (event.descrip.toLowerCase().includes('closed all day') || (event.descrip.toLowerCase().includes('closed') && !event.times)) {
      // This is a simplification. A robust solution needs proper date matching for event.dates
      // For now, if such an event exists, we might override marketIsOpen to false.
      // This part is complex and would ideally use a date library for "Fridays", "YYYY-MM-DD" checks.
      // Let's assume for now if marketIsOpen is true from sessions, it stands unless a specific closing event for *now* is hit.
      // If marketIsOpen is false, and a "Closed all day" event matches today (heuristically), it reinforces closed.
    } else if (event.times && event.descrip.toLowerCase().includes('closes early')) {
      const earlyCloseTimeToday = createGmtDate(event.times);
      if (marketIsOpen && nowUtc >= earlyCloseTimeToday) { // Market was open, but now it's past early close
        marketIsOpen = false;
        currentSessionClosesGmt = null; // No longer relevant
        // Re-evaluate next open, could be complex if early close affects next day's open
        nextEventType = undefined; // Reset as next open logic might be different now
        nextEventTimeStr = undefined;
        closestNextEventTimeEpoch = Infinity;
         // Re-run limited next open logic
        times.opens.forEach(openStr => {
            let openDateTomorrow = createGmtDate(openStr);
            openDateTomorrow.setUTCDate(openDateTomorrow.getUTCDate() + 1); // Assume next day open
            if (openDateTomorrow.getTime() < closestNextEventTimeEpoch) {
                closestNextEventTimeEpoch = openDateTomorrow.getTime();
                nextEventType = 'open';
                nextEventTimeStr = openStr;
            }
        });

      } else if (marketIsOpen && earlyCloseTimeToday < createGmtDate(currentSessionClosesGmt!)) {
        // Market is open, but this event means it will close earlier than the standard session
        updateNextEvent(event.times, 'close');
      }
    }
  }

  let message = marketIsOpen ? `Market is Open.` : `Market is Closed.`;
  if (nextEventTimeStr && nextEventType) {
    const displayEventTime = convertGmtToTargetTimezone(nextEventTimeStr, 'GMT');
    message = marketIsOpen
      ? `Market Open until ${displayEventTime} GMT.`
      : `Market Closed until ${displayEventTime} GMT.`;
      // Add (Next Day) if epoch is for tomorrow
      if (createGmtDate(nextEventTimeStr).getUTCDate() !== nowUtc.getUTCDate() && closestNextEventTimeEpoch > nowUtc.getTime()) {
          message += " (next day)";
      }
  }


  return {
    isOpen: marketIsOpen,
    message: message,
    nextEventTime: nextEventTimeStr, // GMT HH:MM:SS
    nextEventType: nextEventType
  };
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