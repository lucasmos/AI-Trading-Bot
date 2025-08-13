# CSV Generation Test Coverage

This document outlines the comprehensive test suite implemented for CSV generation functionality in the trading application.

## Overview

The test suite provides both **regression tests** and **integration tests** for CSV export functionality used in trade history and profit table features.

## Test Structure

### 1. Unit Tests (`src/utils/__tests__/`)

#### CSV Fields Configuration (`csv-fields.test.ts`)
- **Purpose**: Tests the shared CSV field descriptors and utility functions
- **Coverage**: 
  - CSV field definition validation (14 fields matching Deriv Profit Table structure)
  - Header generation functions
  - Field validation and data extraction
  - Null/undefined value handling

**Key Test Cases:**
- Validates exact field ordering: Contract ID → Transaction ID → Trade Type → etc.
- Ensures unique keys and headers across all 14 fields
- Tests CSV row extraction with proper null handling
- Validates field presence requirements

#### CSV Generation with Sample Data (`csv-generation.test.ts`)
- **Purpose**: Tests complete CSV generation workflow with realistic trade data
- **Coverage**: 
  - Trade data conversion to CSV format
  - Currency formatting consistency
  - Timestamp formatting validation
  - Regression snapshots for format stability

**Sample Data Coverage:**
- ✅ **Won Trade**: DIGITEVEN on R_10 (300 cents → 404 cents)
- ✅ **Lost Trade**: DIGITODD on R_25 (500 cents → 0 cents)
- ✅ **Open Trade**: DIGITOVER on R_50 (1000 cents, no settlement)
- ✅ **Cancelled Trade**: DIGITUNDER on R_75 (750 cents, cancelled)

**Regression Snapshots:**
- CSV row snapshots for each trade type to catch format changes
- Header structure snapshots to prevent unintended modifications
- Field ordering verification to maintain compatibility

### 2. Integration Tests (`src/__tests__/integration/`)

#### CSV Download Integration (`csv-download-integration.test.ts`)
- **Purpose**: Simulates complete user workflow from data fetch to file download
- **Coverage**:
  - Complete trade history CSV export workflow
  - Profit table CSV export workflow  
  - DOM API simulation for file downloads
  - RFC 4180 CSV compliance validation
  - Large dataset performance testing (1000+ records)

**Integration Scenarios:**
- ✅ **Trade History Export**: Full 14-column export with proper formatting
- ✅ **Profit Table Export**: 12-column export matching component implementation
- ✅ **Special Character Handling**: CSV escaping for quotes, commas, semicolons
- ✅ **Empty Data Handling**: Graceful handling of empty datasets
- ✅ **Performance Testing**: 1000+ record processing under 1 second

## Test Data Specifications

### Mock Database Trades
```typescript
// Sample trade structures used across tests
{
  derivContractId: BigInt('279319508848'),
  derivBuyPrice: 300,        // cents
  derivPayout: 404,          // cents  
  derivSellPrice: 404,       // cents (null for open/cancelled)
  derivContractType: 'DIGITEVEN',
  derivUnderlyingSymbol: 'R_10',
  status: 'WON' | 'LOST' | 'OPEN' | 'CANCELLED'
}
```

### Expected CSV Output Format
```csv
Contract ID,Transaction ID,Trade Type,Instrument,Duration,Buy Price,Sell Price,Payout,Profit/Loss,Status,Purchase Time,Sell Time,App ID,Description
"279319508848","556773095768","Even","Volatility 10 Index","1 tick","$3.00","$4.04","$4.04","$1.04","won","2025-04-22 10:30:01","2025-04-22 10:30:04","80447","Win payout if the last digit..."
```

## Currency Conversion Testing

The tests validate the critical **cents-to-dollars conversion** logic:

- **Input**: `derivBuyPrice: 300` (cents)
- **Output**: `buy_price: 3.00` (dollars)
- **Logic**: Values ≥100 are divided by 100, values <100 remain unchanged
- **Validation**: All monetary values formatted to 2 decimal places

## Profit/Loss Calculation Testing

Tests verify correct P&L calculation for different trade states:

- **Closed Trades**: `profit_loss = sell_price - buy_price`
- **Open/Cancelled Trades**: `profit_loss = payout - buy_price` (potential profit)

## CSV Compliance Testing

### RFC 4180 Compliance
- ✅ Fields containing commas, quotes, or newlines are properly escaped
- ✅ Double quotes within fields are doubled (`"` → `""`)
- ✅ Each row contains exactly 14 fields
- ✅ Header row matches data field count

### Browser Download Simulation
```javascript
// Mock DOM APIs for testing file downloads
global.document = {
  createElement: jest.fn(() => mockDownloadLink),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
};
```

## Test Execution

### Run All CSV Tests
```bash
npm test -- src/utils/__tests__/ src/__tests__/integration/csv-download-integration.test.ts
```

### Test Coverage Results
- **Total Tests**: 43 tests across 3 test files
- **Unit Tests**: 35 tests (CSV fields + generation)
- **Integration Tests**: 8 tests (end-to-end workflow)
- **Snapshots**: 5 regression snapshots
- **Performance**: Large dataset testing (1000 records)

## Key Testing Benefits

1. **Regression Protection**: Snapshots catch unintended CSV format changes
2. **Data Integrity**: Validates cents→dollars conversion accuracy
3. **Edge Case Coverage**: Handles null values, special characters, empty datasets
4. **Performance Validation**: Ensures scalability with large trade histories
5. **Cross-Platform Compatibility**: Tests work in Node.js environment with DOM mocking
6. **Real-World Scenarios**: Uses actual trade data structures from the application

## Maintenance

### Adding New Test Cases
1. Add new mock trade data to `mockDatabaseTrades` arrays
2. Update expected CSV output validation
3. Regenerate snapshots if field structure changes: `npm test -- --updateSnapshot`

### Monitoring Test Health
- Tests run automatically in CI/CD pipeline
- Snapshot mismatches indicate potential breaking changes
- Performance tests catch efficiency regressions

This comprehensive test suite ensures the CSV generation functionality remains robust, accurate, and performant across different trade scenarios and data volumes.
