// Real-time tick streaming service for Deriv API
import type { InstrumentType, PriceTick } from '@/types';
import { instrumentToDerivSymbol } from './deriv';

// Use the same time formatting as the candles
const formatTickTime = (epoch: number): string => {
  return new Date(epoch * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const DERIV_API_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL && process.env.NEXT_PUBLIC_DERIV_APP_ID
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
  private reconnectDelay = 1000;
  private isConnecting = false;
  private isConnected = false;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.isConnecting || this.isConnected) {
      console.log(`[DerivTickStream] Already connecting/connected: isConnecting=${this.isConnecting}, isConnected=${this.isConnected}`);
      return;
    }

    this.isConnecting = true;
    console.log('[DerivTickStream] 🔌 Connecting to Deriv WebSocket...');
    console.log('[DerivTickStream] WebSocket URL:', DERIV_API_URL);

    this.ws = new WebSocket(DERIV_API_URL);

    this.ws.onopen = () => {
      console.log('[DerivTickStream] ✅ Connected to Deriv WebSocket successfully!');
      console.log('[DerivTickStream] WebSocket readyState:', this.ws?.readyState);
      this.isConnecting = false;
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      console.log(`[DerivTickStream] Notifying ${this.subscriptions.size} subscribers of connection`);
      this.subscriptions.forEach(options => {
        options.onConnect?.();
      });

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
      console.error('[DerivTickStream] ❌ WebSocket error:', error);
      this.isConnecting = false;
      this.isConnected = false;
      this.subscriptions.forEach(options => {
        options.onError(new Error('WebSocket connection error'));
      });
    };

    this.ws.onclose = (event) => {
      console.log(`[DerivTickStream] 🔌 WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
      this.isConnecting = false;
      this.isConnected = false;

      this.subscriptions.forEach(options => {
        options.onDisconnect?.();
      });

      // Only attempt reconnect if it wasn't a clean close
      if (!event.wasClean) {
        console.log('[DerivTickStream] 🔄 Connection was not clean, attempting to reconnect...');
        this.attemptReconnect();
      }
    };
  }

  private handleMessage(response: any) {
    // Log all non-tick messages and some tick messages for debugging
    if (response.msg_type !== 'tick') {
      console.log(`[DerivTickStream] 📨 Received message:`, response);
    }

    if (response.error) {
      console.error('[DerivTickStream] ❌ API Error:', response.error);
      this.subscriptions.forEach(options => {
        options.onError(new Error(response.error.message || 'Unknown API error'));
      });
      return;
    }

    // Log subscription confirmations
    if (response.msg_type === 'tick' && response.subscription) {
      console.log(`[DerivTickStream] ✅ Subscription confirmed for:`, response.subscription);
    }

    if (response.msg_type === 'tick') {
      const symbol = response.tick?.symbol;
      console.log(`[DerivTickStream] Tick received for ${symbol}, price: ${response.tick?.quote}`);

      if (symbol && this.subscriptions.has(symbol)) {
        const options = this.subscriptions.get(symbol)!;
        try {
          // Validate tick data before processing
          if (!response.tick || typeof response.tick.epoch !== 'number' || typeof response.tick.quote !== 'number') {
            console.error(`[DerivTickStream] Invalid tick data received for ${symbol}:`, response.tick);
            return;
          }

          const tick: PriceTick = {
            epoch: response.tick.epoch,
            price: parseFloat(response.tick.quote),
            time: formatTickTime(response.tick.epoch)
          };

          // Validate the created tick object
          if (isNaN(tick.price) || isNaN(tick.epoch) || !tick.time) {
            console.error(`[DerivTickStream] Invalid tick object created for ${symbol}:`, tick);
            return;
          }

          // Log every 10th tick to monitor activity
          if (Math.random() < 0.1) {
            console.log(`[DerivTickStream] 📊 Processing tick for ${symbol}: ${tick.price} at ${tick.time} (epoch: ${tick.epoch})`);
          }

          options.onTick(tick);
        } catch (error) {
          console.error(`[DerivTickStream] Error processing tick for ${symbol}:`, error, 'Raw response:', response);
          options.onError(error instanceof Error ? error : new Error('Error processing tick'));
        }
      } else {
        console.log(`[DerivTickStream] No subscription found for symbol: ${symbol}, available subscriptions:`, Array.from(this.subscriptions.keys()));
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
    
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private resubscribeAll() {
    if (!this.isConnected || !this.ws) {
      console.log('[DerivTickStream] Cannot resubscribe - not connected');
      return;
    }

    console.log(`[DerivTickStream] 📡 Resubscribing to ${this.subscriptions.size} symbols:`, Array.from(this.subscriptions.keys()));
    this.subscriptions.forEach((options, symbol) => {
      const request = {
        ticks: symbol,
        subscribe: 1
      };
      console.log(`[DerivTickStream] 📤 Sending subscription for ${symbol}:`, JSON.stringify(request));
      this.ws!.send(JSON.stringify(request));
    });
  }

  subscribe(instrument: InstrumentType, options: TickStreamOptions): () => void {
    const symbol = instrumentToDerivSymbol(instrument);
    console.log(`[DerivTickStream] 📋 Setting up subscription for ${instrument} -> ${symbol}`);
    this.subscriptions.set(symbol, options);

    // Always try to connect if not connected
    if (!this.isConnected && !this.isConnecting) {
      console.log('[DerivTickStream] WebSocket not connected, initiating connection...');
      this.connect();
    }

    if (this.isConnected && this.ws) {
      const request = {
        ticks: symbol,
        subscribe: 1
      };
      console.log(`[DerivTickStream] 📤 Sending immediate subscription for ${symbol}:`, JSON.stringify(request));
      this.ws.send(JSON.stringify(request));
    } else {
      console.log(`[DerivTickStream] ⏳ WebSocket not ready, subscription will be sent when connected`);
    }

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
