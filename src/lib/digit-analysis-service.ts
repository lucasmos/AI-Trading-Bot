import { PriceTick, VolatilityInstrumentType } from '@/types';
import { getInstrumentDecimalPlaces } from '@/lib/utils';

export interface DigitAnalysisResult {
  digitFrequencies: Record<number, number>;
  digitProbabilities: Record<number, number>;
  evenOddBias: { even: number; odd: number };
  overUnderBias: { over: number; under: number; threshold: number };
  consecutivePatterns: Record<string, number>;
  streakAnalysis: Record<number, { current: number; max: number; avg: number }>;
  gapAnalysis: Record<number, { current: number; avg: number; max: number }>;
  cyclicalPatterns: Record<string, number>;
}

export interface DigitPredictionModel {
  predictedDigit: number;
  confidence: number;
  method: 'frequency' | 'gap' | 'pattern' | 'bias' | 'hybrid';
  supportingEvidence: string[];
  estimatedOccurrence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface BotTradingSignal {
  action: 'BUY' | 'WAIT' | 'SKIP';
  digit: number;
  strategy: 'DIGITSMATCH' | 'DIGITSEVEN' | 'DIGITSODD' | 'DIGITSOVER' | 'DIGITSUNDER';
  entryTick: number;
  confidence: number;
  duration: number; // in ticks
  reasoning: string;
  riskAssessment: string;
}

export interface StrategyPrediction {
  strategy: 'DIGITSMATCH' | 'DIGITSEVEN' | 'DIGITSODD' | 'DIGITSOVER' | 'DIGITSUNDER';
  action: 'MATCH_NOW' | 'NO_SIGNAL';
  targetDigit?: number;
  currentDigit: number;
  confidence: number;
  reasoning: string;
  isMatch: boolean;
}

export interface AllStrategyPredictions {
  digitsMatch: StrategyPrediction;
  digitsEven: StrategyPrediction;
  digitsOdd: StrategyPrediction;
  digitsOver: StrategyPrediction;
  digitsUnder: StrategyPrediction;
}

export class DigitAnalysisService {
  private static readonly ANALYSIS_WINDOW = 200; // Number of ticks to analyze
  private static readonly MIN_CONFIDENCE_THRESHOLD = 65;
  private static readonly PATTERN_MIN_OCCURRENCES = 3;

  /**
   * Comprehensive digit analysis from tick data
   */
  static analyzeDigitPatterns(ticks: PriceTick[], instrument: VolatilityInstrumentType): DigitAnalysisResult {
    if (ticks.length < 20) {
      throw new Error('Insufficient tick data for analysis. Minimum 20 ticks required.');
    }

    const recentTicks = ticks.slice(-this.ANALYSIS_WINDOW);
    const digits = this.extractLastDigits(recentTicks, instrument);

    return {
      digitFrequencies: this.calculateDigitFrequencies(digits),
      digitProbabilities: this.calculateDigitProbabilities(digits),
      evenOddBias: this.calculateEvenOddBias(digits),
      overUnderBias: this.calculateOverUnderBias(digits, 5),
      consecutivePatterns: this.analyzeConsecutivePatterns(digits),
      streakAnalysis: this.analyzeStreaks(digits),
      gapAnalysis: this.analyzeGaps(digits),
      cyclicalPatterns: this.analyzeCyclicalPatterns(digits)
    };
  }

  /**
   * Generate digit prediction using multiple algorithms
   */
  static generatePrediction(analysis: DigitAnalysisResult, currentTick: number): DigitPredictionModel {
    const predictions = [
      this.frequencyBasedPrediction(analysis),
      this.gapBasedPrediction(analysis),
      this.patternBasedPrediction(analysis),
      this.biasBasedPrediction(analysis)
    ];

    // Select best prediction based on confidence
    const bestPrediction = predictions.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    // Enhance with hybrid analysis if confidence is low
    if (bestPrediction.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
      return this.hybridPrediction(analysis, predictions);
    }

    return bestPrediction;
  }

  /**
   * Generate predictions for all trading strategies
   */
  static generateAllStrategyPredictions(
    analysis: DigitAnalysisResult,
    currentLastDigit: number
  ): AllStrategyPredictions {
    // Generate individual strategy predictions
    const digitsMatch = this.generateDigitsMatchPrediction(analysis, currentLastDigit);
    const digitsEven = this.generateDigitsEvenPrediction(analysis, currentLastDigit);
    const digitsOdd = this.generateDigitsOddPrediction(analysis, currentLastDigit);
    const digitsOver = this.generateDigitsOverPrediction(analysis, currentLastDigit);
    const digitsUnder = this.generateDigitsUnderPrediction(analysis, currentLastDigit);

    return {
      digitsMatch,
      digitsEven,
      digitsOdd,
      digitsOver,
      digitsUnder
    };
  }

