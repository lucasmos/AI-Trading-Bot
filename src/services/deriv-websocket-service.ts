/**
 * Deriv WebSocket Service (Singleton)
 *
 * Manages low-level WebSocket connection lifecycle for Deriv API.
 * Single instance per application, prevents duplicate connections.
 *
 * Responsibilities:
 * - WebSocket creation and lifecycle management
 * - Event delegation to handlers
 * - Connection state tracking (readyState)
 * - Message sending with error handling
 *
 * Does NOT manage:
 * - State machine (that's the hook's job)
 * - Keep-alive timers
 * - Reconnection scheduling
 * - Message queuing
 *
 * @see {@link ../hooks/use-websocket-connection.ts} for hook that uses this service
 */

/**
 * Handler callback types for WebSocket events
 */
export type WebSocketMessageHandler = (data: string) => void;
export type WebSocketErrorHandler = (error: Event) => void;
export type WebSocketCloseHandler = (event: CloseEvent) => void;
export type WebSocketOpenHandler = () => void;

/**
 * Listener registry for WebSocket events
 */
interface EventListenerRegistry {
  open: Set<WebSocketOpenHandler>;
  message: Set<WebSocketMessageHandler>;
  error: Set<WebSocketErrorHandler>;
  close: Set<WebSocketCloseHandler>;
}

/**
 * Deriv WebSocket Service - Singleton
 *
 * Manages a single WebSocket connection to the Deriv API.
 * Multiple hook instances share the same underlying connection,
 * preventing unnecessary duplicate connections.
 *
 * Usage:
 * ```typescript
 * const service = DerivWebSocketService.getInstance()
 * const ws = service.getOrCreateConnection('wss://...', config)
 * service.addEventListener('message', (data) => console.log(data))
 * service.send({ authorize: token })
 * ```
 */
class DerivWebSocketService {
  private static instance: DerivWebSocketService | null = null;
  private socket: WebSocket | null = null;
  private url: string = '';
  private listeners: EventListenerRegistry = {
    open: new Set(),
    message: new Set(),
    error: new Set(),
    close: new Set(),
  };

  /**
   * Private constructor - use getInstance() to access singleton
   */
  private constructor() {}

  /**
   * Get or create singleton instance
   */
  static getInstance(): DerivWebSocketService {
    if (!DerivWebSocketService.instance) {
      DerivWebSocketService.instance = new DerivWebSocketService();
    }
    return DerivWebSocketService.instance;
  }

