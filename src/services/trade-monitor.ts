'use client';

import { toast } from '@/hooks/use-toast';

export interface TradeCompletionData {
  contractId: string;
  instrument: string;
  entryPrice: number;
  exitPrice: number;
  stake: number;
  profit: number;
  status: 'won' | 'lost';
  closeTime: Date;
}

export interface TradeMonitorOptions {
  onTradeComplete?: (trade: TradeCompletionData) => void;
  onBalanceUpdate?: (newBalance: number, change: number) => void;
  showToastNotifications?: boolean;
}

export class TradeMonitor {
  private activeContracts: Set<string> = new Set();
  private options: TradeMonitorOptions;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private apiToken: string;
  private accountId: string;

  /**
   * Normalize contract status from Deriv API to our internal format
   */
  private normalizeContractStatus(derivStatus: string): 'won' | 'lost' | 'open' | 'cancelled' {
    if (!derivStatus) return 'open';
    
    switch (derivStatus.toLowerCase()) {
      case 'won':
      case 'win':
        return 'won';
      case 'lost':
      case 'loss':
        return 'lost';
      case 'cancelled':
      case 'canceled':
        return 'cancelled';
      case 'open':
      case 'pending':
      default:
        return 'open';
    }
  }

  constructor(apiToken: string, accountId: string, options: TradeMonitorOptions = {}) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.options = {
      showToastNotifications: true,
      ...options
    };
  }

  /**
   * Add a contract to monitoring
   */
  addContract(contractId: string, instrument: string, stake: number) {
    this.activeContracts.add(contractId);
    console.log(`[TradeMonitor] Added contract ${contractId} (${instrument}) to monitoring`);
    
    // Start monitoring if not already running
    if (!this.monitoringInterval) {
      this.startMonitoring();
    }
  }

  /**
   * Remove a contract from monitoring
   */
  removeContract(contractId: string) {
    this.activeContracts.delete(contractId);
    console.log(`[TradeMonitor] Removed contract ${contractId} from monitoring`);
    
    // Stop monitoring if no active contracts
    if (this.activeContracts.size === 0) {
      this.stopMonitoring();
    }
  }

  /**
   * Start monitoring active contracts
   */
  private startMonitoring() {
    if (this.monitoringInterval) return;

    console.log('[TradeMonitor] Starting trade monitoring...');
    this.monitoringInterval = setInterval(() => {
      this.checkActiveContracts();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[TradeMonitor] Stopped trade monitoring');
    }
  }

  /**
   * Check status of active contracts
   */
  private async checkActiveContracts() {
    if (this.activeContracts.size === 0) return;

    try {
      // Check each contract status
      for (const contractId of this.activeContracts) {
        await this.checkContractStatus(contractId);
      }
    } catch (error) {
      console.error('[TradeMonitor] Error checking contracts:', error);
    }
  }

  /**
   * Check individual contract status
   */
  private async checkContractStatus(contractId: string) {
    try {
      // Use WebSocket-based getContractStatus for reliable Deriv status
      const { getContractStatus } = await import('@/services/deriv');
      const statusData = await getContractStatus(Number(contractId), this.apiToken, this.accountId);

      // Validate required fields
      if (!statusData || !statusData.contract_id) {
        console.error(`[TradeMonitor] Invalid status data for contract ${contractId}:`, statusData);
        return;
      }

      // Log detailed contract status for debugging
      console.log(`[TradeMonitor] Contract ${contractId} status:`, {
        status: statusData.status,
        buyPrice: statusData.buy_price,
        sellPrice: statusData.sell_price,
        entrySpot: statusData.entry_spot,
        exitTick: statusData.exit_tick,
        exitTime: statusData.exit_tick_time
      });

      // Normalize to expected fields and handle money values (stored as cents)
      const contractData = {
        contract_id: statusData.contract_id.toString(),
        status: this.normalizeContractStatus(statusData.status),
        buy_price: Math.round(Number(statusData.buy_price || 0) * 100), // Convert to cents
        sell_price: statusData.sell_price != null ? Math.round(Number(statusData.sell_price) * 100) : undefined, // Convert to cents if exists
        entry_spot: Number(statusData.entry_spot || 0),
        exit_spot: Number(statusData.exit_tick || 0),
        sell_time: statusData.exit_tick_time, // Use exit_tick_time as sell_time
        underlying: statusData.symbol || '', // Use symbol field for underlying
      };

      // Completed if 'sold' or has sell_price/time
      if (
        statusData.status === 'sold' ||
        statusData.status === 'won' ||
        statusData.status === 'lost' ||
        (statusData.sell_price != null && statusData.exit_tick_time != null)
      ) {
        await this.handleCompletedTrade(contractData);
        this.removeContract(contractId);
      }
    } catch (error) {
      console.error(`[TradeMonitor] Error checking contract ${contractId}:`, error);
    }
  }

  /**
   * Handle completed trade
   */
  private async handleCompletedTrade(contractData: any) {
    const monetarySellPrice = contractData.sell_price ?? 0;
    const profit = monetarySellPrice - (contractData.buy_price ?? 0);
    const isWin = profit > 0;

    const tradeCompletion: TradeCompletionData = {
      contractId: String(contractData.contract_id),
      instrument: contractData.underlying || '',
      entryPrice: contractData.entry_spot ?? 0,
      exitPrice: monetarySellPrice, // MONEY value for DB derivSellPrice
      stake: contractData.buy_price ?? 0,
      profit: profit,
      status: isWin ? 'won' : 'lost',
      closeTime: new Date(((contractData.sell_time || contractData.exit_tick_time) ?? Math.floor(Date.now() / 1000)) * 1000)
    };

    // Update database
    await this.updateTradeInDatabase(tradeCompletion);

    // Show toast notification
    if (this.options.showToastNotifications) {
      this.showTradeCompletionToast(tradeCompletion);
    }

    // Call completion callback
    if (this.options.onTradeComplete) {
      this.options.onTradeComplete(tradeCompletion);
    }

    // Trigger balance update
    if (this.options.onBalanceUpdate) {
      // This would typically fetch the new balance from the API
      // For now, we'll simulate the balance change
      this.options.onBalanceUpdate(contractData.balance, profit);
    }
  }

  /**
   * Update trade in database
   */
  private async updateTradeInDatabase(trade: TradeCompletionData) {
    try {
      await fetch('/api/trades/update-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: trade.contractId,
          exitPrice: trade.exitPrice,
          profit: trade.profit,
          status: trade.status,
          closeTime: trade.closeTime
        })
      });
    } catch (error) {
      console.error('[TradeMonitor] Error updating trade in database:', error);
    }
  }

  /**
   * Show toast notification for completed trade
   */
  private showTradeCompletionToast(trade: TradeCompletionData) {
    const isWin = trade.status === 'won';
    const profitText = isWin ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`;
    
    toast({
      title: `${isWin ? '🎉' : '📉'} Trade ${isWin ? 'Won' : 'Lost'}: ${trade.instrument}`,
      description: `${profitText} | Entry: ${trade.entryPrice} | Exit: ${trade.exitPrice} | Stake: $${trade.stake.toFixed(2)}`,
      variant: isWin ? 'default' : 'destructive',
      duration: 8000
    });
  }

  /**
   * Get active contracts count
   */
  getActiveContractsCount(): number {
    return this.activeContracts.size;
  }

  /**
   * Cleanup - stop monitoring and clear contracts
   */
  cleanup() {
    this.stopMonitoring();
    this.activeContracts.clear();
  }
}

// Singleton instance for global use
let globalTradeMonitor: TradeMonitor | null = null;

export function getTradeMonitor(apiToken?: string, accountId?: string, options?: TradeMonitorOptions): TradeMonitor | null {
  if (!apiToken || !accountId) {
    return globalTradeMonitor;
  }

  if (!globalTradeMonitor || globalTradeMonitor['apiToken'] !== apiToken || globalTradeMonitor['accountId'] !== accountId) {
    // Cleanup existing monitor
    if (globalTradeMonitor) {
      globalTradeMonitor.cleanup();
    }
    
    // Create new monitor
    globalTradeMonitor = new TradeMonitor(apiToken, accountId, options);
  }

  return globalTradeMonitor;
}

export function cleanupTradeMonitor() {
  if (globalTradeMonitor) {
    globalTradeMonitor.cleanup();
    globalTradeMonitor = null;
  }
}
