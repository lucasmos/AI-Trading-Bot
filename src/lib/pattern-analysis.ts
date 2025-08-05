// Pattern analysis service for volatility trading
import { getInstrumentDecimalPlaces } from './utils';
import type { VolatilityInstrumentType } from '@/types';

export interface TickData {
  price: number;
  digit: number;
  timestamp: number;
}

export interface PatternAnalysisResult {
  continuousPatterns: {
    evenCount: number;
    oddCount: number;
  };
  reversalPatterns: {
    evenReversals: number; // 3+ consecutive Odd followed by Even
    oddReversals: number;  // 3+ consecutive Even followed by Odd
  };
  currentSequence: {
    type: 'even' | 'odd';
    length: number;
    canTriggerReversal: boolean; // true if length >= 3
  };
  shouldTriggerTrade: {
    evenStrategy: boolean; // trigger Even trade
    oddStrategy: boolean;  // trigger Odd trade
    reasoning: string;
  };
}

export class PatternAnalysisService {
  /**
   * Analyze the last 200 ticks for pattern detection
   */
  static analyzePatterns(
    priceSequence: Array<{price: number, digit: number, timestamp: number}>,
    instrument: VolatilityInstrumentType
  ): PatternAnalysisResult {
    // Get last 200 ticks for analysis
    const last200Ticks = priceSequence.slice(-200);
    
    if (last200Ticks.length < 4) {
      return this.getEmptyAnalysis();
    }

    // Convert to TickData format
    const ticks: TickData[] = last200Ticks.map(item => ({
      price: item.price,
      digit: item.digit,
      timestamp: item.timestamp
    }));

    // Analyze continuous patterns
    const continuousPatterns = this.analyzeContinuousPatterns(ticks);
    
    // Analyze reversal patterns
    const reversalPatterns = this.analyzeReversalPatterns(ticks);
    
    // Analyze current sequence
    const currentSequence = this.analyzeCurrentSequence(ticks);
    
    // Determine if we should trigger trades
    const shouldTriggerTrade = this.determineTradeTriggers(ticks, currentSequence);

    return {
      continuousPatterns,
      reversalPatterns,
      currentSequence,
      shouldTriggerTrade
    };
  }

  /**
   * Analyze continuous patterns: sequences where 2+ consecutive ticks have same parity
   */
  private static analyzeContinuousPatterns(ticks: TickData[]): { evenCount: number; oddCount: number } {
    let evenCount = 0;
    let oddCount = 0;
    let currentSequenceType: 'even' | 'odd' | null = null;
    let currentSequenceLength = 0;

    for (let i = 0; i < ticks.length; i++) {
      const isEven = ticks[i].digit % 2 === 0;
      const currentType = isEven ? 'even' : 'odd';

      if (currentSequenceType === currentType) {
        // Continue current sequence
        currentSequenceLength++;
      } else {
        // End previous sequence if it was 2+ ticks
        if (currentSequenceLength >= 2 && currentSequenceType) {
          if (currentSequenceType === 'even') {
            evenCount++;
          } else {
            oddCount++;
          }
        }
        // Start new sequence
        currentSequenceType = currentType;
        currentSequenceLength = 1;
      }
    }

    // Check final sequence
    if (currentSequenceLength >= 2 && currentSequenceType) {
      if (currentSequenceType === 'even') {
        evenCount++;
      } else {
        oddCount++;
      }
    }

    return { evenCount, oddCount };
  }

  /**
   * Analyze reversal patterns: 3+ consecutive ticks of one parity followed by opposite parity
   */
  private static analyzeReversalPatterns(ticks: TickData[]): { evenReversals: number; oddReversals: number } {
    let evenReversals = 0; // 3+ consecutive Odd followed by Even
    let oddReversals = 0;  // 3+ consecutive Even followed by Odd
    
    let currentSequenceType: 'even' | 'odd' | null = null;
    let currentSequenceLength = 0;

    for (let i = 0; i < ticks.length; i++) {
      const isEven = ticks[i].digit % 2 === 0;
      const currentType = isEven ? 'even' : 'odd';

      if (currentSequenceType === currentType) {
        // Continue current sequence
        currentSequenceLength++;
      } else {
        // Check if previous sequence was 3+ and this is a reversal
        if (currentSequenceLength >= 3 && currentSequenceType) {
          if (currentSequenceType === 'odd' && currentType === 'even') {
            evenReversals++; // 3+ Odd followed by Even
          } else if (currentSequenceType === 'even' && currentType === 'odd') {
            oddReversals++; // 3+ Even followed by Odd
          }
        }
        // Start new sequence
        currentSequenceType = currentType;
        currentSequenceLength = 1;
      }
    }

    return { evenReversals, oddReversals };
  }

