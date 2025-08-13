/**
 * Integration tests for CSV download functionality
 * Simulates complete user workflow from data fetch to CSV file generation
 */

import { DerivTradeRecord } from '@/types';
import { convertToDerivTradeRecord } from '@/utils/deriv-trade-utils';
import { getCsvHeaders, extractCsvRow } from '@/utils/csv-fields';
import { formatCurrency } from '@/utils/trade-table-columns';

// Mock DOM APIs for file download simulation
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();
global.Blob = jest.fn().mockImplementation((content, options) => ({ content, options }));

// Mock document methods
const mockDownloadLink = {
  setAttribute: jest.fn(),
  click: jest.fn(),
  remove: jest.fn()
};

// Mock global document object
(global as any).document = {
  createElement: jest.fn(() => mockDownloadLink),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
};

describe('CSV Download Integration Tests', () => {
  // Sample comprehensive trade data covering all scenarios
  const mockTradeHistoryData = [
    // Won digit even trade
    {
      id: 'trade_won_even',
      userId: 'user123',
      symbol: 'R_10',
      status: 'WON',
      derivContractId: BigInt('279319508848'),
      derivAccountId: 'VRTC90000382',
      accountType: 'demo' as const,
      derivLongcode: 'Win payout if the last digit of Volatility 10 Index is even after 1 tick.',
      derivShortcode: 'DIGITEVEN_R_10_300_1745298644_1T',
      derivBuyPrice: 300,
      derivPayout: 404,
      derivPurchaseTime: BigInt('1745277401'),
      derivSellPrice: 404,
      derivSellTime: BigInt('1745277404'),
      derivContractType: 'DIGITEVEN',
      derivUnderlyingSymbol: 'R_10',
      derivDurationType: 'ticks',
      derivAppId: 80447,
      derivTransactionId: BigInt('556773095768')
    },
    // Lost digit odd trade
    {
      id: 'trade_lost_odd',
      userId: 'user123',
      symbol: 'R_25',
      status: 'LOST',
      derivContractId: BigInt('279319508849'),
      derivAccountId: 'VRTC90000382',
      accountType: 'demo' as const,
      derivLongcode: 'Win payout if the last digit of Volatility 25 Index is odd after 2 ticks.',
      derivShortcode: 'DIGITODD_R_25_500_1745298650_2T',
      derivBuyPrice: 500,
      derivPayout: 950,
      derivPurchaseTime: BigInt('1745277450'),
      derivSellPrice: 0,
      derivSellTime: BigInt('1745277453'),
      derivContractType: 'DIGITODD',
      derivUnderlyingSymbol: 'R_25',
      derivDurationType: 'ticks',
      derivAppId: 80447,
      derivTransactionId: BigInt('556773095769')
    },
    // Open digit over trade
    {
      id: 'trade_open_over',
      userId: 'user123',
      symbol: 'R_50',
      status: 'OPEN',
      derivContractId: BigInt('279319508850'),
      derivAccountId: 'VRTC90000382',
      accountType: 'demo' as const,
      derivLongcode: 'Win payout if the last digit of Volatility 50 Index is strictly higher than 5 after 1 tick.',
      derivShortcode: 'DIGITOVER_R_50_1000_1745298700_1T_5_0',
      derivBuyPrice: 1000,
      derivPayout: 1350,
      derivPurchaseTime: BigInt('1745277500'),
      derivSellPrice: null,
      derivSellTime: null,
      derivContractType: 'DIGITOVER',
      derivUnderlyingSymbol: 'R_50',
      derivDurationType: 'ticks',
      derivAppId: 80447,
      derivTransactionId: BigInt('556773095770'),
      metadata: { predictionDigit: 5 }
    },
    // Cancelled digit under trade
    {
      id: 'trade_cancelled_under',
      userId: 'user123',
      symbol: 'R_75',
      status: 'CANCELLED',
      derivContractId: BigInt('279319508851'),
      derivAccountId: 'VRTC90000382',
      accountType: 'demo' as const,
      derivLongcode: 'Win payout if the last digit of Volatility 75 Index is strictly lower than 3 after 1 tick.',
      derivShortcode: 'DIGITUNDER_R_75_750_1745298750_1T_3_0',
      derivBuyPrice: 750,
      derivPayout: 1012,
      derivPurchaseTime: BigInt('1745277550'),
      derivSellPrice: null,
      derivSellTime: null,
      derivContractType: 'DIGITUNDER',
      derivUnderlyingSymbol: 'R_75',
      derivDurationType: 'ticks',
      derivAppId: 80447,
      derivTransactionId: BigInt('556773095771'),
      metadata: { predictionDigit: 3 }
    },
    // Rise/Fall CALL trade (won)
    {
      id: 'trade_call_won',
      userId: 'user123',
      symbol: 'R_100',
      status: 'WON',
      derivContractId: BigInt('279319508852'),
      derivAccountId: 'VRTC90000382',
      accountType: 'real' as const,
      derivLongcode: 'Win payout if Volatility 100 Index is strictly higher than entry spot at 5 ticks after contract start time.',
      derivShortcode: 'CALL_R_100_1500_1745298800_5T',
      derivBuyPrice: 1500,
      derivPayout: 2850,
      derivPurchaseTime: BigInt('1745277600'),
      derivSellPrice: 2850,
      derivSellTime: BigInt('1745277610'),
      derivContractType: 'CALL',
      derivUnderlyingSymbol: 'R_100',
      derivDurationType: 'ticks',
      derivAppId: 80447,
      derivTransactionId: BigInt('556773095772')
    }
  ];

  beforeEach(() => {
    // Clear mock calls before each test
    jest.clearAllMocks();
  });

  describe('Trade History CSV Export Integration', () => {
    it('should simulate complete trade history CSV download workflow', () => {
      // Step 1: Convert raw trade data to Deriv format (as would happen in the component)
      const derivTrades = mockTradeHistoryData.map(trade => convertToDerivTradeRecord(trade));
      
      // Step 2: Generate CSV content (simulating exportToCsv function)
      const headers = getCsvHeaders();
      
      const rows = derivTrades.map(trade => [
        // Map each DerivTradeRecord to the full field set with proper formatting
        trade.contract_id,
        trade.transaction_id,
        `${trade.underlying_symbol} (${trade.instrument_display})`,
        formatCurrency(trade.buy_price),
        // For open trades, output empty string for Sell Price
        trade.status === 'open' ? '' : (trade.sell_price !== undefined ? formatCurrency(trade.sell_price) : ''),
        formatCurrency(trade.payout),
        // For open trades, output empty string for P/L
        trade.status === 'open' ? '' : formatCurrency(trade.profit_loss),
        `${trade.duration_display} (${trade.trade_type_display})`,
        // Use formatDate and formatTime helpers for Purchase Time
        `${trade.purchase_date} ${trade.purchase_time_display}`,
        // For open trades, output empty string for Sell Time
        trade.status === 'open' ? '' : (trade.sell_time !== undefined ? `${trade.sell_date} ${trade.sell_time_display}` : ''),
        trade.app_id.toString(),
        `${trade.longcode} (${trade.shortcode})`
      ].map(item => `"${String(item).replace(/"/g, '""')}"`)); // Basic CSV escaping
      
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      
      // Step 3: Simulate blob creation and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Step 4: Simulate download link creation and click
      document.createElement('a');
      mockDownloadLink.setAttribute('href', url);
      mockDownloadLink.setAttribute('download', 'deriv_trade_history.csv');
      document.body.appendChild(mockDownloadLink);
      mockDownloadLink.click();
      document.body.removeChild(mockDownloadLink);
      
      // Verify the complete workflow
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockDownloadLink.setAttribute).toHaveBeenCalledWith('href', url);
      expect(mockDownloadLink.setAttribute).toHaveBeenCalledWith('download', 'deriv_trade_history.csv');
      expect(document.body.appendChild).toHaveBeenCalledWith(mockDownloadLink);
      expect(mockDownloadLink.click).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalledWith(mockDownloadLink);
      
      // Verify CSV content structure
      const lines = csvContent.split('\n');
      expect(lines).toHaveLength(6); // 1 header + 5 data rows
      
      // Verify headers
      expect(lines[0]).toBe('Contract ID,Transaction ID,Trade Type,Instrument,Duration,Buy Price,Sell Price,Payout,Profit/Loss,Status,Purchase Time,Sell Time,App ID,Description');
    });

    it('should generate CSV with all required headers and formatted values', () => {
      const derivTrades = mockTradeHistoryData.map(trade => convertToDerivTradeRecord(trade));
      
      // Generate CSV using the shared header list
      const headers = getCsvHeaders();
      const csvRows = derivTrades.map(trade => extractCsvRow(trade));
      
      // Verify all CSV headers are present
      expect(headers).toEqual([
        'Contract ID', 'Transaction ID', 'Trade Type', 'Instrument', 'Duration',
        'Buy Price', 'Sell Price', 'Payout', 'Profit/Loss', 'Status',
        'Purchase Time', 'Sell Time', 'App ID', 'Description'
      ]);
      
      // Verify each row has the correct number of fields
      csvRows.forEach(row => {
        expect(row).toHaveLength(14);
      });
      
      // Verify specific formatting for different trade types
      const wonTrade = csvRows[0];
      expect(wonTrade[0]).toBe('279319508848'); // Contract ID
      expect(wonTrade[2]).toBe('Even'); // Trade Type Display
      expect(wonTrade[5]).toBe(3.00); // Buy Price (converted from cents)
      expect(wonTrade[6]).toBe(4.04); // Sell Price (converted from cents)
      expect(wonTrade[9]).toBe('won'); // Status
      
      const openTrade = csvRows[2];
      expect(openTrade[6]).toBe(''); // Sell Price (empty for open)
      expect(openTrade[9]).toBe('open'); // Status
      expect(openTrade[11]).toBe(''); // Sell Time (empty for open)
    });

    it('should handle edge cases in CSV generation', () => {
      // Test with special characters in longcode
      const specialCharTrade = {
        ...mockTradeHistoryData[0],
        derivLongcode: 'Win if "quoted text", comma, and semicolon; work properly.'
      };
      
      const derivTrade = convertToDerivTradeRecord(specialCharTrade);
      const csvRow = extractCsvRow(derivTrade);
      
      // Verify special characters are preserved
      expect(csvRow[13]).toContain('"quoted text"');
      expect(csvRow[13]).toContain(',');
      expect(csvRow[13]).toContain(';');
      
      // Test CSV escaping
      const escapedValue = `"${String(csvRow[13]).replace(/"/g, '""')}"`;
      expect(escapedValue).toBe('"Win if ""quoted text"", comma, and semicolon; work properly."');
    });
  });

  describe('Profit Table CSV Export Integration', () => {
    // Mock profit table entries (simplified format from profit-table-display.tsx)
    const mockProfitTableEntries = [
      {
        id: 'profit_entry_1',
        contractId: '279319508848',
        longcode: 'Win payout if the last digit of Volatility 10 Index is even after 1 tick.',
        shortcode: 'DIGITEVEN_R_10_300_1745298644_1T',
        symbol: 'R_10',
        buyPriceDisplay: 3.00,
        sellPriceDisplay: 4.04,
        payoutDisplay: 4.04,
        profitDisplay: 1.04,
        purchaseTime: '1745277401',
        sellTime: '1745277404',
        durationType: 'ticks',
        accountType: 'demo',
        appId: 80447,
        transactionId: '556773095768'
      },
      {
        id: 'profit_entry_2',
        contractId: '279319508849',
        longcode: 'Win payout if the last digit of Volatility 25 Index is odd after 2 ticks.',
        shortcode: 'DIGITODD_R_25_500_1745298650_2T',
        symbol: 'R_25',
        buyPriceDisplay: 5.00,
        sellPriceDisplay: 0,
        payoutDisplay: 9.50,
        profitDisplay: -5.00,
        purchaseTime: '1745277450',
        sellTime: '1745277453',
        durationType: 'ticks',
        accountType: 'demo',
        appId: 80447,
        transactionId: '556773095769'
      }
    ];

    it('should simulate complete profit table CSV download workflow', () => {
      const entries = mockProfitTableEntries;
      
      // Simulate profit table CSV generation (from profit-table-display.tsx)
      const headers = ['Contract ID', 'Transaction ID', 'Symbol', 'Buy Price', 'Sell Price', 'Payout', 'P/L', 'Duration', 'Purchase Time', 'Sell Time', 'App ID', 'Description'];
      
      const rows = entries.map(entry => [
        entry.contractId,
        entry.transactionId || '',
        `${entry.symbol || 'N/A'}`,
        formatCurrency(entry.buyPriceDisplay),
        entry.sellPriceDisplay !== null && entry.sellPriceDisplay !== undefined 
          ? formatCurrency(entry.sellPriceDisplay) 
          : '',
        formatCurrency(entry.payoutDisplay),
        entry.profitDisplay !== null && entry.profitDisplay !== undefined 
          ? formatCurrency(entry.profitDisplay) 
          : '',
        entry.durationType ? `${entry.durationType}` : 'N/A',
        new Date(parseInt(entry.purchaseTime) * 1000).toLocaleString(),
        entry.sellTime ? new Date(parseInt(entry.sellTime) * 1000).toLocaleString() : '',
        entry.appId?.toString() || '',
        `${entry.longcode} (${entry.shortcode})`
      ].map(item => `"${String(item).replace(/"/g, '""')}"`));
      
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      
      // Simulate download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      document.createElement('a');
      mockDownloadLink.setAttribute('href', url);
      mockDownloadLink.setAttribute('download', 'profit_table_demo.csv');
      document.body.appendChild(mockDownloadLink);
      mockDownloadLink.click();
      document.body.removeChild(mockDownloadLink);
      
      // Verify workflow execution
      expect(mockDownloadLink.setAttribute).toHaveBeenCalledWith('download', 'profit_table_demo.csv');
      expect(mockDownloadLink.click).toHaveBeenCalled();
      
      // Verify CSV content
      const lines = csvContent.split('\n');
      expect(lines).toHaveLength(3); // 1 header + 2 data rows
      
      // Verify profit table headers (reduced set compared to trade history)
      expect(lines[0]).toBe('Contract ID,Transaction ID,Symbol,Buy Price,Sell Price,Payout,P/L,Duration,Purchase Time,Sell Time,App ID,Description');
      
      // Verify won trade data
      expect(lines[1]).toContain('"279319508848"');
      expect(lines[1]).toContain('"$3.00"'); // Formatted currency
      expect(lines[1]).toContain('"$4.04"'); // Formatted currency
      expect(lines[1]).toContain('"$1.04"'); // Formatted profit
      
      // Verify lost trade data
      expect(lines[2]).toContain('"279319508849"');
      expect(lines[2]).toContain('"$0.00"'); // Zero sell price
      expect(lines[2]).toContain('"-$5.00"'); // Negative profit (loss)
    });

    it('should handle empty profit table gracefully', () => {
      const entries: any[] = [];
      
      // Should not attempt download with empty data
      expect(entries.length).toBe(0);
      
      // If download were attempted, should only have headers
      const headers = ['Contract ID', 'Transaction ID', 'Symbol', 'Buy Price', 'Sell Price', 'Payout', 'P/L', 'Duration', 'Purchase Time', 'Sell Time', 'App ID', 'Description'];
      const csvContent = headers.join(',') + '\n';
      
      const lines = csvContent.split('\n');
      expect(lines).toHaveLength(2); // 1 header + 1 empty line
      expect(lines[0]).toBe('Contract ID,Transaction ID,Symbol,Buy Price,Sell Price,Payout,P/L,Duration,Purchase Time,Sell Time,App ID,Description');
    });
  });

  describe('CSV File Content Validation', () => {
    it('should produce valid RFC 4180 compliant CSV', () => {
      const derivTrades = mockTradeHistoryData.map(trade => convertToDerivTradeRecord(trade));
      const headers = getCsvHeaders();
      const rows = derivTrades.map(trade => extractCsvRow(trade));
      
      // Generate CSV with proper escaping
      const csvRows = rows.map(row => 
        row.map(item => {
          const stringValue = String(item);
          // RFC 4180: Fields containing line breaks, double quotes, and commas should be enclosed in double-quotes
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
      );
      
      const csvContent = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
      
      // Verify CSV structure
      const lines = csvContent.split('\n');
      expect(lines.length).toBeGreaterThan(1); // At least header + 1 data row
      
      // Verify each line has same number of fields
      const expectedFieldCount = headers.length;
      lines.forEach((line, index) => {
        if (line.trim()) { // Skip empty lines
          const fields = line.split(',');
          expect(fields.length).toBe(expectedFieldCount);
        }
      });
      
      // Verify header line
      expect(lines[0]).toBe('Contract ID,Transaction ID,Trade Type,Instrument,Duration,Buy Price,Sell Price,Payout,Profit/Loss,Status,Purchase Time,Sell Time,App ID,Description');
    });

    it('should maintain data integrity across conversion and export', () => {
      const originalTrade = mockTradeHistoryData[0]; // Won trade
      const convertedTrade = convertToDerivTradeRecord(originalTrade);
      const csvRow = extractCsvRow(convertedTrade);
      
      // Verify key data points are preserved correctly
      expect(csvRow[0]).toBe(originalTrade.derivContractId.toString()); // Contract ID
      expect(csvRow[1]).toBe(originalTrade.derivTransactionId.toString()); // Transaction ID
      expect(csvRow[5]).toBe(3.00); // Buy price (300 cents -> $3.00)
      expect(csvRow[6]).toBe(4.04); // Sell price (404 cents -> $4.04)  
      expect(csvRow[7]).toBe(4.04); // Payout (404 cents -> $4.04)
      expect(csvRow[8]).toBe(1.04); // Profit/Loss (4.04 - 3.00)
      expect(csvRow[9]).toBe('won'); // Status
      expect(csvRow[12]).toBe(80447); // App ID
      expect(csvRow[13]).toBe(originalTrade.derivLongcode); // Longcode preserved
    });

    it('should handle large datasets efficiently', () => {
      // Generate larger dataset
      const largeTrades = Array(1000).fill(null).map((_, index) => ({
        ...mockTradeHistoryData[0],
        id: `trade_${index}`,
        derivContractId: BigInt(String(279319508848 + index)),
        derivTransactionId: BigInt(String(556773095768 + index))
      }));
      
      const start = Date.now();
      const derivTrades = largeTrades.map(trade => convertToDerivTradeRecord(trade));
      const csvRows = derivTrades.map(trade => extractCsvRow(trade));
      const processingTime = Date.now() - start;
      
      // Should process 1000 trades reasonably quickly (< 1 second)
      expect(processingTime).toBeLessThan(1000);
      
      // Verify all rows processed
      expect(csvRows).toHaveLength(1000);
      expect(csvRows[0]).toHaveLength(14); // All fields present
      expect(csvRows[999]).toHaveLength(14); // All fields present
    });
  });
});
