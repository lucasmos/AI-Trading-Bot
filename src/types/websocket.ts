/**
 * WebSocket Connection Keep-Alive Types
 *
 * Comprehensive type definitions for WebSocket connection management,
 * state tracking, message queuing, and Deriv API integration.
 *
 * @see {@link ../hooks/use-websocket-connection.ts} for hook implementation
 * @see {@link ../../specs/003-websocket-connection-keep-alive/data-model.md} for domain model
 */

/**
 * Connection lifecycle state machine
 *
 * States represent progression of WebSocket connection:
 * - IDLE: Initial state, no connection attempt started
 * - CONNECTING: Connection in progress, awaiting authorization
 * - CONNECTED: Active connection, ready for messages
 * - RECONNECTING: Lost connection, automatic retry in progress
 * - DISCONNECTED: Terminal state, no further transitions
 */
export enum ConnectionState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED',
}

/**
 * WebSocket configuration passed to useWebSocketConnection hook
 *
 * Required fields:
 * - url: WebSocket server URL (must be wss:// protocol)
 * - token: Authorization token for Deriv API
 *
 * Optional fields have defaults matching Deriv API specifications.
 */
export interface WebSocketConfig {
  // Required
  /** WebSocket URL (e.g. wss://ws.derivws.com/websockets/v3?app_id=12345) */
  url: string;

  /** Authorization token for Deriv API */
  token: string;

  // Optional with defaults
  /** Maximum reconnection attempts before giving up (default: 6) */
  maxReconnectAttempts?: number;

  /** Base exponential backoff delay in milliseconds (default: 3000) */
  baseBackoffMs?: number;

  /** Maximum backoff delay cap in milliseconds (default: 30000) */
  maxBackoffMs?: number;

  /** Keep-alive ping interval in milliseconds (default: 30000, per Deriv spec) */
  keepAliveIntervalMs?: number;

  /** Connection timeout in milliseconds (default: 5000) */
  connectionTimeoutMs?: number;

  /** Optional callback fired when connection state changes */
  onStateChange?: (state: ConnectionState) => void;

  /** Optional callback fired on connection errors */
  onError?: (error: Error) => void;
}

/**
 * Single message stored in the message queue
 *
 * Stores messages that cannot be sent due to disconnection.
 * Messages are replayed in FIFO order when reconnection succeeds.
 */
export interface QueuedMessage {
  /** The actual message payload to send */
  message: Record<string, any>;

  /** Timestamp when message was queued (milliseconds) */
  timestamp: number;

  /** Replay attempt count for monitoring (optional) */
  attempt?: number;
}

/**
 * Keep-alive ping configuration
 *
 * Prevents Deriv from closing the connection after 2 minutes of inactivity.
 * Per Deriv documentation, pings should be sent every 30 seconds.
 */
export interface KeepAliveConfig {
  /** Ping interval in milliseconds (default: 30000) */
  intervalMs: number;

  /** Timeout waiting for pong response (not used in v1, reserved for future) */
  timeoutMs: number;

  /** Message payload to send as ping (default: { ping: 1 }) */
  message: Record<string, any>;
}

/**
 * Exponential backoff reconnection configuration
 *
 * Defines retry behavior after connection loss.
 * Uses exponential backoff: 3s → 6s → 12s → 24s → 30s → 30s
 */
export interface ReconnectionConfig {
  /** Maximum number of reconnection attempts (default: 6) */
  maxAttempts: number;

  /** Base delay for exponential calculation in milliseconds (default: 3000) */
  baseDelayMs: number;

  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs: number;
}

/**
 * Point-in-time snapshot of connection state
 *
 * Exported from hook to consumer components for UI updates.
 * Includes all relevant metadata about connection health and statistics.
 * All fields are read-only from consumer perspective.
 */
export interface ConnectionSnapshot {
  // Identity
  /** Unique identifier for this connection instance */
  id: string;

  // State
  /** Current connection lifecycle state */
  state: ConnectionState;

  /** Convenience boolean: true if state === CONNECTED */
  isConnected: boolean;

  /** Convenience boolean: true if state === CONNECTING || RECONNECTING */
  isConnecting: boolean;

  // Timing
  /** Milliseconds since entering CONNECTED state (0 if never connected) */
  uptime: number;

  /** Timestamp of last message sent or received (undefined if never) */
  lastMessageTime?: number;

  /** Timestamp of last error (undefined if no error yet) */
  lastErrorTime?: number;

  // Reconnection
  /** Current reconnection attempt number (1-6, or 0 if not reconnecting) */
  reconnectAttempt: number;

  /** Milliseconds until next reconnection retry (only populated in RECONNECTING state) */
  nextRetryIn?: number;

  // Statistics
  /** Total number of messages successfully sent */
  messagesSent: number;

  /** Current number of messages queued (awaiting send) */
  messagesQueued: number;

  /** Total number of errors encountered */
  errorCount: number;

  /** Total number of disconnect events */
  disconnectCount: number;

