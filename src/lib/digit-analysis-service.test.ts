import { DigitAnalysisService } from './digit-analysis-service';
import { PriceTick, VolatilityInstrumentType } from '@/types';

describe('DigitAnalysisService - 3+ Consecutive Digits Implementation', () => {
  const mockInstrument: VolatilityInstrumentType = 'Volatility 10 Index';

  // Helper function to create mock ticks with specific last digits
  const createMockTicks = (lastDigits: number[]): PriceTick[] => {
    return lastDigits.map((digit, index) => ({
      epoch: Date.now() + index * 1000,
      price: parseFloat(`100.${digit}`), // Creates prices like 100.1, 100.2, etc.
      time: new Date(Date.now() + index * 1000).toISOString()
    }));
  };

  describe('generateDigitsEvenPrediction', () => {
    it('should detect 3+ consecutive odd digits and signal MATCH_NOW when current digit is even', () => {
      // Create sequence: [1, 3, 5, 7, 2] - 4 consecutive odds followed by even
      const mockTicks = createMockTicks([0, 1, 3, 5, 7, 2]);
      const analysis = DigitAnalysisService.analyzeDigitPatterns(mockTicks, mockInstrument);
      const prediction = DigitAnalysisService.generateAllStrategyPredictions(analysis, 2);

      expect(prediction.digitsEven.action).toBe('MATCH_NOW');
      expect(prediction.digitsEven.reasoning).toContain('4 consecutive odd digits followed by even digit 2');
      expect(prediction.digitsEven.confidence).toBeGreaterThan(60);
    });

    it('should show NO_SIGNAL when only 2 consecutive odd digits are detected', () => {
      // Create sequence: [1, 3, 2] - only 2 consecutive odds
      const mockTicks = createMockTicks([0, 1, 3, 2]);
      const analysis = DigitAnalysisService.analyzeDigitPatterns(mockTicks, mockInstrument);
      const prediction = DigitAnalysisService.generateAllStrategyPredictions(analysis, 2);

      expect(prediction.digitsEven.action).toBe('NO_SIGNAL');
      expect(prediction.digitsEven.reasoning).toContain('No consecutive odd pattern detected');
    });

    it('should detect pattern but wait for even digit when current digit is odd', () => {
      // Create sequence: [1, 3, 5, 7, 9] - 5 consecutive odds, current is odd
      const mockTicks = createMockTicks([0, 1, 3, 5, 7, 9]);
      const analysis = DigitAnalysisService.analyzeDigitPatterns(mockTicks, mockInstrument);
      const prediction = DigitAnalysisService.generateAllStrategyPredictions(analysis, 9);

      expect(prediction.digitsEven.action).toBe('NO_SIGNAL');
      expect(prediction.digitsEven.reasoning).toContain('5 consecutive odd digits detected! Waiting for even digit to appear');
    });
  });

  describe('generateDigitsOddPrediction', () => {
    it('should detect 3+ consecutive even digits and signal MATCH_NOW when current digit is odd', () => {
      // Create sequence: [2, 4, 6, 8, 1] - 4 consecutive evens followed by odd
      const mockTicks = createMockTicks([0, 2, 4, 6, 8, 1]);
      const analysis = DigitAnalysisService.analyzeDigitPatterns(mockTicks, mockInstrument);
      const prediction = DigitAnalysisService.generateAllStrategyPredictions(analysis, 1);

      expect(prediction.digitsOdd.action).toBe('MATCH_NOW');
      expect(prediction.digitsOdd.reasoning).toContain('4 consecutive even digits followed by odd digit 1');
      expect(prediction.digitsOdd.confidence).toBeGreaterThan(60);
    });

    it('should show NO_SIGNAL when only 2 consecutive even digits are detected', () => {
      // Create sequence: [2, 4, 1] - only 2 consecutive evens
      const mockTicks = createMockTicks([0, 2, 4, 1]);
      const analysis = DigitAnalysisService.analyzeDigitPatterns(mockTicks, mockInstrument);
      const prediction = DigitAnalysisService.generateAllStrategyPredictions(analysis, 1);

      expect(prediction.digitsOdd.action).toBe('NO_SIGNAL');
      expect(prediction.digitsOdd.reasoning).toContain('No consecutive even pattern detected');
    });

    it('should detect pattern but wait for odd digit when current digit is even', () => {
      // Create sequence: [2, 4, 6, 8, 0] - 5 consecutive evens, current is even
      const mockTicks = createMockTicks([1, 2, 4, 6, 8, 0]);
      const analysis = DigitAnalysisService.analyzeDigitPatterns(mockTicks, mockInstrument);
      const prediction = DigitAnalysisService.generateAllStrategyPredictions(analysis, 0);

      expect(prediction.digitsOdd.action).toBe('NO_SIGNAL');
      expect(prediction.digitsOdd.reasoning).toContain('5 consecutive even digits detected! Waiting for odd digit to appear');
    });
  });

  describe('Edge Cases', () => {
    it('should handle digit 0 as even correctly', () => {
      // Create sequence: [2, 4, 6, 0, 1] - 4 consecutive evens (including 0) followed by odd
      const mockTicks = createMockTicks([1, 2, 4, 6, 0, 1]);
      const analysis = DigitAnalysisService.analyzeDigitPatterns(mockTicks, mockInstrument);
      const prediction = DigitAnalysisService.generateAllStrategyPredictions(analysis, 1);

      expect(prediction.digitsOdd.action).toBe('MATCH_NOW');
      expect(prediction.digitsOdd.reasoning).toContain('4 consecutive even digits followed by odd digit 1');
    });

    it('should require exactly 3+ consecutive digits, not just any 3 digits', () => {
      // Create sequence: [1, 2, 3, 4, 5] - alternating pattern, no 3+ consecutive
      const mockTicks = createMockTicks([0, 1, 2, 3, 4, 5]);
      const analysis = DigitAnalysisService.analyzeDigitPatterns(mockTicks, mockInstrument);
      const prediction = DigitAnalysisService.generateAllStrategyPredictions(analysis, 5);

      expect(prediction.digitsEven.action).toBe('NO_SIGNAL');
      expect(prediction.digitsOdd.action).toBe('NO_SIGNAL');
    });
  });

  describe('Pattern Detection for UI Notifications', () => {
    it('should include pattern detection text in reasoning when 3+ consecutive odds are found', () => {
      // Create sequence with 3+ consecutive odds but current digit is odd (pattern detected but no match yet)
      const mockTicks = createMockTicks([0, 1, 3, 5, 7]);
      const analysis = DigitAnalysisService.analyzeDigitPatterns(mockTicks, mockInstrument);
      const prediction = DigitAnalysisService.generateAllStrategyPredictions(analysis, 7);

      expect(prediction.digitsEven.reasoning).toContain('consecutive odd digits detected!');
    });

    it('should include pattern detection text in reasoning when 3+ consecutive evens are found', () => {
      // Create sequence with 3+ consecutive evens but current digit is even (pattern detected but no match yet)
      const mockTicks = createMockTicks([1, 2, 4, 6, 8]);
      const analysis = DigitAnalysisService.analyzeDigitPatterns(mockTicks, mockInstrument);
      const prediction = DigitAnalysisService.generateAllStrategyPredictions(analysis, 8);

      expect(prediction.digitsOdd.reasoning).toContain('consecutive even digits detected!');
    });
  });
});
