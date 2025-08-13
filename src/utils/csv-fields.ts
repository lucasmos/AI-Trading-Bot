/**
 * Shared CSV field definitions for trade history and profit table exports
 * Single source of truth for field ordering, keys, and headers
 */

/**
 * CSV field descriptor interface
 */
export interface CsvFieldDescriptor {
  /** Field key that maps to the data property */
  key: string;
  /** Display header for the CSV column */
  header: string;
}

/**
 * Ordered array of CSV field descriptors matching Deriv Profit Table structure
 * Used by both trade-history and profit-table CSV exports
 * 
 * Fields order matches the standard Deriv trading table layout:
 * Contract ID → Transaction ID → Trade Type → Instrument → Duration → 
 * Buy Price → Sell Price → Payout → Profit/Loss → Status → 
 * Purchase Time → Sell Time → App ID → Description
 */
export const CSV_FIELDS: CsvFieldDescriptor[] = [
  {
    key: 'contract_id',
    header: 'Contract ID'
  },
  {
    key: 'transaction_id',
    header: 'Transaction ID'
  },
  {
    key: 'trade_type_display',
    header: 'Trade Type'
  },
  {
    key: 'instrument_display',
    header: 'Instrument'
  },
  {
    key: 'duration_display',
    header: 'Duration'
  },
  {
    key: 'buy_price',
    header: 'Buy Price'
  },
  {
    key: 'sell_price',
    header: 'Sell Price'
  },
  {
    key: 'payout',
    header: 'Payout'
  },
  {
    key: 'profit_loss',
    header: 'Profit/Loss'
  },
  {
    key: 'status',
    header: 'Status'
  },
  {
    key: 'purchase_time',
    header: 'Purchase Time'
  },
  {
    key: 'sell_time',
    header: 'Sell Time'
  },
  {
    key: 'app_id',
    header: 'App ID'
  },
  {
    key: 'longcode',
    header: 'Description'
  }
];

/**
 * Extract CSV headers from field descriptors
 */
export function getCsvHeaders(): string[] {
  return CSV_FIELDS.map(field => field.header);
}

/**
 * Extract field keys from field descriptors
 */
export function getCsvKeys(): string[] {
  return CSV_FIELDS.map(field => field.key);
}

/**
 * Get field descriptor by key
 */
export function getFieldDescriptor(key: string): CsvFieldDescriptor | undefined {
  return CSV_FIELDS.find(field => field.key === key);
}

/**
 * Validate if all required fields are present in a data record
 */
export function validateCsvFields(record: Record<string, any>): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  
  CSV_FIELDS.forEach(field => {
    if (!(field.key in record)) {
      missingFields.push(field.key);
    }
  });
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Extract CSV row values from a data record according to field order
 */
export function extractCsvRow(record: Record<string, any>): any[] {
  return CSV_FIELDS.map(field => {
    const value = record[field.key];
    // Handle null/undefined values for CSV export
    return value !== null && value !== undefined ? value : '';
  });
}
