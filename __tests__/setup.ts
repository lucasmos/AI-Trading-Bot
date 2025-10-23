/**
 * Jest Test Setup File
 *
 * Global configuration for all Jest tests, including:
 * - WebSocket mock for unit tests
 * - AbortController mock
 * - Global test utilities
 *
 * @see {@link jest.config.js} for jest configuration
 */

/**
 * Mock WebSocket implementation for testing
 *
 * Provides a controllable WebSocket mock that can simulate
 * connection events, messages, and errors for unit testing.
 */
class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  onopen?: (event: Event) => void;
  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: Event) => void;
  onclose?: (event: CloseEvent) => void;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string | ArrayBufferLike) {
    if (this.readyState !== this.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = this.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  // Test helpers
  _open() {
    this.readyState = this.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  _error(message: string = 'WebSocket error') {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  _message(data: string | Record<string, any>) {
    const messageData = typeof data === 'string' ? data : JSON.stringify(data);
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: messageData }));
    }
  }

  _close(code: number = 1000, reason: string = 'Normal closure') {
    this.readyState = this.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }
}

// Global WebSocket mock
(global as any).WebSocket = MockWebSocket;

/**
 * Mock AbortController for test environments
 *
 * Provides signal and abort functionality for cleanup testing
 */
class MockAbortController {
  signal: MockAbortSignal;

  constructor() {
    this.signal = new MockAbortSignal();
  }

  abort() {
    (this.signal as MockAbortSignal).abort();
  }
}

class MockAbortSignal {
  aborted: boolean = false;
  private listeners: Array<() => void> = [];

  addEventListener(event: string, callback: () => void) {
    if (event === 'abort') {
      this.listeners.push(callback);
    }
  }

  removeEventListener(event: string, callback: () => void) {
    if (event === 'abort') {
      this.listeners = this.listeners.filter((l) => l !== callback);
    }
  }

  dispatchEvent(): boolean {
    return true;
  }

  abort() {
    this.aborted = true;
    this.listeners.forEach((callback) => callback());
  }
}

(global as any).AbortController = MockAbortController;
(global as any).AbortSignal = MockAbortSignal;
