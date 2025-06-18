// src/types/trading-times.ts
export interface DerivMarketTimes {
  opens: string[]; // HH:MM:SS GMT
  closes: string[]; // HH:MM:SS GMT
  settlement?: string;
}

export interface DerivTradingEvent {
  dates: string; // e.g., "Fridays", "2023-12-25"
  descrip: string; // e.g., "Closes early"
  times?: string; // e.g., "20:55:00 GMT"
}

export interface DerivSymbolSpecificTradingData {
  feed_license?: string;
  events: DerivTradingEvent[];
  times?: DerivMarketTimes;
}