  /**
   * Generate Digits Match prediction
   */
  private static generateDigitsMatchPrediction(
    analysis: DigitAnalysisResult,
    currentLastDigit: number
  ): StrategyPrediction {
    // Find the digit with highest probability that's not the current digit
    const sortedDigits = Object.entries(analysis.digitProbabilities)
      .map(([digit, prob]) => ({ digit: parseInt(digit), probability: prob }))
      .sort((a, b) => b.probability - a.probability);

    const bestDigit = sortedDigits[0];
    const confidence = bestDigit.probability;

    // Check if current digit matches the predicted digit
    const isMatch = currentLastDigit === bestDigit.digit;
    const action = confidence >= this.MIN_CONFIDENCE_THRESHOLD && isMatch ? 'MATCH_NOW' : 'NO_SIGNAL';

    return {
      strategy: 'DIGITSMATCH',
      action,
      targetDigit: bestDigit.digit,
      currentDigit: currentLastDigit,
      confidence,
      reasoning: `Digit ${bestDigit.digit} has ${confidence.toFixed(1)}% probability based on frequency analysis`,
      isMatch
    };
  }

  /**
   * Generate Digits Even prediction
   */
  private static generateDigitsEvenPrediction(
    analysis: DigitAnalysisResult,
    currentLastDigit: number
  ): StrategyPrediction {
    const evenBias = analysis.evenOddBias.even;
    const confidence = evenBias;
    const isCurrentEven = currentLastDigit % 2 === 0;
    const isMatch = isCurrentEven && evenBias > 50;
    const action = confidence >= this.MIN_CONFIDENCE_THRESHOLD && isMatch ? 'MATCH_NOW' : 'NO_SIGNAL';

    return {
      strategy: 'DIGITSEVEN',
      action,
      targetDigit: undefined, // Even strategy doesn't target specific digit
      currentDigit: currentLastDigit,
      confidence,
      reasoning: `Even digits have ${evenBias.toFixed(1)}% bias. Current digit ${currentLastDigit} is ${isCurrentEven ? 'even' : 'odd'}`,
      isMatch
    };
  }

  /**
   * Generate Digits Odd prediction
   */
  private static generateDigitsOddPrediction(
    analysis: DigitAnalysisResult,
    currentLastDigit: number
  ): StrategyPrediction {
    const oddBias = analysis.evenOddBias.odd;
    const confidence = oddBias;
    const isCurrentOdd = currentLastDigit % 2 === 1;
    const isMatch = isCurrentOdd && oddBias > 50;
    const action = confidence >= this.MIN_CONFIDENCE_THRESHOLD && isMatch ? 'MATCH_NOW' : 'NO_SIGNAL';

    return {
      strategy: 'DIGITSODD',
      action,
      targetDigit: undefined, // Odd strategy doesn't target specific digit
      currentDigit: currentLastDigit,
      confidence,
      reasoning: `Odd digits have ${oddBias.toFixed(1)}% bias. Current digit ${currentLastDigit} is ${isCurrentOdd ? 'odd' : 'even'}`,
      isMatch
    };
  }

  /**
   * Generate Digits Over prediction
   */
  private static generateDigitsOverPrediction(
    analysis: DigitAnalysisResult,
    currentLastDigit: number
  ): StrategyPrediction {
    const overBias = analysis.overUnderBias.over;
    const threshold = analysis.overUnderBias.threshold;
    const confidence = overBias;
    const isCurrentOver = currentLastDigit > threshold;
    const isMatch = isCurrentOver && overBias > 50;
    const action = confidence >= this.MIN_CONFIDENCE_THRESHOLD && isMatch ? 'MATCH_NOW' : 'NO_SIGNAL';

    return {
      strategy: 'DIGITSOVER',
      action,
      targetDigit: undefined, // Over strategy doesn't target specific digit
      currentDigit: currentLastDigit,
      confidence,
      reasoning: `Digits over ${threshold} have ${overBias.toFixed(1)}% bias. Current digit ${currentLastDigit} is ${isCurrentOver ? 'over' : 'under'} ${threshold}`,
      isMatch
    };
  }

