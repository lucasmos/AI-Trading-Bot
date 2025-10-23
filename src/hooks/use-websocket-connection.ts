/**
 * useWebSocketConnection Hook
 *
 * Main React hook for managing WebSocket connection to Deriv API.
 * Implements state machine, lifecycle management, message queuing,
 * keep-alive pings, and exponential backoff reconnection.
 *
 * @see {@link ../services/deriv-websocket-service.ts} for low-level service
 * @see {@link ../types/websocket.ts} for type definitions
 */

'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ConnectionState,
  ConnectionSnapshot,
  WebSocketConfig,
  QueuedMessage,
  DEFAULT_WEBSOCKET_CONFIG,
  DEFAULT_KEEP_ALIVE,
} from '@/types/websocket';
import { getDerivWebSocketService } from '@/services/deriv-websocket-service';

/**
 * Return type for useWebSocketConnection hook
 */
export interface UseWebSocketConnectionReturn extends ConnectionSnapshot {
  /** Send message to Deriv API */
  send: (message: Record<string, any>) => void;

  /** Manually disconnect and stop retrying */
  disconnect: () => void;

  /** Check if ready to send messages */
  isReady: boolean;
}

/**
 * Main WebSocket connection hook
 */
export function useWebSocketConnection(
  config: WebSocketConfig,
): UseWebSocketConnectionReturn {
  // Validate and merge config with defaults
  const finalConfig = useMemo(
    () => ({
      ...DEFAULT_WEBSOCKET_CONFIG,
      ...config,
    }) as Required<WebSocketConfig>,
    [config],
  );

  // Unique ID for this connection instance
  const connectionId = useRef<string>(`conn-${Date.now()}-${Math.random()}`);

  // ===== State =====
  const [state, setState] = useState<ConnectionState>(ConnectionState.IDLE);
  const [error, setError] = useState<Error | undefined>();
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [messagesSent, setMessagesSent] = useState(0);
  const [messagesQueued, setMessagesQueued] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [disconnectCount, setDisconnectCount] = useState(0);
  const [uptime, setUptime] = useState(0);
  const [lastMessageTime, setLastMessageTime] = useState<number | undefined>();
  const [lastErrorTime, setLastErrorTime] = useState<number | undefined>();

  // ===== Refs =====
  const socketRef = useRef<WebSocket | null>(null);
  const abortControllerRef = useRef<AbortController>(new AbortController());
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const connectedAtRef = useRef<number | undefined>();
  const connectionTimeoutTimerRef = useRef<NodeJS.Timeout | undefined>();
  const reconnectionTimerRef = useRef<NodeJS.Timeout | undefined>();
  const keepAliveTimerRef = useRef<NodeJS.Timeout | undefined>();
  const uptimeTimerRef = useRef<NodeJS.Timeout | undefined>();

  // ===== Logging Helpers =====
  const logInfo = (msg: string) => console.log(`[TickBasedDisplay] ${msg}`);
  const logWarn = (msg: string) => console.warn(`[TickBasedDisplay] ${msg}`);
  const logError = (msg: string) => console.error(`[TickBasedDisplay] ${msg}`);
  const logDebug = (msg: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[TickBasedDisplay:DEBUG] ${msg}`);
    }
  };

  // ===== State Transition =====
  const transitionState = useCallback(
    (newState: ConnectionState) => {
      setState((prev) => {
        if (prev === newState) return prev;
        logDebug(`State: ${prev} → ${newState}`);
        return newState;
      });
    },
    [],
  );

  // ===== Message Queue =====
  const queueMessage = useCallback((message: Record<string, any>) => {
    messageQueueRef.current.push({ message, timestamp: Date.now() });
    if (messageQueueRef.current.length > 100) {
      messageQueueRef.current.shift();
      logWarn('Queue at capacity, evicted oldest message');
    }
    setMessagesQueued(messageQueueRef.current.length);
  }, []);

  const replayQueuedMessages = useCallback(async () => {
    const messages = [...messageQueueRef.current];
    if (messages.length === 0) return;

    logDebug(`Replaying ${messages.length} messages`);
    for (const qm of messages) {
      try {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify(qm.message));
          setMessagesSent((prev) => prev + 1);
        }
      } catch (err) {
        logError(`Failed to replay message: ${err}`);
        break;
      }
    }

    messageQueueRef.current = [];
    setMessagesQueued(0);
  }, []);

  // ===== WebSocket Operations =====
  const createConnection = useCallback(() => {
    try {
      transitionState(ConnectionState.CONNECTING);

      const service = getDerivWebSocketService();
      const ws = service.getOrCreateConnection(finalConfig.url);
      socketRef.current = ws;

      // Connection timeout
      connectionTimeoutTimerRef.current = setTimeout(() => {
        if (socketRef.current?.readyState !== WebSocket.OPEN) {
          logWarn('Connection timeout (5s)');
          if (socketRef.current) socketRef.current.close();
          transitionState(ConnectionState.RECONNECTING);
        }
      }, finalConfig.connectionTimeoutMs);

      // For mock WebSockets that are immediately open
      if (ws.readyState === WebSocket.OPEN) {
        setTimeout(() => {
          sendAuthMessage();
        }, 0);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(`Connection failed: ${error.message}`);
      setError(error);
      finalConfig.onError?.(error);
      transitionState(ConnectionState.RECONNECTING);
    }
  }, [finalConfig, transitionState]);

  const sendAuthMessage = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      socketRef.current.send(JSON.stringify({ authorize: finalConfig.token }));
      logDebug('Authorization sent');
    } catch (err) {
      logError(`Auth send failed: ${err}`);
    }
  }, [finalConfig.token]);

  const sendKeepAlivePing = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      socketRef.current.send(JSON.stringify({ ping: 1 }));
      logDebug('Keep-alive ping sent');
    } catch (err) {
      logError(`Ping failed: ${err}`);
    }
  }, []);

  const calculateBackoffDelay = useCallback(
    (attempt: number): number => {
      const exp = finalConfig.baseBackoffMs * Math.pow(2, attempt - 1);
      return Math.min(exp, finalConfig.maxBackoffMs);
    },
    [finalConfig.baseBackoffMs, finalConfig.maxBackoffMs],
  );

  const scheduleReconnection = useCallback(() => {
    if (reconnectAttempt >= finalConfig.maxReconnectAttempts) {
      logWarn(`Max reconnection attempts reached (${finalConfig.maxReconnectAttempts})`);
      transitionState(ConnectionState.DISCONNECTED);
      return;
    }

    const nextAttempt = reconnectAttempt + 1;
    const delay = calculateBackoffDelay(nextAttempt);

    logInfo(`Reconnecting... attempt ${nextAttempt}/${finalConfig.maxReconnectAttempts}, waiting ${delay}ms`);
    setReconnectAttempt(nextAttempt);

    reconnectionTimerRef.current = setTimeout(() => {
      if (!abortControllerRef.current.signal.aborted) {
        transitionState(ConnectionState.CONNECTING);
      }
    }, delay);
  }, [reconnectAttempt, finalConfig.maxReconnectAttempts, calculateBackoffDelay, transitionState]);

  // ===== Message Handlers =====
  const handleMessage = useCallback(
    (rawData: string) => {
      setLastMessageTime(Date.now());

      try {
        const data = JSON.parse(rawData);

        // Authorization response
        if (data.msg_type === 'authorize') {
          if (data.error) {
            logError(`Auth error: ${data.error}`);
            setErrorCount((prev) => prev + 1);
            transitionState(ConnectionState.RECONNECTING);
            return;
          }

          if (connectionTimeoutTimerRef.current) {
            clearTimeout(connectionTimeoutTimerRef.current);
            connectionTimeoutTimerRef.current = undefined;
          }

          logInfo('✅ Connected and authorized');
          transitionState(ConnectionState.CONNECTED);
          return;
        }

        // Error responses
        if (data.error) {
          logError(`API error: ${data.error}`);
          setErrorCount((prev) => prev + 1);
          transitionState(ConnectionState.RECONNECTING);
          return;
        }

        // Keep-alive pong
        if (data.msg_type === 'ping') {
          logDebug('Keep-alive pong received');
          return;
        }

        logDebug(`Message received: ${data.msg_type || 'unknown'}`);
      } catch (err) {
        logError(`Failed to parse message: ${err}`);
        setErrorCount((prev) => prev + 1);
      }
    },
    [transitionState],
  );

  const handleError = useCallback(
    (_event: Event) => {
      const error = new Error('WebSocket error');
      logError('WebSocket error occurred');
      setErrorCount((prev) => prev + 1);
      setLastErrorTime(Date.now());
      setError(error);
      finalConfig.onError?.(error);
      transitionState(ConnectionState.RECONNECTING);
    },
    [finalConfig, transitionState],
  );

  const handleClose = useCallback(
    (event: CloseEvent) => {
      setDisconnectCount((prev) => prev + 1);
      logWarn(`Connection closed (code: ${event.code})`);

      if (state !== ConnectionState.DISCONNECTED) {
        transitionState(ConnectionState.RECONNECTING);
      }
    },
    [state, transitionState],
  );

  // ===== Public Methods =====
  const send = useCallback(
    (message: Record<string, any>) => {
      if (state === ConnectionState.CONNECTED && socketRef.current?.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify(message));
          setMessagesSent((prev) => prev + 1);
          logDebug('Message sent');
        } catch (err) {
          logError(`Send failed: ${err}`);
          queueMessage(message);
        }
      } else {
        logDebug('Message queued (not connected)');
        queueMessage(message);
      }
    },
    [state, queueMessage],
  );

  const disconnect = useCallback(() => {
    logInfo('Disconnecting');
    transitionState(ConnectionState.DISCONNECTED);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
    messageQueueRef.current = [];
    setMessagesQueued(0);
  }, [transitionState]);

  // ===== State Machine Effect =====
  useEffect(() => {
    if (abortControllerRef.current.signal.aborted) return;

    switch (state) {
      case ConnectionState.IDLE:
        createConnection();
        break;

      case ConnectionState.CONNECTING:
        // Wait for onopen event
        break;

      case ConnectionState.CONNECTED:
        // Start keep-alive
        if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = setInterval(() => {
          sendKeepAlivePing();
        }, DEFAULT_KEEP_ALIVE.intervalMs);

        // Replay messages
        replayQueuedMessages();

        // Start uptime counter
        if (uptimeTimerRef.current) clearInterval(uptimeTimerRef.current);
        uptimeTimerRef.current = setInterval(() => {
          setUptime((prev) => prev + 1000);
        }, 1000);
        connectedAtRef.current = Date.now();

        break;

      case ConnectionState.RECONNECTING:
        if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
        if (uptimeTimerRef.current) clearInterval(uptimeTimerRef.current);
        connectedAtRef.current = undefined;
        setUptime(0);
        scheduleReconnection();
        break;

      case ConnectionState.DISCONNECTED:
        if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
        if (uptimeTimerRef.current) clearInterval(uptimeTimerRef.current);
        if (connectionTimeoutTimerRef.current) clearTimeout(connectionTimeoutTimerRef.current);
        if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);
        logInfo('❌ Disconnected');
        break;
    }
  }, [state, createConnection, sendKeepAlivePing, replayQueuedMessages, scheduleReconnection]);

  // ===== Event Listeners Effect =====
  useEffect(() => {
    const service = getDerivWebSocketService();

    const unsubOpen = service.addEventListener('open', sendAuthMessage);
    const unsubMsg = service.addEventListener('message', handleMessage);
    const unsubErr = service.addEventListener('error', handleError);
    const unsubClose = service.addEventListener('close', handleClose);

    return () => {
      unsubOpen();
      unsubMsg();
      unsubErr();
      unsubClose();
    };
  }, [sendAuthMessage, handleMessage, handleError, handleClose]);

  // ===== Cleanup on Unmount =====
  useEffect(() => {
    const signal = abortControllerRef.current.signal;

    const handleAbort = () => {
      logDebug('Cleanup on unmount');
      transitionState(ConnectionState.DISCONNECTED);

      if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
      if (uptimeTimerRef.current) clearInterval(uptimeTimerRef.current);
      if (connectionTimeoutTimerRef.current) clearTimeout(connectionTimeoutTimerRef.current);
      if (reconnectionTimerRef.current) clearTimeout(reconnectionTimerRef.current);

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };

    signal.addEventListener('abort', handleAbort);

    return () => {
      abortControllerRef.current.abort();
      signal.removeEventListener('abort', handleAbort);
    };
  }, [transitionState]);

  // ===== Return Snapshot =====
  return {
    id: connectionId.current,
    state,
    isConnected: state === ConnectionState.CONNECTED,
    isConnecting:
      state === ConnectionState.CONNECTING ||
      state === ConnectionState.RECONNECTING,
    uptime,
    lastMessageTime,
    lastErrorTime,
    reconnectAttempt,
    nextRetryIn: state === ConnectionState.RECONNECTING ? 1000 : undefined,
    messagesSent,
    messagesQueued,
    errorCount,
    disconnectCount,
    lastError: error
      ? {
          code: 1006,
          message: error.message,
          timestamp: lastErrorTime ?? Date.now(),
        }
      : undefined,
    send,
    disconnect,
    isReady: state === ConnectionState.CONNECTED,
  };
}
