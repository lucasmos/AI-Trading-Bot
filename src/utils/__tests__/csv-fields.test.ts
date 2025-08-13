/**
 * Unit tests for CSV field descriptors and validation functions
 * Tests CSV generation utilities for trade history and profit table exports
 */

import {
  CSV_FIELDS,
  CsvFieldDescriptor,
  getCsvHeaders,
  getCsvKeys,
  getFieldDescriptor,
  validateCsvFields,
  extractCsvRow
} from '../csv-fields';

describe('CSV Fields Configuration', () => {
  describe('CSV_FIELDS constant', () => {
    it('should contain exactly 14 field descriptors matching Deriv Profit Table structure', () => {
      expect(CSV_FIELDS).toHaveLength(14);
      
      // Verify exact field ordering matches Deriv Profit Table layout
      const expectedFields: CsvFieldDescriptor[] = [
        { key: 'contract_id', header: 'Contract ID' },
        { key: 'transaction_id', header: 'Transaction ID' },
        { key: 'trade_type_display', header: 'Trade Type' },
        { key: 'instrument_display', header: 'Instrument' },
        { key: 'duration_display', header: 'Duration' },
        { key: 'buy_price', header: 'Buy Price' },
        { key: 'sell_price', header: 'Sell Price' },
        { key: 'payout', header: 'Payout' },
        { key: 'profit_loss', header: 'Profit/Loss' },
        { key: 'status', header: 'Status' },
        { key: 'purchase_time', header: 'Purchase Time' },
        { key: 'sell_time', header: 'Sell Time' },
        { key: 'app_id', header: 'App ID' },
        { key: 'longcode', header: 'Description' }
      ];
      
      expect(CSV_FIELDS).toEqual(expectedFields);
    });

    it('should have all fields with non-empty keys and headers', () => {
      CSV_FIELDS.forEach((field, index) => {
        expect(field.key).toBeTruthy();
        expect(field.header).toBeTruthy();
        expect(typeof field.key).toBe('string');
        expect(typeof field.header).toBe('string');
        expect(field.key.length).toBeGreaterThan(0);
        expect(field.header.length).toBeGreaterThan(0);
      });
    });

    it('should have unique field keys', () => {
      const keys = CSV_FIELDS.map(field => field.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('should have unique field headers', () => {
      const headers = CSV_FIELDS.map(field => field.header);
      const uniqueHeaders = new Set(headers);
      expect(uniqueHeaders.size).toBe(headers.length);
    });
  });

  describe('getCsvHeaders', () => {
    it('should return all field headers in correct order', () => {
      const headers = getCsvHeaders();
      const expectedHeaders = [
        'Contract ID', 'Transaction ID', 'Trade Type', 'Instrument', 'Duration',
        'Buy Price', 'Sell Price', 'Payout', 'Profit/Loss', 'Status',
        'Purchase Time', 'Sell Time', 'App ID', 'Description'
      ];
      
      expect(headers).toEqual(expectedHeaders);
      expect(headers).toHaveLength(14);
    });

    it('should return array of strings', () => {
      const headers = getCsvHeaders();
      expect(Array.isArray(headers)).toBe(true);
      headers.forEach(header => {
        expect(typeof header).toBe('string');
      });
    });
  });

  describe('getCsvKeys', () => {
    it('should return all field keys in correct order', () => {
      const keys = getCsvKeys();
      const expectedKeys = [
        'contract_id', 'transaction_id', 'trade_type_display', 'instrument_display', 'duration_display',
        'buy_price', 'sell_price', 'payout', 'profit_loss', 'status',
        'purchase_time', 'sell_time', 'app_id', 'longcode'
      ];
      
      expect(keys).toEqual(expectedKeys);
      expect(keys).toHaveLength(14);
    });

    it('should return array of strings', () => {
      const keys = getCsvKeys();
      expect(Array.isArray(keys)).toBe(true);
      keys.forEach(key => {
        expect(typeof key).toBe('string');
      });
    });
  });

  describe('getFieldDescriptor', () => {
    it('should return correct field descriptor for valid key', () => {
      const contractField = getFieldDescriptor('contract_id');
      expect(contractField).toEqual({
        key: 'contract_id',
        header: 'Contract ID'
      });

      const profitField = getFieldDescriptor('profit_loss');
      expect(profitField).toEqual({
        key: 'profit_loss',
        header: 'Profit/Loss'
      });
    });

    it('should return undefined for invalid key', () => {
      const nonExistentField = getFieldDescriptor('non_existent_field');
      expect(nonExistentField).toBeUndefined();
    });

    it('should be case-sensitive for keys', () => {
      const upperCaseResult = getFieldDescriptor('CONTRACT_ID');
      expect(upperCaseResult).toBeUndefined();
    });
  });

  describe('validateCsvFields', () => {
    const sampleTradeRecord = {
      contract_id: '279319508848',
      transaction_id: '556773095768',
      trade_type_display: 'Even',
      instrument_display: 'Volatility 10 Index',
      duration_display: '1 tick',
      buy_price: 3.00,
      sell_price: 4.04,
      payout: 4.04,
      profit_loss: 1.04,
      status: 'won',
      purchase_time: '2024-12-19 10:30:01',
      sell_time: '2024-12-19 10:30:04',
      app_id: 80447,
      longcode: 'Win payout if the last digit of Volatility 10 Index is even after 1 tick.'
    };

    it('should validate complete trade record as valid', () => {
      const validation = validateCsvFields(sampleTradeRecord);
      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toEqual([]);
    });

    it('should identify missing required fields', () => {
      const incompleteRecord = {
        contract_id: '279319508848',
        buy_price: 3.00,
        payout: 4.04
        // Missing most required fields
      };

      const validation = validateCsvFields(incompleteRecord);
      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('transaction_id');
      expect(validation.missingFields).toContain('trade_type_display');
      expect(validation.missingFields).toContain('instrument_display');
      expect(validation.missingFields).toContain('duration_display');
      expect(validation.missingFields).toHaveLength(11); // 14 - 3 provided = 11 missing
    });

    it('should handle empty object', () => {
      const validation = validateCsvFields({});
      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toHaveLength(14);
    });

    it('should allow null/undefined values but require field presence', () => {
      const recordWithNullValues = {
        contract_id: '123',
        transaction_id: null,
        trade_type_display: 'Even',
        instrument_display: 'Volatility 10 Index',
        duration_display: '1 tick',
        buy_price: 3.00,
        sell_price: null, // Can be null for open trades
        payout: 4.04,
        profit_loss: 1.04,
        status: 'open',
        purchase_time: '2024-12-19 10:30:01',
        sell_time: null, // Can be null for open trades
        app_id: 80447,
        longcode: 'Win payout...'
      };

      const validation = validateCsvFields(recordWithNullValues);
      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toEqual([]);
    });
  });

  describe('extractCsvRow', () => {
    const sampleRecord = {
      contract_id: '279319508848',
      transaction_id: '556773095768',
      trade_type_display: 'Even',
      instrument_display: 'Volatility 10 Index',
      duration_display: '1 tick',
      buy_price: 3.00,
      sell_price: 4.04,
      payout: 4.04,
      profit_loss: 1.04,
      status: 'won',
      purchase_time: '2024-12-19 10:30:01',
      sell_time: '2024-12-19 10:30:04',
      app_id: 80447,
      longcode: 'Win payout if the last digit of Volatility 10 Index is even after 1 tick.'
    };

    it('should extract CSV row values in correct field order', () => {
      const row = extractCsvRow(sampleRecord);
      
      expect(row).toEqual([
        '279319508848', // contract_id
        '556773095768', // transaction_id
        'Even', // trade_type_display
        'Volatility 10 Index', // instrument_display
        '1 tick', // duration_display
        3.00, // buy_price
        4.04, // sell_price
        4.04, // payout
        1.04, // profit_loss
        'won', // status
        '2024-12-19 10:30:01', // purchase_time
        '2024-12-19 10:30:04', // sell_time
        80447, // app_id
        'Win payout if the last digit of Volatility 10 Index is even after 1 tick.' // longcode
      ]);
      
      expect(row).toHaveLength(14);
    });

    it('should handle null/undefined values by converting to empty strings', () => {
      const recordWithNulls = {
        ...sampleRecord,
        sell_price: null,
        sell_time: undefined,
        transaction_id: null
      };

      const row = extractCsvRow(recordWithNulls);
      
      expect(row[1]).toBe(''); // transaction_id -> empty string
      expect(row[6]).toBe(''); // sell_price -> empty string
      expect(row[11]).toBe(''); // sell_time -> empty string
    });

    it('should preserve zero values', () => {
      const recordWithZeros = {
        ...sampleRecord,
        sell_price: 0,
        profit_loss: 0
      };

      const row = extractCsvRow(recordWithZeros);
      
      expect(row[6]).toBe(0); // sell_price should remain 0
      expect(row[8]).toBe(0); // profit_loss should remain 0
    });

    it('should handle missing fields by returning empty string', () => {
      const incompleteRecord = {
        contract_id: '123',
        buy_price: 5.00
      };

      const row = extractCsvRow(incompleteRecord);
      
      expect(row[0]).toBe('123'); // contract_id
      expect(row[5]).toBe(5.00); // buy_price
      
      // All other fields should be empty strings
      expect(row[1]).toBe(''); // transaction_id
      expect(row[2]).toBe(''); // trade_type_display
      expect(row[3]).toBe(''); // instrument_display
      // ... etc
      
      expect(row).toHaveLength(14);
    });
  });
});