  /**
   * Analyze the current sequence at the end of the tick array
   */
  private static analyzeCurrentSequence(ticks: TickData[]): {
    type: 'even' | 'odd';
    length: number;
    canTriggerReversal: boolean;
  } {
    if (ticks.length === 0) {
      return { type: 'even', length: 0, canTriggerReversal: false };
    }

    const latestTick = ticks[ticks.length - 1];
    const latestType = latestTick.digit % 2 === 0 ? 'even' : 'odd';
    
    // Count backwards to find sequence length
    let sequenceLength = 1;
    for (let i = ticks.length - 2; i >= 0; i--) {
      const tickType = ticks[i].digit % 2 === 0 ? 'even' : 'odd';
      if (tickType === latestType) {
        sequenceLength++;
      } else {
        break;
      }
    }

    return {
      type: latestType,
      length: sequenceLength,
      canTriggerReversal: sequenceLength >= 3
    };
  }

  /**
   * Determine if we should trigger trades based on pattern analysis
   * Even Strategy Trigger: 3+ consecutive Odd digits followed by Even digit
   * Odd Strategy Trigger: 3+ consecutive Even digits followed by Odd digit
   */
  private static determineTradeTriggers(
    ticks: TickData[], 
    currentSequence: { type: 'even' | 'odd'; length: number; canTriggerReversal: boolean }
  ): { evenStrategy: boolean; oddStrategy: boolean; reasoning: string } {
    if (ticks.length < 4) {
      return {
        evenStrategy: false,
        oddStrategy: false,
        reasoning: 'Insufficient tick data for pattern analysis'
      };
    }

    // Get the last few ticks to check for reversal pattern
    const latestTick = ticks[ticks.length - 1];
    const latestType = latestTick.digit % 2 === 0 ? 'even' : 'odd';
    
    // Check if we have a reversal pattern
    // We need to look at the sequence BEFORE the latest tick
    let previousSequenceLength = 0;
    let previousSequenceType: 'even' | 'odd' | null = null;
    
    // Start from second-to-last tick and count backwards
    if (ticks.length >= 2) {
      const secondLatestTick = ticks[ticks.length - 2];
      previousSequenceType = secondLatestTick.digit % 2 === 0 ? 'even' : 'odd';
      
      // Only count if the latest tick is different from the previous sequence
      if (latestType !== previousSequenceType) {
        previousSequenceLength = 1; // Start with the second-to-last tick
        
        // Count backwards to find the length of the previous sequence
        for (let i = ticks.length - 3; i >= 0; i--) {
          const tickType = ticks[i].digit % 2 === 0 ? 'even' : 'odd';
          if (tickType === previousSequenceType) {
            previousSequenceLength++;
          } else {
            break;
          }
        }
      }
    }

    // Determine trade triggers
    let evenStrategy = false;
    let oddStrategy = false;
    let reasoning = '';

    if (previousSequenceLength >= 3 && previousSequenceType) {
      if (previousSequenceType === 'odd' && latestType === 'even') {
        // 3+ consecutive Odd digits followed by Even digit -> trigger Even strategy
        evenStrategy = true;
        reasoning = `Even strategy triggered: ${previousSequenceLength} consecutive Odd digits followed by Even digit (${latestTick.digit})`;
      } else if (previousSequenceType === 'even' && latestType === 'odd') {
        // 3+ consecutive Even digits followed by Odd digit -> trigger Odd strategy
        oddStrategy = true;
        reasoning = `Odd strategy triggered: ${previousSequenceLength} consecutive Even digits followed by Odd digit (${latestTick.digit})`;
      }
    }

    if (!evenStrategy && !oddStrategy) {
      reasoning = `No trigger: Latest sequence is ${currentSequence.type} (length: ${currentSequence.length}). Need 3+ consecutive opposite parity followed by reversal.`;
    }

    return { evenStrategy, oddStrategy, reasoning };
  }

  /**
   * Get empty analysis result
   */
  private static getEmptyAnalysis(): PatternAnalysisResult {
    return {
      continuousPatterns: { evenCount: 0, oddCount: 0 },
      reversalPatterns: { evenReversals: 0, oddReversals: 0 },
      currentSequence: { type: 'even', length: 0, canTriggerReversal: false },
      shouldTriggerTrade: { 
        evenStrategy: false, 
        oddStrategy: false, 
        reasoning: 'Insufficient data for analysis' 
      }
    };
  }

  /**
   * Extract last digit from price based on instrument decimal places
   */
  static extractLastDigit(price: number, instrument: VolatilityInstrumentType): number {
    const decimalPlaces = getInstrumentDecimalPlaces(instrument);
    const priceStr = price.toFixed(decimalPlaces);
    return parseInt(priceStr.charAt(priceStr.length - 1));
  }

  /**
   * Convert price sequence to tick data with proper digit extraction
   */
  static convertPriceSequenceToTicks(
    priceSequence: Array<{price: number, digit: number, timestamp: number}>,
    instrument: VolatilityInstrumentType
  ): TickData[] {
    return priceSequence.map(item => ({
      price: item.price,
      digit: this.extractLastDigit(item.price, instrument),
      timestamp: item.timestamp
    }));
  }
}