  /**
   * Generate Digits Under prediction
   */
  private static generateDigitsUnderPrediction(
    analysis: DigitAnalysisResult,
    currentLastDigit: number
  ): StrategyPrediction {
    const underBias = analysis.overUnderBias.under;
    const threshold = analysis.overUnderBias.threshold;
    const confidence = underBias;
    const isCurrentUnder = currentLastDigit <= threshold;
    const isMatch = isCurrentUnder && underBias > 50;
    const action = confidence >= this.MIN_CONFIDENCE_THRESHOLD && isMatch ? 'MATCH_NOW' : 'NO_SIGNAL';

    return {
      strategy: 'DIGITSUNDER',
      action,
      targetDigit: undefined, // Under strategy doesn't target specific digit
      currentDigit: currentLastDigit,
      confidence,
      reasoning: `Digits under/equal ${threshold} have ${underBias.toFixed(1)}% bias. Current digit ${currentLastDigit} is ${isCurrentUnder ? 'under/equal' : 'over'} ${threshold}`,
      isMatch
    };
  }

  /**
   * Generate bot trading signal
   */
  static generateTradingSignal(
    prediction: DigitPredictionModel,
    analysis: DigitAnalysisResult,
    currentLastDigit: number
  ): BotTradingSignal {
    const { predictedDigit, confidence, estimatedOccurrence } = prediction;

    // Determine strategy based on prediction method and digit characteristics
    let strategy: BotTradingSignal['strategy'];
    if (prediction.method === 'bias') {
      if (predictedDigit % 2 === 0) {
        strategy = 'DIGITSEVEN';
      } else {
        strategy = 'DIGITSODD';
      }
    } else if (predictedDigit > 5) {
      strategy = 'DIGITSOVER';
    } else if (predictedDigit < 5) {
      strategy = 'DIGITSUNDER';
    } else {
      strategy = 'DIGITSMATCH';
    }

    // Determine action based on confidence and risk
    let action: BotTradingSignal['action'] = 'WAIT';
    if (confidence >= 80) {
      action = 'BUY';
    } else if (confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
      action = 'BUY';
    } else {
      action = 'SKIP';
    }

    // Entry tick should be the current last digit of the price (0-9)
    // This is what the trader will use to make the trading decision
    const entryTick = currentLastDigit;

    // Risk assessment
    const riskAssessment = this.assessRisk(prediction, analysis);

    return {
      action,
      digit: predictedDigit,
      strategy,
      entryTick,
      confidence,
      duration: Math.min(10, Math.max(1, estimatedOccurrence)),
      reasoning: `${prediction.method} analysis suggests digit ${predictedDigit} with ${confidence.toFixed(1)}% confidence. Current last digit is ${currentLastDigit}.`,
      riskAssessment
    };
  }

  /**
   * Real-time synchronization check with Deriv data
   */
  static validateSynchronization(lastTick: PriceTick, expectedTime: Date): boolean {
    const timeDiff = Math.abs(new Date(lastTick.time).getTime() - expectedTime.getTime());
    return timeDiff < 5000; // Allow 5 second tolerance
  }

  // Private helper methods

  private static extractLastDigits(ticks: PriceTick[], instrument: VolatilityInstrumentType): number[] {
    // Get the correct decimal places for this instrument to preserve trailing zeros
    const decimalPlaces = getInstrumentDecimalPlaces(instrument);

    return ticks.map(tick => {
      // Use toFixed() with correct decimal places to preserve trailing zeros (including 0)
      const priceStr = tick.price.toFixed(decimalPlaces);
      const lastChar = priceStr.charAt(priceStr.length - 1);
      const lastDigit = parseInt(lastChar);

      // Ensure digit 0 is properly handled as a significant digit
      // parseInt('0') returns 0, which is falsy but valid
      return isNaN(lastDigit) ? 0 : lastDigit;
    });
  }

  private static calculateDigitFrequencies(digits: number[]): Record<number, number> {
    const frequencies: Record<number, number> = {};
    for (let i = 0; i <= 9; i++) {
      frequencies[i] = digits.filter(d => d === i).length;
    }
    return frequencies;
  }

  private static calculateDigitProbabilities(digits: number[]): Record<number, number> {
    const frequencies = this.calculateDigitFrequencies(digits);
    const probabilities: Record<number, number> = {};
    const total = digits.length;
    
    for (let i = 0; i <= 9; i++) {
      probabilities[i] = (frequencies[i] / total) * 100;
    }
    return probabilities;
  }

  private static calculateEvenOddBias(digits: number[]): { even: number; odd: number } {
    const evenCount = digits.filter(d => d % 2 === 0).length;
    const oddCount = digits.length - evenCount;
    const total = digits.length;

    return {
      even: (evenCount / total) * 100,
      odd: (oddCount / total) * 100
    };
  }

