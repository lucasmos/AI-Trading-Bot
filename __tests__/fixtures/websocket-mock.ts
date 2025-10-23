/**
 * WebSocket Mock and Test Fixtures
 *
 * Provides reusable mocks, builders, and utilities for WebSocket tests.
 * Used across all unit and integration tests.
 *
 * @see {@link __tests__/setup.ts} for global setup
 */

import {
  ConnectionState,
  ConnectionSnapshot,
  WebSocketConfig,
  QueuedMessage,
  ReconnectionConfig,
} from '../../src/types/websocket';

/**
 * Create a mock WebSocket instance for testing
 *
 * Example:
 * ```
 * const ws = createMockWebSocket('wss://example.com')
 * ws._open()  // Simulate connection
 * ws._message({ type: 'tick', price: 100 })  // Simulate incoming message
 * ```
 */
export function createMockWebSocket(url: string) {
  return new (global as any).WebSocket(url);
}

/**
 * Builder for creating test WebSocketConfig objects
 */
export class WebSocketConfigBuilder {
  private config: Partial<WebSocketConfig> = {
    url: 'wss://ws.derivws.com/websockets/v3?app_id=12345',
    token: 'test-token',
    maxReconnectAttempts: 6,
    baseBackoffMs: 3000,
    maxBackoffMs: 30000,
    keepAliveIntervalMs: 30000,
    connectionTimeoutMs: 5000,
  };

  withUrl(url: string) {
    this.config.url = url;
    return this;
  }

  withToken(token: string) {
    this.config.token = token;
    return this;
  }

  withMaxReconnectAttempts(attempts: number) {
    this.config.maxReconnectAttempts = attempts;
    return this;
  }

  withBaseBackoffMs(ms: number) {
    this.config.baseBackoffMs = ms;
    return this;
  }

  withMaxBackoffMs(ms: number) {
    this.config.maxBackoffMs = ms;
    return this;
  }

  withKeepAliveIntervalMs(ms: number) {
    this.config.keepAliveIntervalMs = ms;
    return this;
  }

  withConnectionTimeoutMs(ms: number) {
    this.config.connectionTimeoutMs = ms;
    return this;
  }

  withOnStateChange(callback: (state: ConnectionState) => void) {
    this.config.onStateChange = callback;
    return this;
  }

  withOnError(callback: (error: Error) => void) {
    this.config.onError = callback;
    return this;
  }

  build(): WebSocketConfig {
    return this.config as WebSocketConfig;
  }
}

/**
 * Builder for creating test ConnectionSnapshot objects
 */
export class ConnectionSnapshotBuilder {
  private snapshot: Partial<ConnectionSnapshot> = {
    id: 'test-connection-1',
    state: ConnectionState.IDLE,
    isConnected: false,
    isConnecting: false,
    uptime: 0,
    reconnectAttempt: 0,
    messagesSent: 0,
    messagesQueued: 0,
    errorCount: 0,
    disconnectCount: 0,
  };

  withState(state: ConnectionState) {
    this.snapshot.state = state;
    this.snapshot.isConnected = state === ConnectionState.CONNECTED;
    this.snapshot.isConnecting =
      state === ConnectionState.CONNECTING || state === ConnectionState.RECONNECTING;
    return this;
  }

  withUptime(ms: number) {
    this.snapshot.uptime = ms;
    return this;
  }

  withReconnectAttempt(attempt: number) {
    this.snapshot.reconnectAttempt = attempt;
    return this;
  }

  withMessagesSent(count: number) {
    this.snapshot.messagesSent = count;
    return this;
  }

  withMessagesQueued(count: number) {
    this.snapshot.messagesQueued = count;
    return this;
  }

  withErrorCount(count: number) {
    this.snapshot.errorCount = count;
    return this;
  }

  withDisconnectCount(count: number) {
    this.snapshot.disconnectCount = count;
    return this;
  }

  withLastError(code: number, message: string) {
    this.snapshot.lastError = {
      code,
      message,
      timestamp: Date.now(),
    };
    return this;
  }

  withLastMessageTime(ms: number) {
    this.snapshot.lastMessageTime = ms;
    return this;
  }

  build(): ConnectionSnapshot {
    return this.snapshot as ConnectionSnapshot;
  }
}

/**
 * Create a test QueuedMessage
 */
export function createQueuedMessage(
  message: Record<string, any>,
  timestamp: number = Date.now(),
): QueuedMessage {
  return {
    message,
    timestamp,
  };
}

/**
 * Create multiple test messages for queue testing
 */
export function createQueuedMessages(
  count: number,
  startTimestamp: number = Date.now(),
): QueuedMessage[] {
  const messages: QueuedMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      message: { id: i, type: 'test', value: `message-${i}` },
      timestamp: startTimestamp + i * 1000,
    });
  }
  return messages;
}

/**
 * Wait for a condition to be true (for async testing)
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs: number = 5000,
  checkIntervalMs: number = 50,
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `waitFor condition not met within ${timeoutMs}ms. Last state: ${condition()}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }
}

/**
 * Create a spy function that tracks calls with additional helpers
 */
export function createSpyFunction<T extends (...args: any[]) => any>(
  implementation?: T,
): jest.Mock<ReturnType<T>> {
  return jest.fn(implementation);
}

/**
 * Sample Deriv API messages for testing
 */
export const SAMPLE_MESSAGES = {
  authorize: {
    authorize: 'test-token',
  },
  tick: {
    tick: {
      ask: 1.23456,
      bid: 1.23450,
      bid_quantity: 50,
      ask_quantity: 50,
      epoch: Math.floor(Date.now() / 1000),
      id: 'eurusd',
      quote: 1.234530,
      symbol: 'frxEURUSD',
    },
  },
  ping: {
    ping: 1,
  },
  subscribe: {
    subscribe: '1',
    ticks: 'eurusd',
  },
  unsubscribe: {
    forget: '1',
  },
};

/**
 * Exponential backoff delay sequence for testing
 */
export function getBackoffSequence(
  baseDelayMs: number = 3000,
  maxDelayMs: number = 30000,
  maxAttempts: number = 6,
): number[] {
  const sequence: number[] = [];
  for (let i = 1; i <= maxAttempts; i++) {
    const exponentialDelay = baseDelayMs * Math.pow(2, i - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
    sequence.push(cappedDelay);
  }
  return sequence;
}
