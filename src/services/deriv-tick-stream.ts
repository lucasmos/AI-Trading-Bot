// Real-time tick streaming service for Deriv API
import type { InstrumentType, PriceTick } from '@/types';
import { instrumentToDerivSymbol } from './deriv';

const DERIV_API_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL 
  ? `${process.env.NEXT_PUBLIC_DERIV_WS_URL}?app_id=${process.env.NEXT_PUBLIC_DERIV_APP_ID}`
  : 'wss://ws.derivws.com/websockets/v3?app_id=80447';

export interface TickStreamOptions {
  onTick: (tick: PriceTick) => void;
  onError: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export class DerivTickStream {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, TickStreamOptions> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isConnecting = false;
  private isConnected = false;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.isConnecting || this.isConnected) return;
    
    this.isConnecting = true;
    console.log('[DerivTickStream] Connecting to Deriv WebSocket...');
    
    this.ws = new WebSocket(DERIV_API_URL);
    
    this.ws.onopen = () => {
      console.log('[DerivTickStream] Connected to Deriv WebSocket');
      this.isConnecting = false;
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      
      // Notify all subscribers about connection
      this.subscriptions.forEach(options => {
        options.onConnect?.();
      });
      
      // Re-subscribe to all instruments
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        this.handleMessage(response);
      } catch (error) {
        console.error('[DerivTickStream] Error parsing message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[DerivTickStream] WebSocket error:', error);
      this.isConnecting = false;
      this.isConnected = false;
    };

    this.ws.onclose = () => {
      console.log('[DerivTickStream] WebSocket connection closed');
      this.isConnecting = false;
      this.isConnected = false;
      
      // Notify all subscribers about disconnection
      this.subscriptions.forEach(options => {
        options.onDisconnect?.();
      });
      
      // Attempt to reconnect
      this.attemptReconnect();
    };
  }

  private handleMessage(response: any) {
    if (response.error) {
      console.error('[DerivTickStream] API Error:', response.error);
      this.subscriptions.forEach(options => {
        options.onError(new Error(response.error.message || 'Unknown API error'));
      });
      return;
    }

    if (response.msg_type === 'tick') {
      const symbol = response.tick?.symbol;
      if (symbol && this.subscriptions.has(symbol)) {
        const options = this.subscriptions.get(symbol)!;
        const tick: PriceTick = {
          epoch: response.tick.epoch,
          price: parseFloat(response.tick.quote),
          time: new Date(response.tick.epoch * 1000).toISOString()
        };
        options.onTick(tick);
      }
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DerivTickStream] Max reconnection attempts reached');
      this.subscriptions.forEach(options => {
        options.onError(new Error('Max reconnection attempts reached'));
      });
      return;
    }

    this.reconnectAttempts++;
    console.log(`[DerivTickStream] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    
    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private resubscribeAll() {
    if (!this.isConnected || !this.ws) return;
    
    this.subscriptions.forEach((options, symbol) => {
      const request = {
        ticks: symbol,
        subscribe: 1
      };
      console.log(`[DerivTickStream] Re-subscribing to ${symbol}`);
      this.ws!.send(JSON.stringify(request));
    });
  }

  subscribe(instrument: InstrumentType, options: TickStreamOptions): () => void {
    const symbol = instrumentToDerivSymbol(instrument);
    this.subscriptions.set(symbol, options);
    
    if (this.isConnected && this.ws) {
      const request = {
        ticks: symbol,
        subscribe: 1
      };
      console.log(`[DerivTickStream] Subscribing to ${symbol} for ${instrument}`);
      this.ws.send(JSON.stringify(request));
    }
    
    // Return unsubscribe function
    return () => {
      this.unsubscribe(instrument);
    };
  }

  unsubscribe(instrument: InstrumentType) {
    const symbol = instrumentToDerivSymbol(instrument);
    
    if (this.subscriptions.has(symbol)) {
      this.subscriptions.delete(symbol);
      
      if (this.isConnected && this.ws) {
        const request = {
          forget_all: 'ticks'
        };
        console.log(`[DerivTickStream] Unsubscribing from ${symbol} for ${instrument}`);
        this.ws.send(JSON.stringify(request));
      }
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.isConnected = false;
    this.isConnecting = false;
  }

  getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' {
    if (this.isConnecting) return 'connecting';
    if (this.isConnected) return 'connected';
    return 'disconnected';
  }
}

// Singleton instance
let tickStreamInstance: DerivTickStream | null = null;

export function getTickStream(): DerivTickStream {
  if (!tickStreamInstance) {
    tickStreamInstance = new DerivTickStream();
  }
  return tickStreamInstance;
}
