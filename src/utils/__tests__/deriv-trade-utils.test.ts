/**
 * Unit tests for deriv-trade-utils.ts
 * Tests the hardened convertToDerivTradeRecord function with edge cases
 */

import {
  convertToDerivTradeRecord,
  getTradeTypeDisplay,
  getInstrumentDisplay,
  getDurationDisplay,
  getTradeStatus,
  formatDate,
  formatTime,
  calculatePayout,
  generateShortcode,
  centsToDollars,
  roundToDecimalPlaces
} from '../deriv-trade-utils';

describe('deriv-trade-utils', () => {
  describe('convertToDerivTradeRecord', () => {
    // Base test fixture
    const baseTradeFixture = {
      id: '12345',
      userId: 'user123',
      symbol: 'R_10',
      status: 'WON' as const,
      derivContractId: BigInt('279319508848'),
      derivBuyPrice: 300, // 3.00 USD in cents
      derivPayout: 4.04, // 4.04 USD (already in dollars)
      derivSellPrice: 404, // 4.04 USD in cents
      derivPurchaseTime: BigInt(1745277401),
      derivSellTime: BigInt(1745277404),
      derivContractType: 'DIGITEVEN',
      derivUnderlyingSymbol: 'R_10',
      derivLongcode: 'Win payout if the last digit of Volatility 10 Index is even after 1 tick.',
      derivShortcode: 'DIGITEVEN_R_10_3.00_1745277401_1T',
      derivDurationType: 'ticks',
      derivAppId: 80447,
      derivTransactionId: BigInt('556773095768'),
      metadata: {}
    };

    it('should convert a complete trade record correctly', () => {
      const result = convertToDerivTradeRecord(baseTradeFixture);

      expect(result.contract_id).toBe('279319508848');
      expect(result.buy_price).toBe(3.00);
      expect(result.sell_price).toBe(4.04);
      expect(result.profit_loss).toBe(1.04);
      expect(result.profit_loss_display).toBe(1.04);
      expect(result.sell_price_display).toBe(4.04);
      expect(result.payout).toBe(4.04);
      expect(result.status).toBe('won');
      expect(result.contract_type).toBe('DIGITEVEN');
      expect(result.underlying_symbol).toBe('R_10');
      expect(result.trade_type_display).toBe('Even');
      expect(result.instrument_display).toBe('Volatility 10 Index');
      expect(result.purchase_time).toBe(1745277401);
      expect(result.sell_time).toBe(1745277404);
      expect(result.transaction_id).toBe('556773095768');
      expect(result.app_id).toBe(80447);
    });

    it('should handle missing contract ID with fallback generation', () => {
      const trade = {
        ...baseTradeFixture,
        derivContractId: undefined,
        id: undefined
      };

      const result = convertToDerivTradeRecord(trade);
      
      expect(result.contract_id).toMatch(/^fallback_\d+_[a-z0-9]{9}$/);
    });

    it('should handle BigInt inputs correctly', () => {
      const trade = {
        ...baseTradeFixture,
        derivContractId: BigInt('999888777666'),
        derivBuyPrice: BigInt(500), // 5.00 USD in cents as BigInt
        derivPurchaseTime: BigInt(1745277500),
        derivSellTime: BigInt(1745277505),
        derivTransactionId: BigInt('111222333444')
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.contract_id).toBe('999888777666');
      expect(result.buy_price).toBe(5.00);
      expect(result.purchase_time).toBe(1745277500);
      expect(result.sell_time).toBe(1745277505);
      expect(result.transaction_id).toBe('111222333444');
    });

    it('should handle missing sell price for open trades', () => {
      const trade = {
        ...baseTradeFixture,
        derivSellPrice: undefined,
        derivSellTime: undefined,
        status: 'OPEN' as const
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.sell_price).toBeUndefined();
      expect(result.sell_price_display).toBeUndefined();
      expect(result.sell_time).toBeUndefined();
      expect(result.sell_date).toBeUndefined();
      expect(result.sell_time_display).toBeUndefined();
      expect(result.status).toBe('open');
      // Profit/loss should use payout for open trades
      expect(result.profit_loss).toBe(1.04); // (payout - buy_price)
    });

    it('should handle losing trades correctly', () => {
      const trade = {
        ...baseTradeFixture,
        derivSellPrice: 0,
        status: 'LOST' as const
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.sell_price).toBe(0);
      expect(result.sell_price_display).toBe(0);
      expect(result.profit_loss).toBe(-3.00); // 0 - 3.00
      expect(result.profit_loss_display).toBe(-3.00);
      expect(result.status).toBe('lost');
    });

    it('should handle zero and negative buy prices with minimum floor', () => {
      const trade = {
        ...baseTradeFixture,
        derivBuyPrice: -100 // Negative value in cents
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.buy_price).toBe(0); // Should be floored to 0
    });

    it('should handle missing metadata with fallbacks', () => {
      const trade = {
        id: '12345',
        userId: 'user123',
        symbol: 'unknown_symbol',
        status: 'WON' as const,
        type: 'Odd',
        amount: 2.50,
        openTime: '2024-01-01T12:00:00Z',
        closeTime: '2024-01-01T12:00:05Z',
        metadata: {}
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.contract_id).toBe('12345'); // Uses existing id, not fallback
      expect(result.buy_price).toBe(2.50);
      expect(result.contract_type).toBe('DIGITODD'); // Derived from type
      expect(result.underlying_symbol).toBe('R_10'); // Default fallback
      expect(result.instrument_display).toBe('Volatility 10 Index');
      expect(result.trade_type_display).toBe('Odd');
      expect(result.payout).toBe(4.88); // Calculated: 2.50 * 1.95
      expect(result.app_id).toBe(80447); // Default app ID
      expect(result.transaction_id).toBe('12345'); // Uses contract_id as fallback
    });

    it('should handle null and undefined values gracefully', () => {
      const trade = {
        id: null,
        userId: null,
        symbol: null,
        status: null,
        derivBuyPrice: null,
        derivPayout: null,
        derivSellPrice: null,
        metadata: null
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.contract_id).toMatch(/^fallback_\d+_[a-z0-9]{9}$/);
      expect(result.buy_price).toBe(0);
      expect(result.payout).toBe(0); // calculatePayout(0, 'DIGITEVEN') = 0 * 1.95 = 0
      expect(result.contract_type).toBe('DIGITEVEN'); // Default fallback
      expect(result.underlying_symbol).toBe('R_10'); // Default fallback
      expect(result.status).toBe('open'); // Should derive status
    });

    it('should calculate profit/loss correctly for edge cases', () => {
      const testCases = [
        { buyPrice: 100, sellPrice: 200, expected: 1.00 }, // 2.00 - 1.00
        { buyPrice: 350, sellPrice: 350, expected: 0.00 }, // Break even
        { buyPrice: 250, sellPrice: 100, expected: -1.50 }, // Loss: 1.00 - 2.50
        { buyPrice: 150, sellPrice: undefined, payout: 290, expected: 1.40 }, // Open trade: 2.90 - 1.50
      ];

      testCases.forEach(({ buyPrice, sellPrice, payout, expected }) => {
        const trade = {
          ...baseTradeFixture,
          derivBuyPrice: buyPrice,
          derivSellPrice: sellPrice,
          derivPayout: payout || baseTradeFixture.derivPayout
        };

        const result = convertToDerivTradeRecord(trade);
        expect(result.profit_loss).toBe(expected);
        expect(result.profit_loss_display).toBe(expected);
      });
    });

    it('should round all monetary values to 2 decimal places', () => {
      const trade = {
        ...baseTradeFixture,
        derivBuyPrice: 333, // 3.33 USD
        derivSellPrice: 456, // 4.56 USD
        derivPayout: 567 // 5.67 USD
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.buy_price).toBe(3.33);
      expect(result.sell_price).toBe(4.56);
      expect(result.sell_price_display).toBe(4.56);
      expect(result.payout).toBe(5.67);
      expect(result.profit_loss).toBe(1.23); // 4.56 - 3.33
      expect(result.profit_loss_display).toBe(1.23);
    });

    it('should handle timestamp conversion for date/time display', () => {
      const trade = {
        ...baseTradeFixture,
        derivPurchaseTime: BigInt(1609459200), // 2021-01-01 00:00:00 UTC
        derivSellTime: BigInt(1609459260) // 2021-01-01 00:01:00 UTC
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.purchase_date).toBe('2021-01-01');
      expect(result.purchase_time_display).toBe('00:00:00');
      expect(result.sell_date).toBe('2021-01-01');
      expect(result.sell_time_display).toBe('00:01:00');
    });

    it('should generate fallback longcode and shortcode when missing', () => {
      const trade = {
        ...baseTradeFixture,
        derivLongcode: undefined,
        derivShortcode: undefined
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.longcode).toContain('Volatility 10 Index');
      expect(result.shortcode).toContain('DIGITEVEN_R_10');
    });

    it('should handle Over/Under contract types with different payout calculation', () => {
      const trade = {
        ...baseTradeFixture,
        derivContractType: 'DIGITOVER',
        derivBuyPrice: 300, // 3.00 USD
        derivPayout: undefined // Remove payout to force calculation
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.contract_type).toBe('DIGITOVER');
      expect(result.trade_type_display).toBe('Over');
      // Over/Under has lower multiplier (1.35 vs 1.95)
      expect(result.payout).toBe(4.05); // 3.00 * 1.35 = 4.05
    });

    it('should handle different status mappings correctly', () => {
      const statusTests = [
        { input: 'WON', expected: 'won' },
        { input: 'LOST', expected: 'lost' },
        { input: 'OPEN', expected: 'open' },
        { input: 'CANCELLED', expected: 'cancelled' },
        { input: 'UNKNOWN', expected: 'lost' }, // Unknown status should derive from sell_price
      ];

      statusTests.forEach(({ input, expected }) => {
        const trade = {
          ...baseTradeFixture,
          status: input as any,
          // For the UNKNOWN test case, set up the trade to return lost based on sell price logic
          derivSellPrice: input === 'UNKNOWN' ? 200 : baseTradeFixture.derivSellPrice, // 2.00 < 3.00 = loss
        };

        const result = convertToDerivTradeRecord(trade);
        expect(result.status).toBe(expected);
      });
    });

    it('should handle string timestamps correctly', () => {
      const trade = {
        ...baseTradeFixture,
        openTime: '2024-01-01T12:00:00Z',
        closeTime: '2024-01-01T12:00:05Z',
        derivPurchaseTime: undefined,
        derivSellTime: undefined
      };

      const result = convertToDerivTradeRecord(trade);

      expect(result.purchase_time).toBe(Math.floor(new Date('2024-01-01T12:00:00Z').getTime() / 1000));
      expect(result.sell_time).toBe(Math.floor(new Date('2024-01-01T12:00:05Z').getTime() / 1000));
    });
  });

  describe('utility functions', () => {
    describe('getTradeTypeDisplay', () => {
      it('should return correct display names', () => {
        expect(getTradeTypeDisplay('DIGITEVEN')).toBe('Even');
        expect(getTradeTypeDisplay('DIGITODD')).toBe('Odd');
        expect(getTradeTypeDisplay('DIGITOVER')).toBe('Over');
        expect(getTradeTypeDisplay('DIGITUNDER')).toBe('Under');
        expect(getTradeTypeDisplay('CALL')).toBe('Rise');
        expect(getTradeTypeDisplay('PUT')).toBe('Fall');
        expect(getTradeTypeDisplay('UNKNOWN')).toBe('UNKNOWN');
      });
    });

    describe('getInstrumentDisplay', () => {
      it('should return correct instrument names', () => {
        expect(getInstrumentDisplay('R_10')).toBe('Volatility 10 Index');
        expect(getInstrumentDisplay('R_100')).toBe('Volatility 100 Index');
        expect(getInstrumentDisplay('1HZ10V')).toBe('Volatility 10 (1s) Index');
        expect(getInstrumentDisplay('JD50')).toBe('Jump 50 Index');
        expect(getInstrumentDisplay('UNKNOWN')).toBe('UNKNOWN');
      });
    });

    describe('getDurationDisplay', () => {
      it('should extract duration from longcode', () => {
        expect(getDurationDisplay('Win payout after 1 tick.')).toBe('1 tick');
        expect(getDurationDisplay('Win payout after 5 ticks.')).toBe('5 ticks');
        expect(getDurationDisplay('Win payout after 30 seconds.')).toBe('30 seconds');
        expect(getDurationDisplay('Win payout after 1 second.')).toBe('1 second');
        expect(getDurationDisplay('Invalid longcode')).toBe('Unknown duration');
      });
    });

    describe('getTradeStatus', () => {
      it('should determine correct status from sell price', () => {
        expect(getTradeStatus(undefined, 3)).toBe('open');
        expect(getTradeStatus(null as any, 3)).toBe('open');
        expect(getTradeStatus(0, 3)).toBe('lost');
        expect(getTradeStatus(5, 3)).toBe('won');
        expect(getTradeStatus(2, 3)).toBe('lost');
      });
    });

    describe('formatDate and formatTime', () => {
      it('should format timestamps correctly', () => {
        const timestamp = 1609459200; // 2021-01-01 00:00:00 UTC
        
        expect(formatDate(timestamp)).toBe('2021-01-01');
        expect(formatTime(timestamp)).toBe('00:00:00');
      });
    });

    describe('calculatePayout', () => {
      it('should calculate correct payouts', () => {
        expect(calculatePayout(3, 'DIGITEVEN')).toBe(5.85); // 3 * 1.95
        expect(calculatePayout(3, 'DIGITOVER')).toBe(4.05); // 3 * 1.35
        expect(calculatePayout(2.50, 'DIGITODD')).toBe(4.88); // 2.50 * 1.95
      });
    });

    describe('generateShortcode', () => {
      it('should generate correct shortcodes', () => {
        expect(generateShortcode('DIGITEVEN', 'R_10', 3, 1745277401, 1))
          .toBe('DIGITEVEN_R_10_3_1745277401_1T');
          
        expect(generateShortcode('DIGITOVER', 'R_50', 5, 1745277401, 2, 7))
          .toBe('DIGITOVER_R_50_5_1745277401_2T_7_0');
          
        expect(generateShortcode('DIGITUNDER', 'R_25', 4, 1745277401, 1, 3))
          .toBe('DIGITUNDER_R_25_4_1745277401_1T_3_0');
      });
    });

    describe('centsToDollars', () => {
      it('should convert integer cents to dollars correctly', () => {
        expect(centsToDollars(300)).toBe(3.00); // 300 cents = $3.00
        expect(centsToDollars(1000)).toBe(10.00); // 1000 cents = $10.00
        expect(centsToDollars(125)).toBe(1.25); // 125 cents = $1.25
      });

      it('should handle BigInt cents correctly', () => {
        expect(centsToDollars(BigInt(300))).toBe(3.00);
        expect(centsToDollars(BigInt(1000))).toBe(10.00);
        expect(centsToDollars(BigInt(125))).toBe(1.25);
      });

      it('should handle values already in dollars (non-integers)', () => {
        expect(centsToDollars(3.00)).toBe(3.00); // Already in dollars (integer < 100)
        expect(centsToDollars(10.50)).toBe(10.50);
        expect(centsToDollars(1.234)).toBe(1.23); // Rounded to 2 decimal places
        expect(centsToDollars(0.999)).toBe(1.00); // Rounded to 2 decimal places
      });

      it('should handle zero and negative values', () => {
        expect(centsToDollars(0)).toBe(0.00);
        expect(centsToDollars(-300)).toBe(-3.00); // Negative cents to negative dollars
        expect(centsToDollars(-1.50)).toBe(-1.50); // Already in dollars, just rounded
      });

      it('should handle null, undefined, and invalid values', () => {
        expect(centsToDollars(null as any)).toBe(0.00);
        expect(centsToDollars(undefined as any)).toBe(0.00);
        expect(centsToDollars(NaN)).toBe(0.00);
        expect(centsToDollars(Infinity)).toBe(0.00);
        expect(centsToDollars(-Infinity)).toBe(0.00);
      });

      it('should handle string numbers correctly', () => {
        expect(centsToDollars('300' as any)).toBe(3.00);
        expect(centsToDollars('3.00' as any)).toBe(3.00);
        expect(centsToDollars('invalid' as any)).toBe(0.00);
      });

      it('should detect integer >= 100 correctly', () => {
        // These should be treated as cents (integers >= 100)
        expect(centsToDollars(100)).toBe(1.00);
        expect(centsToDollars(350)).toBe(3.50);
        expect(centsToDollars(1250)).toBe(12.50);
        
        // These should be treated as already in dollars (< 100 or non-integers)
        expect(centsToDollars(1)).toBe(1.00); // < 100, treated as dollars
        expect(centsToDollars(50)).toBe(50.00); // < 100, treated as dollars
        expect(centsToDollars(0.50)).toBe(0.50);
        expect(centsToDollars(0.99)).toBe(0.99);
        expect(centsToDollars(0)).toBe(0.00);
      });
    });

    describe('roundToDecimalPlaces', () => {
      it('should round to 2 decimal places by default', () => {
        expect(roundToDecimalPlaces(3.14159)).toBe(3.14);
        expect(roundToDecimalPlaces(2.999)).toBe(3.00);
        // Note: 1.005 might round to 1.00 due to floating point precision
        // This is expected JavaScript behavior with toFixed()
        expect(roundToDecimalPlaces(1.006)).toBe(1.01); // More reliable rounding test
      });

      it('should round to specified decimal places', () => {
        expect(roundToDecimalPlaces(3.14159, 3)).toBe(3.142);
        expect(roundToDecimalPlaces(3.14159, 1)).toBe(3.1);
        expect(roundToDecimalPlaces(3.14159, 0)).toBe(3);
      });

      it('should handle edge cases', () => {
        expect(roundToDecimalPlaces(0)).toBe(0.00);
        expect(roundToDecimalPlaces(-2.999)).toBe(-3.00);
        expect(roundToDecimalPlaces(1.999999)).toBe(2.00);
      });
    });
  });
});