  // Error details
  /** Details of the most recent error (if any) */
  lastError?: {
    /** WebSocket close code (e.g. 1006 for abnormal closure) */
    code?: number;

    /** Human-readable error message */
    message: string;

    /** Timestamp when error occurred (milliseconds) */
    timestamp: number;
  };
}

/**
 * Internal connection metadata stored in component state
 *
 * Contains additional details not exposed through ConnectionSnapshot,
 * used for internal state management and debugging.
 */
export interface ConnectionStateMetadata {
  /** Current connection state */
  state: ConnectionState;

  /** When state was entered (milliseconds since epoch) */
  enteredAt: number;

  /** Last message sent or received in CONNECTED state (milliseconds) */
  lastMessageAt?: number;

  /** Last error that triggered a state transition (milliseconds) */
  lastErrorAt?: number;

  /** Current reconnection attempt number (1-6) */
  reconnectAttempt?: number;
}

/**
 * Message validation rules
 *
 * Used to validate outgoing messages before queueing/sending.
 * Ensures messages meet Deriv API requirements and size limits.
 */
export interface MessageValidation {
  /** Maximum message size in bytes (default: 1MB per Deriv spec) */
  maxSizeBytes: number;

  /** Fields that must be present in message */
  requiredFields: string[];

  /** Fields that are not allowed in message */
  forbiddenFields: string[];
}

/**
 * Timing constraints for the connection system
 *
 * References Deriv API specifications:
 * - Deriv closes connections after 2 minutes (120000ms) of inactivity
 * - Keep-alive pings should be sent every 30 seconds
 * - Connection timeout should be 5 seconds
 */
export interface TimingConstraints {
  /** Must establish connection within this time (default: 5000ms) */
  connectionTimeoutMs: number;

  /** Deriv closes connection after this inactivity period (2 minutes: 120000ms) */
  derivIdleTimeoutMs: number;

  /** Frequency of keep-alive pings (default: 30000ms) */
  keepAlivePingIntervalMs: number;

  /** Minimum backoff delay (default: 3000ms) */
  minBackoffMs: number;

  /** Maximum backoff delay (default: 30000ms, must be < derivIdleTimeoutMs) */
  maxBackoffMs: number;
}

/**
 * Discriminated union of connection events
 *
 * Used for internal event handling and logging.
 * Each event type has specific fields relevant to that event.
 */
export type ConnectionEvent =
  | {
      type: 'CONNECTING';
      timestamp: number;
    }
  | {
      type: 'CONNECTED';
      timestamp: number;
    }
  | {
      type: 'RECONNECTING';
      attempt: number;
      nextRetryIn: number;
      timestamp: number;
    }
  | {
      type: 'DISCONNECTED';
      reason: 'MAX_ATTEMPTS' | 'UNMOUNT' | 'ERROR';
      timestamp: number;
    }
  | {
      type: 'MESSAGE_QUEUED';
      size: number;
      timestamp: number;
    }
  | {
      type: 'MESSAGE_SENT';
      count: number;
      timestamp: number;
    };

/**
 * Default configuration values
 *
 * Used when corresponding option is not provided to hook.
 * All values comply with Deriv API specifications.
 */
export const DEFAULT_WEBSOCKET_CONFIG: Readonly<Omit<WebSocketConfig, 'url' | 'token'>> = {
  maxReconnectAttempts: 6,
  baseBackoffMs: 3000,
  maxBackoffMs: 30000,
  keepAliveIntervalMs: 30000,
  connectionTimeoutMs: 5000,
};

/**
 * Default keep-alive configuration
 *
 * 30-second interval matches Deriv's 2-minute idle timeout
 * with safety margin for network latency.
 */
export const DEFAULT_KEEP_ALIVE: Readonly<KeepAliveConfig> = {
  intervalMs: 30000,
  timeoutMs: 5000,
  message: { ping: 1 },
};

/**
 * Default reconnection configuration
 *
 * Exponential backoff: 3s → 6s → 12s → 24s → 30s → 30s
 * Total retry window: ~105 seconds (less than Deriv's 120s idle timeout)
 */
export const DEFAULT_RECONNECTION: Readonly<ReconnectionConfig> = {
  maxAttempts: 6,
  baseDelayMs: 3000,
  maxDelayMs: 30000,
};

/**
 * Default timing constraints
 *
 * All values derived from Deriv API documentation and testing.
 * Do not modify these without coordination with Deriv support.
 */
export const DEFAULT_TIMING_CONSTRAINTS: Readonly<TimingConstraints> = {
  connectionTimeoutMs: 5000,
  derivIdleTimeoutMs: 120000,
  keepAlivePingIntervalMs: 30000,
  minBackoffMs: 3000,
  maxBackoffMs: 30000,
};

/**
 * Default message validation rules
 *
 * Conservative defaults suitable for most Deriv API operations.
 * Can be overridden per message if needed.
 */
export const DEFAULT_MESSAGE_VALIDATION: Readonly<MessageValidation> = {
  maxSizeBytes: 1024 * 1024, // 1MB per Deriv spec
  requiredFields: [],
  forbiddenFields: [],
};