  private static calculateOverUnderBias(digits: number[], threshold: number): { over: number; under: number; threshold: number } {
    const overCount = digits.filter(d => d > threshold).length;
    const underCount = digits.filter(d => d < threshold).length;
    const total = digits.length;

    return {
      over: (overCount / total) * 100,
      under: (underCount / total) * 100,
      threshold
    };
  }

  private static analyzeConsecutivePatterns(digits: number[]): Record<string, number> {
    const patterns: Record<string, number> = {};
    
    for (let i = 0; i < digits.length - 1; i++) {
      const pattern = `${digits[i]}-${digits[i + 1]}`;
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    }

    return patterns;
  }

  private static analyzeStreaks(digits: number[]): Record<number, { current: number; max: number; avg: number }> {
    const streaks: Record<number, { current: number; max: number; avg: number }> = {};
    
    for (let digit = 0; digit <= 9; digit++) {
      const digitStreaks: number[] = [];
      let currentStreak = 0;
      
      for (const d of digits) {
        if (d === digit) {
          currentStreak++;
        } else {
          if (currentStreak > 0) {
            digitStreaks.push(currentStreak);
            currentStreak = 0;
          }
        }
      }
      
      if (currentStreak > 0) {
        digitStreaks.push(currentStreak);
      }

      streaks[digit] = {
        current: digits[digits.length - 1] === digit ? currentStreak : 0,
        max: Math.max(...digitStreaks, 0),
        avg: digitStreaks.length > 0 ? digitStreaks.reduce((a, b) => a + b, 0) / digitStreaks.length : 0
      };
    }

    return streaks;
  }

  private static analyzeGaps(digits: number[]): Record<number, { current: number; avg: number; max: number }> {
    const gaps: Record<number, { current: number; avg: number; max: number }> = {};
    
    for (let digit = 0; digit <= 9; digit++) {
      const digitGaps: number[] = [];
      let lastSeen = -1;
      
      for (let i = 0; i < digits.length; i++) {
        if (digits[i] === digit) {
          if (lastSeen >= 0) {
            digitGaps.push(i - lastSeen - 1);
          }
          lastSeen = i;
        }
      }

      const currentGap = lastSeen >= 0 ? digits.length - 1 - lastSeen : digits.length;

      gaps[digit] = {
        current: currentGap,
        avg: digitGaps.length > 0 ? digitGaps.reduce((a, b) => a + b, 0) / digitGaps.length : 10,
        max: Math.max(...digitGaps, 0)
      };
    }

    return gaps;
  }

  private static analyzeCyclicalPatterns(digits: number[]): Record<string, number> {
    const patterns: Record<string, number> = {};
    
    // Analyze 3-digit patterns
    for (let i = 0; i < digits.length - 2; i++) {
      const pattern = `${digits[i]}-${digits[i + 1]}-${digits[i + 2]}`;
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    }

    return patterns;
  }

  private static frequencyBasedPrediction(analysis: DigitAnalysisResult): DigitPredictionModel {
    const { digitProbabilities } = analysis;
    const sortedDigits = Object.entries(digitProbabilities)
      .sort(([,a], [,b]) => b - a)
      .map(([digit]) => parseInt(digit));

    const predictedDigit = sortedDigits[0];
    const confidence = digitProbabilities[predictedDigit] * 8; // Amplify for confidence

    return {
      predictedDigit,
      confidence: Math.min(confidence, 95),
      method: 'frequency',
      supportingEvidence: [`Highest frequency: ${digitProbabilities[predictedDigit].toFixed(1)}%`],
      estimatedOccurrence: Math.ceil(100 / digitProbabilities[predictedDigit]),
      riskLevel: confidence > 80 ? 'low' : confidence > 65 ? 'medium' : 'high'
    };
  }

  private static gapBasedPrediction(analysis: DigitAnalysisResult): DigitPredictionModel {
    const { gapAnalysis } = analysis;
    
    // Find digit with largest current gap relative to average
    let bestDigit = 0;
    let bestScore = 0;
    
    for (let digit = 0; digit <= 9; digit++) {
      const gap = gapAnalysis[digit];
      const score = gap.current / Math.max(gap.avg, 1);
      if (score > bestScore) {
        bestScore = score;
        bestDigit = digit;
      }
    }

    const confidence = Math.min(bestScore * 30, 90);

    return {
      predictedDigit: bestDigit,
      confidence,
      method: 'gap',
      supportingEvidence: [`Gap ratio: ${bestScore.toFixed(2)}`, `Current gap: ${gapAnalysis[bestDigit].current}`],
      estimatedOccurrence: Math.max(1, Math.floor(gapAnalysis[bestDigit].avg)),
      riskLevel: confidence > 75 ? 'low' : confidence > 60 ? 'medium' : 'high'
    };
  }

