import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProfitTableRequest {
  profit_table: 1;
  description: 1;
  limit?: number;
  offset?: number;
  sort?: 'ASC' | 'DESC';
  date_from?: number;
  date_to?: number;
}

interface ProfitTableTransaction {
  app_id: number;
  buy_price: number;
  contract_id: number;
  longcode: string;
  payout: number;
  purchase_time: number;
  sell_price?: number;
  sell_time?: number;
  shortcode: string;
  transaction_id: number;
  underlying?: string;
  symbol?: string;
  profit?: number;
  duration_type?: string;
  duration?: number;
}

interface ProfitTableResponse {
  profit_table: {
    count: number;
    transactions: ProfitTableTransaction[];
  };
}

export class DerivProfitTableService {
  private ws: WebSocket | null = null;
  private apiToken: string;
  private accountId: string;
  private userId: string;
  private accountType: 'demo' | 'real';

  constructor(apiToken: string, accountId: string, userId: string, accountType: 'demo' | 'real') {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.userId = userId;
    this.accountType = accountType;
  }

  private connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=80447');

      ws.on('open', () => {
        console.log('[ProfitTable] WebSocket connected');
        this.ws = ws;
        resolve(ws);
      });

      ws.on('error', (error) => {
        console.error('[ProfitTable] WebSocket error:', error);
        reject(error);
      });
    });
  }

  private async authorize(): Promise<void> {
    if (!this.ws) throw new Error('WebSocket not connected');

    return new Promise((resolve, reject) => {
      this.ws!.send(JSON.stringify({
        authorize: this.apiToken
      }));

      this.ws!.once('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve();
        }
      });
    });
  }

  private async fetchProfitTable(limit: number = 100, offset: number = 0): Promise<ProfitTableResponse> {
    if (!this.ws) throw new Error('WebSocket not connected');

    const request: ProfitTableRequest = {
      profit_table: 1,
      description: 1,
      limit,
      offset,
      sort: 'DESC'
    };

    return new Promise((resolve, reject) => {
      this.ws!.send(JSON.stringify(request));

      this.ws!.once('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  private extractSymbolFromLongcode(longcode: string): string | null {
    // Extract symbol from longcode patterns
    const patterns = [
      /Volatility 10 \(1s\) Index/i,
      /Volatility 25 \(1s\) Index/i,
      /Volatility 50 \(1s\) Index/i,
      /Volatility 75 \(1s\) Index/i,
      /Volatility 100 \(1s\) Index/i,
      /Volatility 10 Index/i,
      /Volatility 25 Index/i,
      /Volatility 50 Index/i,
      /Volatility 75 Index/i,
      /Volatility 100 Index/i,
      /Jump 10 Index/i,
      /Jump 25 Index/i,
      /Jump 50 Index/i,
      /Jump 75 Index/i,
      /Jump 100 Index/i
    ];

    const symbolMap = [
      '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V',
      'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
      'JD10', 'JD25', 'JD50', 'JD75', 'JD100'
    ];

    for (let i = 0; i < patterns.length; i++) {
      if (patterns[i].test(longcode)) {
        return symbolMap[i];
      }
    }

    return null;
  }

  private async storeProfitTableEntries(transactions: ProfitTableTransaction[]): Promise<void> {
    const entries = transactions.map(tx => ({
      userId: this.userId,
      derivAccountId: this.accountId,
      accountType: this.accountType,
      appId: tx.app_id,
      buyPrice: Math.round(tx.buy_price * 100), // Convert to cents
      contractId: BigInt(tx.contract_id),
      longcode: tx.longcode,
      payout: Math.round(tx.payout * 100), // Convert to cents
      purchaseTime: BigInt(tx.purchase_time),
      sellPrice: tx.sell_price ? Math.round(tx.sell_price * 100) : null, // Convert to cents
      sellTime: tx.sell_time ? BigInt(tx.sell_time) : null,
      shortcode: tx.shortcode,
      transactionId: BigInt(tx.transaction_id),
      // Additional fields for better tracking
      symbol: tx.symbol || tx.underlying || this.extractSymbolFromLongcode(tx.longcode) || null,
      profit: tx.profit ? Math.round(tx.profit * 100) : null, // Convert to cents
      durationType: tx.duration_type || null,
      duration: tx.duration || null
    }));

    await prisma.profitTableEntry.createMany({
      data: entries,
      skipDuplicates: true
    });

    console.log(`[ProfitTable] Stored ${entries.length} entries for account ${this.accountId}`);
  }

  public async syncProfitTable(): Promise<void> {
    try {
      // Connect and authorize
      await this.connect();
      await this.authorize();

      let offset = 0;
      const limit = 100;
      let totalSynced = 0;

      while (true) {
        // Fetch batch of profit table entries
        const response = await this.fetchProfitTable(limit, offset);
        const { transactions, count } = response.profit_table;

        if (transactions.length === 0) break;

        // Store entries in database
        await this.storeProfitTableEntries(transactions);

        totalSynced += transactions.length;
        offset += limit;

        // Log progress every 500 entries
        if (totalSynced % 500 === 0) {
          console.log(`[ProfitTable] Synced ${totalSynced} entries so far...`);
        }

        // Break if we've fetched all entries
        if (totalSynced >= count) break;
      }

      console.log(`[ProfitTable] Sync completed successfully. Total synced: ${totalSynced} entries`);

    } catch (error) {
      console.error('[ProfitTable] Error syncing profit table:', error);
      throw error; // Let the calling component handle the error display
    } finally {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    }
  }
}

// Helper to create instance for current user
export function getProfitTableService(apiToken: string, accountId: string, userId: string, accountType: 'demo' | 'real'): DerivProfitTableService {
  return new DerivProfitTableService(apiToken, accountId, userId, accountType);
}
