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
  private subscriptions: Map<string, TickStreamOptions[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private isConnected = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Delay initial connection to ensure environment is ready
    if (typeof window !== 'undefined') {
      setTimeout(() => this.connect(), 100);
    }
  }

  private connect() {
    if (this.isConnecting || this.isConnected) return;
    
    // Ensure we're in browser environment
    if (typeof window === 'undefined') {
      console.warn('[DerivTickStream] Cannot connect - not in browser environment');
      return;
    }
    
    this.isConnecting = true;
    console.log('[DerivTickStream] Connecting to Deriv WebSocket...');
    
    try {
      this.ws = new WebSocket(DERIV_API_URL);
    } catch (error) {
      console.error('[DerivTickStream] Failed to create WebSocket:', error);
      this.isConnecting = false;
      this.attemptReconnect();
      return;
    }
    
    this.ws.onopen = () => {
      console.log('[DerivTickStream] Connected to Deriv WebSocket');
      this.isConnecting = false;
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      
      // Set up ping to keep connection alive
      this.setupPing();
      
      // Notify all subscribers of connection
      this.subscriptions.forEach(optionsArray => {
        optionsArray.forEach(options => {
          options.onConnect?.();
        });
      });
      
      // Resubscribe all active subscriptions
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

    this.ws.onclose = (event) => {
      console.log('[DerivTickStream] WebSocket connection closed:', event.code, event.reason);
      this.isConnecting = false;
      this.isConnected = false;
      
      // Clear ping interval
      this.clearPing();
      
      // Notify subscribers of disconnection
      this.subscriptions.forEach(optionsArray => {
        optionsArray.forEach(options => {
          options.onDisconnect?.();
        });
      });
      
      // Don't reconnect if it was a clean close
      if (!event.wasClean && event.code !== 1000) {
        this.attemptReconnect();
      }
    };
  }

  private handleMessage(response: any) {
    // Handle ping/pong messages
    if (response.msg_type === 'ping') {
      this.sendPong();
      return;
    }
    
    if (response.error) {
      console.error('[DerivTickStream] API Error:', response.error);
      
      // Only notify subscribers for relevant symbols
      const symbol = response.echo_req?.ticks || response.echo_req?.ticks_history;
      if (symbol && this.subscriptions.has(symbol)) {
        const optionsArray = this.subscriptions.get(symbol)!;
        optionsArray.forEach(options => {
          options.onError(new Error(response.error.message || 'Unknown API error'));
        });
      }
      return;
    }

    if (response.msg_type === 'tick') {
      const symbol = response.tick?.symbol;
      if (symbol && this.subscriptions.has(symbol)) {
        const optionsArray = this.subscriptions.get(symbol)!;
        const tick: PriceTick = {
          epoch: response.tick.epoch,
          price: parseFloat(response.tick.quote),
          time: new Date(response.tick.epoch * 1000).toISOString()
        };
        // Broadcast to all subscribers for this symbol
        optionsArray.forEach(options => {
          try {
            options.onTick(tick);
          } catch (error) {
            console.error('[DerivTickStream] Error in tick handler:', error);
          }
        });
      }
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DerivTickStream] Max reconnection attempts reached');
      this.subscriptions.forEach(optionsArray => {
        optionsArray.forEach(options => {
          options.onError(new Error('Max reconnection attempts reached'));
        });
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
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Add delay between subscriptions to avoid overwhelming the API
    let delay = 0;
    this.subscriptions.forEach((optionsArray, symbol) => {
      if (optionsArray.length > 0) {
        setTimeout(() => {
          if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            const request = {
              ticks: symbol,
              subscribe: 1
            };
            console.log(`[DerivTickStream] Re-subscribing to ${symbol} (${optionsArray.length} subscribers)`);
            this.ws.send(JSON.stringify(request));
          }
        }, delay);
        delay += 100; // 100ms between each subscription
      }
    });
  }

  subscribe(instrument: InstrumentType, options: TickStreamOptions): () => void {
    const symbol = instrumentToDerivSymbol(instrument);

    // Add to subscribers array
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, []);
    }
    this.subscriptions.get(symbol)!.push(options);

    // Only send WebSocket subscription if this is the first subscriber for this symbol
    const isFirstSubscriber = this.subscriptions.get(symbol)!.length === 1;

    if (isFirstSubscriber && this.isConnected && this.ws) {
      const request = {
        ticks: symbol,
        subscribe: 1
      };
      console.log(`[DerivTickStream] Subscribing to ${symbol} for ${instrument} (first subscriber)`);
      this.ws.send(JSON.stringify(request));
    } else {
      console.log(`[DerivTickStream] Added subscriber to ${symbol} for ${instrument} (${this.subscriptions.get(symbol)!.length} total)`);
    }

    return () => {
      this.unsubscribeOptions(instrument, options);
    };
  }

  unsubscribeOptions(instrument: InstrumentType, options: TickStreamOptions) {
    const symbol = instrumentToDerivSymbol(instrument);

    if (this.subscriptions.has(symbol)) {
      const optionsArray = this.subscriptions.get(symbol)!;
      const index = optionsArray.indexOf(options);

      if (index > -1) {
        optionsArray.splice(index, 1);
        console.log(`[DerivTickStream] Removed subscriber from ${symbol} for ${instrument} (${optionsArray.length} remaining)`);

        // If no more subscribers for this symbol, unsubscribe from WebSocket
        if (optionsArray.length === 0) {
          this.subscriptions.delete(symbol);

          if (this.isConnected && this.ws) {
            const request = {
              forget_all: 'ticks'
            };
            console.log(`[DerivTickStream] Unsubscribing from ${symbol} for ${instrument} (last subscriber)`);
            this.ws.send(JSON.stringify(request));
          }
        }
      }
    }
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
    this.clearPing();
    if (this.ws) {
      // Send forget_all before closing
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
      }
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.subscriptions.clear();
    this.isConnected = false;
    this.isConnecting = false;
  }
  
  private setupPing() {
    this.clearPing();
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: 1 }));
      }
    }, 30000);
  }
  
  private clearPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  private sendPong() {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ pong: 1 }));
    }
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
  if (typeof window === 'undefined') {
    throw new Error('[DerivTickStream] Cannot create tick stream in server environment');
  }
  
  if (!tickStreamInstance) {
    tickStreamInstance = new DerivTickStream();
  }
  return tickStreamInstance;
}

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (tickStreamInstance) {
      tickStreamInstance.disconnect();
      tickStreamInstance = null;
    }
  });
}
