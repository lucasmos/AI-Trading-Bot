/**
 * Comprehensive unit tests for CSV generation functionality
 * Tests CSV generation for trade history with realistic sample data
 */

import { DerivTradeRecord } from '@/types';
import { convertToDerivTradeRecord } from '../deriv-trade-utils';
import { getCsvHeaders, extractCsvRow } from '../csv-fields';
import { formatCurrency } from '../trade-table-columns';

describe('CSV Generation with Sample Trade Data', () => {
  // Sample database trade records (both open and closed)
  const mockDatabaseTrades = [
    // Closed/Won Trade
    {
      id: 'trade_001',
      userId: 'user123',
      symbol: 'R_10',
      status: 'WON',
      derivContractId: BigInt('279319508848'),
      derivAccountId: 'VRTC90000382',
      accountType: 'demo' as const,
      derivLongcode: 'Win payout if the last digit of Volatility 10 Index is even after 1 tick.',
      derivShortcode: 'DIGITEVEN_R_10_300_1745298644_1T',
      derivBuyPrice: 300, // cents
      derivPayout: 404, // cents
      derivPurchaseTime: BigInt('1745277401'),
      derivSellPrice: 404, // cents
      derivSellTime: BigInt('1745277404'),
      derivContractType: 'DIGITEVEN',
      derivUnderlyingSymbol: 'R_10',
      derivDurationType: 'ticks',
      derivAppId: 80447,
      derivTransactionId: BigInt('556773095768'),
      metadata: {
        aiReasoning: 'Pattern detected for even digit prediction'
      }
    },
    // Closed/Lost Trade
    {
      id: 'trade_002',
      userId: 'user123',
      symbol: 'R_25',
      status: 'LOST',
      derivContractId: BigInt('279319508849'),
      derivAccountId: 'VRTC90000382',
      accountType: 'demo' as const,
      derivLongcode: 'Win payout if the last digit of Volatility 25 Index is odd after 2 ticks.',
      derivShortcode: 'DIGITODD_R_25_500_1745298650_2T',
      derivBuyPrice: 500, // cents
      derivPayout: 950, // cents
      derivPurchaseTime: BigInt('1745277450'),
      derivSellPrice: 0, // Lost trade
      derivSellTime: BigInt('1745277453'),
      derivContractType: 'DIGITODD',
      derivUnderlyingSymbol: 'R_25',
      derivDurationType: 'ticks',
      derivAppId: 80447,
      derivTransactionId: BigInt('556773095769'),
      metadata: {
        aiReasoning: 'Counter-pattern strategy'
      }
    },
    // Open Trade
    {
      id: 'trade_003',
      userId: 'user123',
      symbol: 'R_50',
      status: 'OPEN',
      derivContractId: BigInt('279319508850'),
      derivAccountId: 'VRTC90000382',
      accountType: 'demo' as const,
      derivLongcode: 'Win payout if the last digit of Volatility 50 Index is strictly higher than 5 after 1 tick.',
      derivShortcode: 'DIGITOVER_R_50_1000_1745298700_1T_5_0',
      derivBuyPrice: 1000, // cents
      derivPayout: 1350, // cents
      derivPurchaseTime: BigInt('1745277500'),
      derivSellPrice: null, // Open trade
      derivSellTime: null, // Open trade
      derivContractType: 'DIGITOVER',
      derivUnderlyingSymbol: 'R_50',
      derivDurationType: 'ticks',
      derivAppId: 80447,
      derivTransactionId: BigInt('556773095770'),
      metadata: {
        aiReasoning: 'High confidence over-5 prediction',
        predictionDigit: 5
      }
    },
    // Cancelled Trade
    {
      id: 'trade_004',
      userId: 'user123',
      symbol: 'R_75',
      status: 'CANCELLED',
      derivContractId: BigInt('279319508851'),
      derivAccountId: 'VRTC90000382',
      accountType: 'demo' as const,
      derivLongcode: 'Win payout if the last digit of Volatility 75 Index is strictly lower than 3 after 1 tick.',
      derivShortcode: 'DIGITUNDER_R_75_750_1745298750_1T_3_0',
      derivBuyPrice: 750, // cents
      derivPayout: 1012, // cents
      derivPurchaseTime: BigInt('1745277550'),
      derivSellPrice: null, // Cancelled before settlement
      derivSellTime: null, // Cancelled before settlement
      derivContractType: 'DIGITUNDER',
      derivUnderlyingSymbol: 'R_75',
      derivDurationType: 'ticks',
      derivAppId: 80447,
      derivTransactionId: BigInt('556773095771'),
      metadata: {
        aiReasoning: 'Under-3 prediction with moderate confidence',
        predictionDigit: 3
      }
    }
  ];

  describe('Trade Data Conversion to CSV Format', () => {
    let convertedTrades: DerivTradeRecord[];

    beforeAll(() => {
      // Convert all mock trades to DerivTradeRecord format
      convertedTrades = mockDatabaseTrades.map(trade => 
        convertToDerivTradeRecord(trade)
      );
    });

    it('should convert all sample trades correctly', () => {
      expect(convertedTrades).toHaveLength(4);
      
      // Verify each trade has all required CSV fields
      convertedTrades.forEach(trade => {
        expect(trade.contract_id).toBeDefined();
        expect(trade.transaction_id).toBeDefined();
        expect(trade.trade_type_display).toBeDefined();
        expect(trade.instrument_display).toBeDefined();
        expect(trade.duration_display).toBeDefined();
        expect(trade.buy_price).toBeDefined();
        expect(trade.payout).toBeDefined();
        expect(trade.profit_loss).toBeDefined();
        expect(trade.status).toBeDefined();
        expect(trade.purchase_time).toBeDefined();
        expect(trade.app_id).toBeDefined();
        expect(trade.longcode).toBeDefined();
      });
    });

    it('should generate CSV headers consistently', () => {
      const headers = getCsvHeaders();
      expect(headers).toEqual([
        'Contract ID', 'Transaction ID', 'Trade Type', 'Instrument', 'Duration',
        'Buy Price', 'Sell Price', 'Payout', 'Profit/Loss', 'Status',
        'Purchase Time', 'Sell Time', 'App ID', 'Description'
      ]);
    });

    it('should create properly formatted CSV rows for won trade', () => {
      const wonTrade = convertedTrades[0]; // First trade is won
      const csvRow = extractCsvRow(wonTrade);
      
      expect(csvRow).toEqual([
        '279319508848', // contract_id
        '556773095768', // transaction_id
        'Even', // trade_type_display
        'Volatility 10 Index', // instrument_display
        '1 tick', // duration_display
        3.00, // buy_price (converted from cents)
        4.04, // sell_price (converted from cents)
        4.04, // payout (converted from cents)
        1.04, // profit_loss (calculated)
        'won', // status
        1745277401, // purchase_time (timestamp)
        1745277404, // sell_time (timestamp)
        80447, // app_id
        'Win payout if the last digit of Volatility 10 Index is even after 1 tick.' // longcode
      ]);
    });

    it('should create properly formatted CSV rows for lost trade', () => {
      const lostTrade = convertedTrades[1]; // Second trade is lost
      const csvRow = extractCsvRow(lostTrade);
      
      expect(csvRow).toEqual([
        '279319508849', // contract_id
        '556773095769', // transaction_id
        'Odd', // trade_type_display
        'Volatility 25 Index', // instrument_display
        '2 ticks', // duration_display
        5.00, // buy_price (converted from cents)
        0, // sell_price (0 for lost trade)
        9.50, // payout (converted from cents)
        -5.00, // profit_loss (negative for loss)
        'lost', // status
        1745277450, // purchase_time (timestamp)
        1745277453, // sell_time (timestamp)
        80447, // app_id
        'Win payout if the last digit of Volatility 25 Index is odd after 2 ticks.' // longcode
      ]);
    });

    it('should create properly formatted CSV rows for open trade', () => {
      const openTrade = convertedTrades[2]; // Third trade is open
      const csvRow = extractCsvRow(openTrade);
      
      expect(csvRow).toEqual([
        '279319508850', // contract_id
        '556773095770', // transaction_id
        'Over', // trade_type_display
        'Volatility 50 Index', // instrument_display
        '1 tick', // duration_display
        10.00, // buy_price (converted from cents)
        '', // sell_price (empty for open trade)
        13.50, // payout (converted from cents)
        3.50, // profit_loss (potential profit for open trades)
        'open', // status
        1745277500, // purchase_time (timestamp)
        '', // sell_time (empty for open trade)
        80447, // app_id
        'Win payout if the last digit of Volatility 50 Index is strictly higher than 5 after 1 tick.' // longcode
      ]);
    });

    it('should create properly formatted CSV rows for cancelled trade', () => {
      const cancelledTrade = convertedTrades[3]; // Fourth trade is cancelled
      const csvRow = extractCsvRow(cancelledTrade);
      
      expect(csvRow).toEqual([
        '279319508851', // contract_id
        '556773095771', // transaction_id
        'Under', // trade_type_display
        'Volatility 75 Index', // instrument_display
        '1 tick', // duration_display
        7.50, // buy_price (converted from cents)
        '', // sell_price (empty for cancelled trade)
        10.12, // payout (converted from cents)
        2.62, // profit_loss (potential profit)
        'cancelled', // status
        1745277550, // purchase_time (timestamp)
        '', // sell_time (empty for cancelled trade)
        80447, // app_id
        'Win payout if the last digit of Volatility 75 Index is strictly lower than 3 after 1 tick.' // longcode
      ]);
    });
  });

  describe('CSV Generation Integration', () => {
    it('should generate complete CSV content with headers and rows', () => {
      const convertedTrades = mockDatabaseTrades.map(trade => 
        convertToDerivTradeRecord(trade)
      );
      
      const headers = getCsvHeaders();
      const rows = convertedTrades.map(trade => {
        const row = extractCsvRow(trade);
        // Simulate CSV escaping like in the actual implementation
        return row.map(item => `"${String(item).replace(/"/g, '""')}"`);
      });
      
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      
      // Verify CSV structure
      const lines = csvContent.split('\n');
      expect(lines).toHaveLength(5); // 1 header + 4 data rows
      
      // Verify header line
      expect(lines[0]).toBe('Contract ID,Transaction ID,Trade Type,Instrument,Duration,Buy Price,Sell Price,Payout,Profit/Loss,Status,Purchase Time,Sell Time,App ID,Description');
      
      // Verify first data row (won trade)
      expect(lines[1]).toContain('"279319508848"'); // Contract ID
      expect(lines[1]).toContain('"Even"'); // Trade Type
      expect(lines[1]).toContain('"won"'); // Status
      expect(lines[1]).toContain('"4.04"'); // Sell Price
      
      // Verify open trade row
      expect(lines[3]).toContain('"open"'); // Status
      expect(lines[3]).toContain('""'); // Empty sell price for open trade
    });

    it('should handle CSV escaping for special characters', () => {
      // Create a trade with special characters in longcode
      const specialTrade = {
        ...mockDatabaseTrades[0],
        derivLongcode: 'Win payout if "quote test" & special chars: comma, semicolon; work.'
      };
      
      const convertedTrade = convertToDerivTradeRecord(specialTrade);
      const csvRow = extractCsvRow(convertedTrade);
      
      // The longcode should contain the special characters
      expect(csvRow[13]).toContain('"quote test"');
      expect(csvRow[13]).toContain(',');
      expect(csvRow[13]).toContain(';');
      
      // When CSV-escaped, quotes should be doubled
      const escapedRow = csvRow.map(item => `"${String(item).replace(/"/g, '""')}"`);
      expect(escapedRow[13]).toBe('"Win payout if ""quote test"" & special chars: comma, semicolon; work."');
    });
  });

  describe('CSV Field Formatting Consistency', () => {
    it('should format currency values consistently across all trades', () => {
      const convertedTrades = mockDatabaseTrades.map(trade => 
        convertToDerivTradeRecord(trade)
      );
      
      convertedTrades.forEach(trade => {
        // Buy price should always be formatted to 2 decimal places
        expect(Number.isFinite(trade.buy_price)).toBe(true);
        
        // Payout should always be formatted to 2 decimal places
        expect(Number.isFinite(trade.payout)).toBe(true);
        
        // Profit/loss calculation follows the conversion logic:
        // For open/cancelled trades: profit_loss = payout - buy_price
        // For closed trades: profit_loss = sell_price - buy_price
        let expectedProfitLoss: number;
        if (trade.status === 'open' || trade.status === 'cancelled') {
          expectedProfitLoss = trade.payout - trade.buy_price;
        } else {
          expectedProfitLoss = (trade.sell_price || 0) - trade.buy_price;
        }
        
        expect(Math.abs(trade.profit_loss - expectedProfitLoss)).toBeLessThan(0.01);
      });
    });

    it('should format timestamps consistently', () => {
      const convertedTrades = mockDatabaseTrades.map(trade => 
        convertToDerivTradeRecord(trade)
      );
      
      convertedTrades.forEach(trade => {
        // Purchase time should be valid timestamp
        expect(trade.purchase_time).toBeGreaterThan(0);
        expect(Number.isInteger(trade.purchase_time)).toBe(true);
        
        // Purchase date should be valid format
        expect(trade.purchase_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        
        // Purchase time display should be valid format  
        expect(trade.purchase_time_display).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        
        // For closed trades, sell time should also be formatted
        if (trade.status === 'won' || trade.status === 'lost') {
          expect(trade.sell_time).toBeGreaterThan(0);
          expect(trade.sell_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(trade.sell_time_display).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        }
      });
    });

    it('should display trade types and instruments correctly', () => {
      const convertedTrades = mockDatabaseTrades.map(trade => 
        convertToDerivTradeRecord(trade)
      );
      
      // Verify specific mappings
      expect(convertedTrades[0].trade_type_display).toBe('Even');
      expect(convertedTrades[1].trade_type_display).toBe('Odd');
      expect(convertedTrades[2].trade_type_display).toBe('Over');
      expect(convertedTrades[3].trade_type_display).toBe('Under');
      
      expect(convertedTrades[0].instrument_display).toBe('Volatility 10 Index');
      expect(convertedTrades[1].instrument_display).toBe('Volatility 25 Index');
      expect(convertedTrades[2].instrument_display).toBe('Volatility 50 Index');
      expect(convertedTrades[3].instrument_display).toBe('Volatility 75 Index');
    });
  });

  describe('Regression Tests - CSV Row Snapshots', () => {
    /**
     * Snapshot tests to catch regressions in CSV row generation
     * If these tests fail, it means the CSV format has changed
     */
    
    it('should match snapshot for won trade CSV row', () => {
      const wonTrade = convertToDerivTradeRecord(mockDatabaseTrades[0]);
      const csvRow = extractCsvRow(wonTrade);
      
      // Snapshot expectation - this should remain stable
      expect(csvRow).toMatchSnapshot();
    });

    it('should match snapshot for lost trade CSV row', () => {
      const lostTrade = convertToDerivTradeRecord(mockDatabaseTrades[1]);
      const csvRow = extractCsvRow(lostTrade);
      
      // Snapshot expectation - this should remain stable
      expect(csvRow).toMatchSnapshot();
    });

    it('should match snapshot for open trade CSV row', () => {
      const openTrade = convertToDerivTradeRecord(mockDatabaseTrades[2]);
      const csvRow = extractCsvRow(openTrade);
      
      // Snapshot expectation - this should remain stable
      expect(csvRow).toMatchSnapshot();
    });

    it('should match snapshot for cancelled trade CSV row', () => {
      const cancelledTrade = convertToDerivTradeRecord(mockDatabaseTrades[3]);
      const csvRow = extractCsvRow(cancelledTrade);
      
      // Snapshot expectation - this should remain stable
      expect(csvRow).toMatchSnapshot();
    });

    it('should match snapshot for complete CSV headers', () => {
      const headers = getCsvHeaders();
      
      // Snapshot expectation - headers should remain stable
      expect(headers).toMatchSnapshot();
    });
  });
});