  /**
   * Get or create WebSocket connection
   *
   * If connection exists and URL matches, returns existing.
   * If URL differs or connection closed, creates new connection.
   *
   * @param url - WebSocket URL (wss protocol)
   * @throws {Error} If URL is not valid wss:// URL
   * @returns WebSocket instance
   */
  getOrCreateConnection(url: string): WebSocket {
    // Validate URL
    if (!url.startsWith('wss://')) {
      throw new Error(`Invalid WebSocket URL: must use wss:// protocol. Got: ${url}`);
    }

    // Return existing if URL matches and socket is open
    if (this.socket && this.url === url && this.socket.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    // Close existing connection if URL changed or socket died
    if (this.socket && this.url !== url) {
      try {
        this.socket.close();
      } catch (e) {
        // Ignore errors when closing
      }
      this.socket = null;
    }

    // Create new connection
    this.url = url;
    this.socket = new WebSocket(url);

    // Attach internal handlers that delegate to registered listeners
    this.socket.onopen = () => this.handleOpen();
    this.socket.onmessage = (event: MessageEvent) => this.handleMessage(event);
    this.socket.onerror = (event: Event) => this.handleError(event);
    this.socket.onclose = (event: CloseEvent) => this.handleClose(event);

    return this.socket;
  }

  /**
   * Get current connection if exists
   *
   * Returns null if no connection or connection closed.
   * Does not create new connection.
   *
   * @returns Current WebSocket or null
   */
  getConnection(): WebSocket | null {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      return this.socket;
    }
    return null;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Send message via WebSocket
   *
   * Message must be JSON-serializable.
   * Throws error if socket not open.
   *
   * @param message - Message object to send
   * @throws {Error} If socket not open or send fails
   */
  send(message: Record<string, any>): void {
    if (!this.socket) {
      throw new Error('WebSocket not initialized. Call getOrCreateConnection first.');
    }

    if (this.socket.readyState !== WebSocket.OPEN) {
      const stateStr = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.socket.readyState];
      throw new Error(`Cannot send: WebSocket is in ${stateStr} state`);
    }

    try {
      const data = JSON.stringify(message);
      this.socket.send(data);
    } catch (error) {
      throw new Error(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Close the WebSocket connection
   *
   * Does nothing if already closed. Safe to call multiple times.
   *
   * @param code - Optional WebSocket close code (default: 1000)
   * @param reason - Optional close reason
   */
  closeConnection(code: number = 1000, reason: string = 'Normal closure'): void {
    if (this.socket) {
      try {
        this.socket.close(code, reason);
      } catch (e) {
        // Ignore errors
      }
      this.socket = null;
      this.url = '';
    }
  }

  /**
   * Register listener for WebSocket events
   *
   * @param event - Event type: 'open', 'message', 'error', or 'close'
   * @param handler - Callback function
   * @returns Unsubscribe function to remove listener
   */
  addEventListener(
    event: 'open',
    handler: WebSocketOpenHandler,
  ): () => void;
  addEventListener(
    event: 'message',
    handler: WebSocketMessageHandler,
  ): () => void;
  addEventListener(
    event: 'error',
    handler: WebSocketErrorHandler,
  ): () => void;
  addEventListener(
    event: 'close',
    handler: WebSocketCloseHandler,
  ): () => void;
  addEventListener(
    event: 'open' | 'message' | 'error' | 'close',
    handler: WebSocketOpenHandler | WebSocketMessageHandler | WebSocketErrorHandler | WebSocketCloseHandler,
  ): () => void {
    const listeners = this.listeners[event];
    listeners.add(handler as any);

    // Return unsubscribe function
    return () => {
      listeners.delete(handler as any);
    };
  }

  /**
   * Remove listener for WebSocket events
   *
   * @param event - Event type
   * @param handler - Callback function to remove
   */
  removeEventListener(
    event: 'open' | 'message' | 'error' | 'close',
    handler: WebSocketOpenHandler | WebSocketMessageHandler | WebSocketErrorHandler | WebSocketCloseHandler,
  ): void {
    this.listeners[event].delete(handler as any);
  }

  /**
   * Get readyState of current socket
   *
   * Returns null if no socket exists.
   * Values: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
   *
   * @returns readyState or null
   */
  getReadyState(): number | null {
    return this.socket?.readyState ?? null;
  }

  /**
   * Get current URL
   */
  getUrl(): string {
    return this.url;
  }

  /**
   * Reset singleton (for testing)
   *
   * Closes connection and clears listeners. Used by tests to reset state.
   */
  reset(): void {
    this.closeConnection();
    this.listeners = {
      open: new Set(),
      message: new Set(),
      error: new Set(),
      close: new Set(),
    };
  }

  // ===== Private event handlers =====

  /**
   * Internal handler for WebSocket open event
   */
  private handleOpen(): void {
    for (const handler of this.listeners.open) {
      try {
        handler();
      } catch (error) {
        console.error('[DerivWebSocketService] Error in open handler:', error);
      }
    }
  }

  /**
   * Internal handler for WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    for (const handler of this.listeners.message) {
      try {
        handler(event.data);
      } catch (error) {
        console.error('[DerivWebSocketService] Error in message handler:', error);
      }
    }
  }

  /**
   * Internal handler for WebSocket error event
   */
  private handleError(event: Event): void {
    for (const handler of this.listeners.error) {
      try {
        handler(event);
      } catch (error) {
        console.error('[DerivWebSocketService] Error in error handler:', error);
      }
    }
  }

  /**
   * Internal handler for WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.socket = null;
    this.url = '';

    for (const handler of this.listeners.close) {
      try {
        handler(event);
      } catch (error) {
        console.error('[DerivWebSocketService] Error in close handler:', error);
      }
    }
  }
}

/**
 * Export singleton instance getter
 */
export function getDerivWebSocketService(): DerivWebSocketService {
  return DerivWebSocketService.getInstance();
}

/**
 * Export service class for testing
 */
export { DerivWebSocketService };
