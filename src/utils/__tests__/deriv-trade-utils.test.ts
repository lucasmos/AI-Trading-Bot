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

    // NEW COMPREHENSIVE TESTS FOR BUY-ONLY AND COMPLETED TRADES
    describe('buy-only (open) trades', () => {
      it('should handle completely open trade with no sell information', () => {
        const openTrade = {
          id: 'open_12345',
          userId: 'user123',
          symbol: 'R_25',
          status: 'OPEN' as const,
          derivContractId: BigInt('123456789000'),
          derivBuyPrice: 250, // 2.50 USD in cents
          derivPayout: 487, // 4.87 USD in cents
          derivPurchaseTime: BigInt(1745277000),
          derivSellTime: undefined, // No sell time
          derivSellPrice: undefined, // No sell price
          derivContractType: 'DIGITODD',
          derivUnderlyingSymbol: 'R_25',
          derivLongcode: 'Win payout if the last digit of Volatility 25 Index is odd after 1 tick.',
          derivShortcode: 'DIGITODD_R_25_2.50_1745277000_1T',
          derivDurationType: 'ticks',
          derivAppId: 80447,
          derivTransactionId: BigInt('987654321000'),
          metadata: {}
        };

        const result = convertToDerivTradeRecord(openTrade);

        // Core trade information should be present
        expect(result.contract_id).toBe('123456789000');
        expect(result.buy_price).toBe(2.50);
        expect(result.payout).toBe(4.87);
        expect(result.status).toBe('open');
        expect(result.contract_type).toBe('DIGITODD');
        expect(result.underlying_symbol).toBe('R_25');
        expect(result.trade_type_display).toBe('Odd');
        expect(result.instrument_display).toBe('Volatility 25 Index');
        expect(result.transaction_id).toBe('987654321000');

        // Purchase time information should be present
        expect(result.purchase_time).toBe(1745277000);
        expect(result.purchase_date).toBe(formatDate(1745277000));
        expect(result.purchase_time_display).toBe(formatTime(1745277000));

        // Sell information should be undefined/null
        expect(result.sell_price).toBeUndefined();
        expect(result.sell_price_display).toBeUndefined();
        expect(result.sell_time).toBeUndefined();
        expect(result.sell_date).toBeUndefined();
        expect(result.sell_time_display).toBeUndefined();

        // Profit/loss should use payout for open trades
        expect(result.profit_loss).toBe(2.37); // 4.87 - 2.50
        expect(result.profit_loss_display).toBe(2.37);
      });

      it('should handle open trade with null sellTime', () => {
        const openTradeWithNull = {
          ...baseTradeFixture,
          derivSellTime: null,
          derivSellPrice: null,
          status: 'OPEN' as const
        };

        const result = convertToDerivTradeRecord(openTradeWithNull);

        expect(result.status).toBe('open');
        expect(result.sell_time).toBeUndefined(); // safeTimestampConversion(null) returns null, but sellTime stays undefined
        expect(result.sell_date).toBeUndefined();
        expect(result.sell_time_display).toBeUndefined();
        expect(result.sell_price).toBeUndefined();
      });

      it('should handle open trade derived from missing sell price', () => {
        const tradeWithoutStatus = {
          ...baseTradeFixture,
          status: undefined, // No explicit status
          derivSellPrice: undefined, // No sell price
          derivSellTime: undefined // No sell time
        };

        const result = convertToDerivTradeRecord(tradeWithoutStatus);

        expect(result.status).toBe('open'); // Should be derived as open
        expect(result.sell_time).toBeUndefined();
        expect(result.sell_date).toBeUndefined();
        expect(result.sell_time_display).toBeUndefined();
      });
    });

    describe('completed trades', () => {
      it('should handle winning trade with complete information', () => {
        const winningTrade = {
          id: 'win_12345',
          userId: 'user123',
          symbol: 'R_50',
          status: 'WON' as const,
          derivContractId: BigInt('555666777888'),
          derivBuyPrice: 400, // 4.00 USD in cents
          derivPayout: 780, // 7.80 USD in cents
          derivSellPrice: 780, // 7.80 USD in cents (winning payout)
          derivPurchaseTime: BigInt(1745280000),
          derivSellTime: BigInt(1745280003), // 3 seconds later
          derivContractType: 'DIGITEVEN',
          derivUnderlyingSymbol: 'R_50',
          derivLongcode: 'Win payout if the last digit of Volatility 50 Index is even after 1 tick.',
          derivShortcode: 'DIGITEVEN_R_50_4.00_1745280000_1T',
          derivDurationType: 'ticks',
          derivAppId: 80447,
          derivTransactionId: BigInt('111222333444'),
          metadata: {}
        };

        const result = convertToDerivTradeRecord(winningTrade);

        // Complete trade information
        expect(result.contract_id).toBe('555666777888');
        expect(result.buy_price).toBe(4.00);
        expect(result.sell_price).toBe(7.80);
        expect(result.sell_price_display).toBe(7.80);
        expect(result.payout).toBe(7.80);
        expect(result.status).toBe('won');
        expect(result.contract_type).toBe('DIGITEVEN');
        expect(result.underlying_symbol).toBe('R_50');
        expect(result.instrument_display).toBe('Volatility 50 Index');
        expect(result.transaction_id).toBe('111222333444');

        // Timestamps should be complete
        expect(result.purchase_time).toBe(1745280000);
        expect(result.sell_time).toBe(1745280003);
        expect(result.purchase_date).toBe(formatDate(1745280000));
        expect(result.purchase_time_display).toBe(formatTime(1745280000));
        expect(result.sell_date).toBe(formatDate(1745280003));
        expect(result.sell_time_display).toBe(formatTime(1745280003));

        // Profit calculation
        expect(result.profit_loss).toBe(3.80); // 7.80 - 4.00
        expect(result.profit_loss_display).toBe(3.80);
      });

      it('should handle losing trade with zero sell price', () => {
        const losingTrade = {
          id: 'lose_12345',
          userId: 'user123',
          symbol: 'R_75',
          status: 'LOST' as const,
          derivContractId: BigInt('999888777666'),
          derivBuyPrice: 350, // 3.50 USD in cents
          derivPayout: 683, // 6.83 USD in cents (what could have been won)
          derivSellPrice: 0, // 0 USD (lost trade)
          derivPurchaseTime: BigInt(1745285000),
          derivSellTime: BigInt(1745285002), // 2 seconds later
          derivContractType: 'DIGITUNDER',
          derivUnderlyingSymbol: 'R_75',
          derivLongcode: 'Win payout if the last digit of Volatility 75 Index is strictly lower than 3 after 1 tick.',
          derivShortcode: 'DIGITUNDER_R_75_3.50_1745285000_1T_3_0',
          derivDurationType: 'ticks',
          derivAppId: 80447,
          derivTransactionId: BigInt('777888999000'),
          metadata: {}
        };

        const result = convertToDerivTradeRecord(losingTrade);

        // Complete trade information
        expect(result.contract_id).toBe('999888777666');
        expect(result.buy_price).toBe(3.50);
        expect(result.sell_price).toBe(0); // Lost trade
        expect(result.sell_price_display).toBe(0);
        expect(result.payout).toBe(6.83); // What could have been won
        expect(result.status).toBe('lost');
        expect(result.contract_type).toBe('DIGITUNDER');
        expect(result.trade_type_display).toBe('Under');
        expect(result.underlying_symbol).toBe('R_75');
        expect(result.instrument_display).toBe('Volatility 75 Index');

        // Complete timestamps
        expect(result.purchase_time).toBe(1745285000);
        expect(result.sell_time).toBe(1745285002);
        expect(result.sell_date).toBe(formatDate(1745285002));
        expect(result.sell_time_display).toBe(formatTime(1745285002));

        // Loss calculation
        expect(result.profit_loss).toBe(-3.50); // 0 - 3.50
        expect(result.profit_loss_display).toBe(-3.50);
      });

      it('should handle cancelled trade', () => {
        const cancelledTrade = {
          id: 'cancel_12345',
          userId: 'user123',
          symbol: 'R_100',
          status: 'CANCELLED' as const,
          derivContractId: BigInt('111222333444'),
          derivBuyPrice: 200, // 2.00 USD in cents
          derivPayout: 390, // 3.90 USD in cents
          derivSellPrice: 200, // Refunded amount
          derivPurchaseTime: BigInt(1745290000),
          derivSellTime: BigInt(1745290001), // Cancelled quickly
          derivContractType: 'CALL',
          derivUnderlyingSymbol: 'R_100',
          derivDurationType: 'ticks',
          derivAppId: 80447,
          derivTransactionId: BigInt('444555666777'),
          metadata: {}
        };

        const result = convertToDerivTradeRecord(cancelledTrade);

        expect(result.status).toBe('cancelled');
        expect(result.contract_type).toBe('CALL');
        expect(result.trade_type_display).toBe('Rise');
        expect(result.buy_price).toBe(2.00);
        expect(result.sell_price).toBe(2.00); // Refunded
        expect(result.profit_loss).toBe(0.00); // Break even on cancellation
        expect(result.sell_time).toBe(1745290001);
        expect(result.sell_date).toBe(formatDate(1745290001));
        expect(result.sell_time_display).toBe(formatTime(1745290001));
      });

      it('should handle completed trade with epoch (0) sell time', () => {
        const tradeWithZeroSellTime = {
          ...baseTradeFixture,
          derivSellTime: BigInt(0), // Unix epoch
          status: 'WON' as const
        };

        const result = convertToDerivTradeRecord(tradeWithZeroSellTime);

        expect(result.sell_time).toBe(0);
        expect(result.sell_date).toBe('1970-01-01'); // Unix epoch date
        expect(result.sell_time_display).toBe('00:00:00'); // Unix epoch time
        expect(result.status).toBe('won');
      });

      it('should handle completed trade with closeTime fallback', () => {
        const tradeWithCloseTime = {
          ...baseTradeFixture,
          derivSellTime: undefined,
          closeTime: '2024-06-15T14:30:45Z',
          status: 'WON' as const
        };

        const result = convertToDerivTradeRecord(tradeWithCloseTime);

        const expectedSellTime = Math.floor(new Date('2024-06-15T14:30:45Z').getTime() / 1000);
        expect(result.sell_time).toBe(expectedSellTime);
        expect(result.sell_date).toBe('2024-06-15');
        expect(result.sell_time_display).toBe('14:30:45');
      });
    });

    describe('sellTime guarding behavior', () => {
      it('should only compute sell_date and sell_time_display when sellTime is a number', () => {
        const testCases = [
          {
            name: 'undefined sellTime',
            sellTime: undefined,
            expectedSellDate: undefined,
            expectedSellTimeDisplay: undefined
          },
          {
            name: 'null sellTime after conversion',
            derivSellTime: null,
            expectedSellTime: undefined,
            expectedSellDate: undefined,
            expectedSellTimeDisplay: undefined
          },
          {
            name: 'valid number sellTime',
            sellTime: 1745277401,
            expectedSellDate: formatDate(1745277401),
            expectedSellTimeDisplay: formatTime(1745277401)
          },
          {
            name: 'zero sellTime (epoch)',
            sellTime: 0,
            expectedSellDate: '1970-01-01',
            expectedSellTimeDisplay: '00:00:00'
          }
        ];

        testCases.forEach(({ name, sellTime, derivSellTime, expectedSellDate, expectedSellTimeDisplay }) => {
          const trade = {
            ...baseTradeFixture,
            derivSellTime: derivSellTime !== undefined ? derivSellTime : (sellTime !== undefined ? BigInt(sellTime) : undefined),
            status: sellTime !== undefined ? 'WON' : 'OPEN'
          };

          const result = convertToDerivTradeRecord(trade);

          expect(result.sell_date).toBe(expectedSellDate);
          expect(result.sell_time_display).toBe(expectedSellTimeDisplay);
        });
      });

      it('should preserve raw sellTime as number or undefined', () => {
        const openTrade = {
          ...baseTradeFixture,
          derivSellTime: undefined,
          status: 'OPEN' as const
        };

        const closedTrade = {
          ...baseTradeFixture,
          derivSellTime: BigInt(1745277404),
          status: 'WON' as const
        };

        const nullSellTimeTrade = {
          ...baseTradeFixture,
          derivSellTime: null,
          status: 'OPEN' as const
        };

        expect(convertToDerivTradeRecord(openTrade).sell_time).toBeUndefined();
        expect(convertToDerivTradeRecord(closedTrade).sell_time).toBe(1745277404);
        expect(convertToDerivTradeRecord(nullSellTimeTrade).sell_time).toBeUndefined();
      });
    });
  });

  describe('utility functions', () => {
    // Base test fixture for nested tests
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

      // NEW TESTS FOR REFACTORED BEHAVIOR
      it('should return empty string for null/undefined/NaN timestamps', () => {
        expect(formatDate(null as any)).toBe('');
        expect(formatDate(undefined as any)).toBe('');
        expect(formatDate(NaN)).toBe('');
        
        expect(formatTime(null as any)).toBe('');
        expect(formatTime(undefined as any)).toBe('');
        expect(formatTime(NaN)).toBe('');
      });

      it('should handle timestamp 0 (Unix epoch) correctly', () => {
        expect(formatDate(0)).toBe('1970-01-01');
        expect(formatTime(0)).toBe('00:00:00');
      });

      it('should handle valid positive timestamps correctly', () => {
        const testTimestamps = [
          { timestamp: 1609459200, expectedDate: '2021-01-01', expectedTime: '00:00:00' },
          { timestamp: 1745277401, expectedDate: '2025-04-21', expectedTime: '23:16:41' },
          { timestamp: 1, expectedDate: '1970-01-01', expectedTime: '00:00:01' }
        ];

        testTimestamps.forEach(({ timestamp, expectedDate, expectedTime }) => {
          expect(formatDate(timestamp)).toBe(expectedDate);
          expect(formatTime(timestamp)).toBe(expectedTime);
        });
      });

      // NEW TESTS TO CAPTURE TIMESTAMP ISSUE BEHAVIOR
      it('should handle null/undefined timestamps - capturing broken behavior', () => {
        // Test for current broken behavior - these should fail when we fix the bug
        expect(() => formatDate(null as any)).not.toThrow(); // Currently doesn't throw
        expect(() => formatTime(null as any)).not.toThrow(); // Currently doesn't throw
        expect(() => formatDate(undefined as any)).not.toThrow(); // Currently doesn't throw
        expect(() => formatTime(undefined as any)).not.toThrow(); // Currently doesn't throw
        
        // These will show what the current broken output looks like
        const nullDateResult = formatDate(null as any);
        const nullTimeResult = formatTime(null as any);
        const undefinedDateResult = formatDate(undefined as any);
        const undefinedTimeResult = formatTime(undefined as any);
        
        // Document the current broken behavior
        console.log('Current broken behavior for null/undefined timestamps:');
        console.log('formatDate(null):', nullDateResult);
        console.log('formatTime(null):', nullTimeResult);
        console.log('formatDate(undefined):', undefinedDateResult);
        console.log('formatTime(undefined):', undefinedTimeResult);
      });

      it('should handle NaN timestamps - capturing broken behavior', () => {
        // Test for current broken behavior with NaN
        expect(() => formatDate(NaN)).not.toThrow(); // Currently doesn't throw
        expect(() => formatTime(NaN)).not.toThrow(); // Currently doesn't throw
        
        const nanDateResult = formatDate(NaN);
        const nanTimeResult = formatTime(NaN);
        
        console.log('Current broken behavior for NaN timestamps:');
        console.log('formatDate(NaN):', nanDateResult);
        console.log('formatTime(NaN):', nanTimeResult);
      });
    });

    describe('safeTimestampConversion', () => {
      // Access the internal function through the module to test it
      // Since it's not exported, we'll test it through convertToDerivTradeRecord
      it('should handle null sellTime correctly with new behavior', () => {
        const tradeWithNullSellTime = {
          ...baseTradeFixture,
          derivSellTime: null, // This should result in undefined sellTime after null conversion
          status: 'OPEN' as const
        };
        
        const result = convertToDerivTradeRecord(tradeWithNullSellTime);
        
        // The safeTimestampConversion now returns null, but sellTime should still be undefined 
        // because the null is not assigned to sellTime (only non-null values are assigned)
        expect(result.sell_time).toBeUndefined();
        expect(result.sell_date).toBeUndefined();
        expect(result.sell_time_display).toBeUndefined();
      });

      it('should handle BigInt zero sellTime correctly', () => {
        const tradeWithZeroSellTime = {
          ...baseTradeFixture,
          derivSellTime: BigInt(0), // This should be treated as 0, not undefined
          status: 'LOST' as const
        };
        
        const result = convertToDerivTradeRecord(tradeWithZeroSellTime);
        
        // Document current behavior
        expect(result.sell_time).toBe(0); // Should be 0, not undefined
        expect(result.sell_date).toBe('1970-01-01'); // Unix epoch date
        expect(result.sell_time_display).toBe('00:00:00'); // Unix epoch time
        
        console.log('sellTime handling for BigInt(0) derivSellTime:', {
          sellTime: result.sell_time,
          sellDate: result.sell_date,
          sellTimeDisplay: result.sell_time_display
        });
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