  private static patternBasedPrediction(analysis: DigitAnalysisResult): DigitPredictionModel {
    const { consecutivePatterns } = analysis;
    
    // Find most frequent pattern and predict next digit
    const sortedPatterns = Object.entries(consecutivePatterns)
      .filter(([,count]) => count >= this.PATTERN_MIN_OCCURRENCES)
      .sort(([,a], [,b]) => b - a);

    if (sortedPatterns.length === 0) {
      return {
        predictedDigit: 5,
        confidence: 50,
        method: 'pattern',
        supportingEvidence: ['No significant patterns found'],
        estimatedOccurrence: 10,
        riskLevel: 'high'
      };
    }

    const [bestPattern, count] = sortedPatterns[0];
    const [, nextDigit] = bestPattern.split('-').map(Number);
    const confidence = Math.min((count / Object.keys(consecutivePatterns).length) * 200, 85);

    return {
      predictedDigit: nextDigit,
      confidence,
      method: 'pattern',
      supportingEvidence: [`Pattern ${bestPattern} occurred ${count} times`],
      estimatedOccurrence: Math.ceil(100 / confidence),
      riskLevel: confidence > 70 ? 'low' : confidence > 55 ? 'medium' : 'high'
    };
  }

  private static biasBasedPrediction(analysis: DigitAnalysisResult): DigitPredictionModel {
    const { evenOddBias, overUnderBias } = analysis;
    
    let predictedDigit: number;
    let confidence: number;
    let evidence: string[];

    if (Math.abs(evenOddBias.even - 50) > Math.abs(overUnderBias.over - 50)) {
      predictedDigit = evenOddBias.even > 55 ? 2 : 3; // Representative even/odd
      confidence = Math.abs(evenOddBias.even - 50) * 2;
      evidence = [`Even bias: ${evenOddBias.even.toFixed(1)}%`];
    } else {
      predictedDigit = overUnderBias.over > 55 ? 7 : 3; // Representative over/under
      confidence = Math.abs(overUnderBias.over - 50) * 2;
      evidence = [`Over ${overUnderBias.threshold} bias: ${overUnderBias.over.toFixed(1)}%`];
    }

    return {
      predictedDigit,
      confidence: Math.min(confidence, 80),
      method: 'bias',
      supportingEvidence: evidence,
      estimatedOccurrence: Math.ceil(100 / Math.max(confidence, 10)),
      riskLevel: confidence > 70 ? 'low' : confidence > 55 ? 'medium' : 'high'
    };
  }

  private static hybridPrediction(analysis: DigitAnalysisResult, predictions: DigitPredictionModel[]): DigitPredictionModel {
    // Combine multiple prediction methods
    const digitScores: Record<number, number> = {};
    
    predictions.forEach(pred => {
      digitScores[pred.predictedDigit] = (digitScores[pred.predictedDigit] || 0) + pred.confidence;
    });

    const bestDigit = Object.entries(digitScores)
      .sort(([,a], [,b]) => b - a)
      .map(([digit]) => parseInt(digit))[0];

    const combinedConfidence = digitScores[bestDigit] / predictions.length;
    const supportingMethods = predictions
      .filter(p => p.predictedDigit === bestDigit)
      .map(p => p.method);

    return {
      predictedDigit: bestDigit,
      confidence: Math.min(combinedConfidence * 1.1, 90), // Slight boost for hybrid
      method: 'hybrid',
      supportingEvidence: [`Combined from: ${supportingMethods.join(', ')}`],
      estimatedOccurrence: Math.ceil(100 / Math.max(combinedConfidence, 10)),
      riskLevel: combinedConfidence > 75 ? 'low' : combinedConfidence > 60 ? 'medium' : 'high'
    };
  }

  private static assessRisk(prediction: DigitPredictionModel, analysis: DigitAnalysisResult): string {
    const risks: string[] = [];
    
    if (prediction.confidence < 70) {
      risks.push('Low confidence prediction');
    }
    
    if (prediction.estimatedOccurrence > 15) {
      risks.push('Long wait time expected');
    }
    
    const digitFreq = analysis.digitProbabilities[prediction.predictedDigit];
    if (digitFreq < 8) {
      risks.push('Digit historically underrepresented');
    }

    return risks.length > 0 ? risks.join('; ') : 'Low risk trade';
  }
}
