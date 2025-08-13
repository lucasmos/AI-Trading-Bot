/**
 * Unified column + formatter utility for trade tables
 * Single source-of-truth for column order, labels, and cell formatting
 */

import { DerivTradeRecord } from '@/types';
import React from 'react';

/**
 * Trade table column interface definition
 */
export interface TradeTableColumn {
  id: string;
  header: string;
  accessor: keyof DerivTradeRecord;
  cell: (record: DerivTradeRecord) => React.ReactNode;
}

/**
 * Format currency with proper decimal places and currency symbol
 */
export function formatCurrency(value: number | undefined, currency: string = 'USD'): string {
  if (value === undefined || value === null) {
    return '-';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Format Unix timestamp to readable date and time
 */
export function formatDateTime(timestamp: number | undefined): string {
  if (!timestamp) {
    return '-';
  }
  
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Create profit/loss badge with appropriate styling
 */
export function profitBadge(profitLoss: number, status: string): React.ReactElement {
  const isProfit = profitLoss > 0;
  const isLoss = profitLoss < 0;
  const isBreakeven = profitLoss === 0;
  
  let badgeClass = 'px-2 py-1 rounded text-sm font-medium ';
  let displayText = formatCurrency(Math.abs(profitLoss));
  
  if (status === 'open') {
    badgeClass += 'bg-blue-100 text-blue-800';
    displayText = 'Open';
  } else if (isProfit) {
    badgeClass += 'bg-green-100 text-green-800';
    displayText = `+${displayText}`;
  } else if (isLoss) {
    badgeClass += 'bg-red-100 text-red-800';
    displayText = `-${displayText}`;
  } else if (isBreakeven) {
    badgeClass += 'bg-gray-100 text-gray-800';
    displayText = formatCurrency(0);
  } else {
    badgeClass += 'bg-gray-100 text-gray-800';
  }
  
  return React.createElement('span', {
    className: badgeClass
  }, displayText);
}

/**
 * COMMON_COLUMNS constant: ordered array that exactly matches Profit Table layout
 * 1. Contract ID • 2. Transaction ID • 3. Symbol • 4. Buy Price • 5. Sell Price 
 * 6. Payout • 7. P/L • 8. Duration • 9. Purchase Time • 10. Sell Time 
 * 11. App ID • 12. Description
 */
export const COMMON_COLUMNS: TradeTableColumn[] = [
  {
    id: 'contract_id',
    header: 'Contract ID',
    accessor: 'contract_id',
    cell: (record: DerivTradeRecord) => {
      return React.createElement('span', {
        className: 'font-mono text-sm text-gray-600',
        title: record.contract_id
      }, record.contract_id);
    }
  },
  {
    id: 'transaction_id',
    header: 'Transaction ID',
    accessor: 'transaction_id',
    cell: (record: DerivTradeRecord) => {
      return React.createElement('span', {
        className: 'font-mono text-sm text-gray-600',
        title: record.transaction_id
      }, record.transaction_id);
    }
  },
  {
    id: 'symbol',
    header: 'Symbol',
    accessor: 'underlying_symbol',
    cell: (record: DerivTradeRecord) => {
      return React.createElement('div', null, [
        React.createElement('div', {
          key: 'symbol',
          className: 'font-medium'
        }, record.underlying_symbol),
        React.createElement('div', {
          key: 'instrument',
          className: 'text-sm text-gray-500'
        }, record.instrument_display)
      ]);
    }
  },
  {
    id: 'buy_price',
    header: 'Buy Price',
    accessor: 'buy_price',
    cell: (record: DerivTradeRecord) => {
      return React.createElement('span', {
        className: 'font-medium'
      }, formatCurrency(record.buy_price));
    }
  },
  {
    id: 'sell_price',
    header: 'Sell Price',
    accessor: 'sell_price',
    cell: (record: DerivTradeRecord) => {
      return React.createElement('span', {
        className: 'font-medium'
      }, record.sell_price !== undefined ? formatCurrency(record.sell_price) : '-');
    }
  },
  {
    id: 'payout',
    header: 'Payout',
    accessor: 'payout',
    cell: (record: DerivTradeRecord) => {
      return React.createElement('span', {
        className: 'font-medium text-blue-600'
      }, formatCurrency(record.payout));
    }
  },
  {
    id: 'profit_loss',
    header: 'P/L',
    accessor: 'profit_loss',
    cell: (record: DerivTradeRecord) => {
      return profitBadge(record.profit_loss, record.status);
    }
  },
  {
    id: 'duration',
    header: 'Duration',
    accessor: 'duration_display',
    cell: (record: DerivTradeRecord) => {
      return React.createElement('div', null, [
        React.createElement('div', {
          key: 'duration',
          className: 'font-medium'
        }, record.duration_display),
        React.createElement('div', {
          key: 'type',
          className: 'text-sm text-gray-500'
        }, record.trade_type_display)
      ]);
    }
  },
  {
    id: 'purchase_time',
    header: 'Purchase Time',
    accessor: 'purchase_time',
    cell: (record: DerivTradeRecord) => {
      return React.createElement('div', null, [
        React.createElement('div', {
          key: 'date',
          className: 'font-medium'
        }, record.purchase_date),
        React.createElement('div', {
          key: 'time',
          className: 'text-sm text-gray-500'
        }, record.purchase_time_display)
      ]);
    }
  },
  {
    id: 'sell_time',
    header: 'Sell Time',
    accessor: 'sell_time',
    cell: (record: DerivTradeRecord) => {
      if (!record.sell_time || !record.sell_date || !record.sell_time_display) {
        return React.createElement('span', {
          className: 'text-gray-400'
        }, '-');
      }
      
      return React.createElement('div', null, [
        React.createElement('div', {
          key: 'date',
          className: 'font-medium'
        }, record.sell_date),
        React.createElement('div', {
          key: 'time',
          className: 'text-sm text-gray-500'
        }, record.sell_time_display)
      ]);
    }
  },
  {
    id: 'app_id',
    header: 'App ID',
    accessor: 'app_id',
    cell: (record: DerivTradeRecord) => {
      return React.createElement('span', {
        className: 'font-mono text-sm text-gray-600'
      }, record.app_id.toString());
    }
  },
  {
    id: 'description',
    header: 'Description',
    accessor: 'longcode',
    cell: (record: DerivTradeRecord) => {
      return React.createElement('div', {
        className: 'max-w-xs'
      }, [
        React.createElement('div', {
          key: 'longcode',
          className: 'text-sm truncate',
          title: record.longcode
        }, record.longcode),
        React.createElement('div', {
          key: 'shortcode',
          className: 'font-mono text-xs text-gray-400 mt-1 truncate',
          title: record.shortcode
        }, record.shortcode)
      ]);
    }
  }
];
