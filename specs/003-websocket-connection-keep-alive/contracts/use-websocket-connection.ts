// hooks/use-websocket-connection.ts
// WebSocket connection lifecycle management hook
// Spec: 003-websocket-connection-keep-alive
// 
// This hook manages:
// - Connection state machine (IDLE → CONNECTING → CONNECTED → RECONNECTING → DISCONNECTED)
// - Keep-alive pings (30s intervals, Deriv API requirement)
// - Exponential backoff retry (3s → 6s → 12s → 24s → 30s → 30s)
// - Message queuing during disconnections
// - Resource cleanup on unmount (AbortController pattern)
// - Logging (INFO for lifecycle, DEBUG for protocol)

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Connection state enumeration
 * IDLE → CONNECTING → CONNECTED
 *           ↓ (failure)
 *        RECONNECTING → CONNECTING (retry loop)
 *           ↓ (max attempts)
 *        DISCONNECTED (terminal)
 */
export enum ConnectionState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED'
}

/**
 * Configuration passed to hook on initialization
 */
export interface WebSocketConfig {
  // Required
  url: string
  token: string

  // Optional with defaults
  maxReconnectAttempts?: number // default: 6
  baseBackoffMs?: number // default: 3000 (3 seconds)
  maxBackoffMs?: number // default: 30000 (30 seconds)
  keepAliveIntervalMs?: number // default: 30000 (30 seconds, per Deriv spec)
  connectionTimeoutMs?: number // default: 5000 (5 seconds)

  // Optional callbacks
  onStateChange?: (state: ConnectionState) => void
  onError?: (error: Error) => void
}

/**
 * Snapshot of connection state returned by hook to consumers
 * Provides read-only view of current connection state and statistics
 */
export interface WebSocketConnectionSnapshot {
  // Identity and state
  state: ConnectionState
  isConnected: boolean // state === CONNECTED
  isConnecting: boolean // state === CONNECTING || RECONNECTING

  // Timing
  uptime: number // milliseconds since entering CONNECTED state
  lastMessageTime?: number // timestamp of last message
  lastErrorTime?: number // timestamp of last error

  // Reconnection
  reconnectAttempt: number // current attempt (1-6) in RECONNECTING state
  nextRetryIn?: number // milliseconds until next reconnection attempt

  // Statistics
  messagesSent: number // total messages sent successfully
  messagesQueued: number // messages currently waiting to send
  errorCount: number // total errors encountered
  disconnectCount: number // total disconnect events

  // Error details
  lastError?: {
    code?: number // WebSocket close code (e.g. 1006)
    message: string
    timestamp: number
  }
}

/**
 * Return value of useWebSocketConnection hook
 */
export interface UseWebSocketConnectionReturn extends WebSocketConnectionSnapshot {
  // Methods for component to call
  send: (message: Record<string, any>) => Promise<void>
  disconnect: () => void
  isReady: () => boolean
}

/**
 * useWebSocketConnection - Main hook implementation
 *
 * @param config - Configuration for WebSocket connection
 * @returns Connection state snapshot and control methods
 *
 * @example
 * const { state, isConnected, send, messagesSent } = useWebSocketConnection({
 *   url: 'wss://ws.derivws.com/websockets/v3?app_id=12345',
 *   token: apiToken,
 *   maxReconnectAttempts: 6,
 *   baseBackoffMs: 3000
 * })
 *
 * // Wait for connection
 * useEffect(() => {
 *   if (isConnected) {
 *     send({ subscribe_tick: 'R_100' })
 *   }
 * }, [isConnected, send])
 */
export function useWebSocketConnection(
  config: WebSocketConfig
): UseWebSocketConnectionReturn {
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  const [state, setState] = useState<ConnectionState>(ConnectionState.IDLE)
  const [error, setError] = useState<Error | undefined>()
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [messagesSent, setMessagesSent] = useState(0)
  const [messagesQueued, setMessagesQueued] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [disconnectCount, setDisconnectCount] = useState(0)
  const [uptime, setUptime] = useState(0)
  const [lastMessageTime, setLastMessageTime] = useState<number>()

  // Configuration with defaults
  const configWithDefaults = {
    maxReconnectAttempts: 6,
    baseBackoffMs: 3000,
    maxBackoffMs: 30000,
    keepAliveIntervalMs: 30000,
    connectionTimeoutMs: 5000,
    ...config
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REFS (Persistent across re-renders)
  // ═══════════════════════════════════════════════════════════════════════════

  const socketRef = useRef<WebSocket | null>(null)
  const abortControllerRef = useRef(new AbortController())
  const reconnectTimerRef = useRef<NodeJS.Timeout>()
  const keepAliveTimerRef = useRef<NodeJS.Timeout>()
  const connectionTimeoutRef = useRef<NodeJS.Timeout>()
  const messageQueueRef = useRef<Array<Record<string, any>>>([])
  const connectedAtRef = useRef<number>(0)
  const lastMessageAtRef = useRef<number>(0)

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER: Calculate exponential backoff delay
  // ═══════════════════════════════════════════════════════════════════════════

  const calculateBackoffDelay = useCallback(
    (attempt: number): number => {
      // attempt is 1-indexed
      const exponentialDelay =
        configWithDefaults.baseBackoffMs * Math.pow(2, attempt - 1)
      return Math.min(exponentialDelay, configWithDefaults.maxBackoffMs)
    },
    [configWithDefaults.baseBackoffMs, configWithDefaults.maxBackoffMs]
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER: Log with prefix
  // ═══════════════════════════════════════════════════════════════════════════

  const log = {
    info: (msg: string, data?: any) => {
      const prefix = '[TickBasedDisplay]'
      console.log(prefix, msg, data)
    },
    warn: (msg: string, data?: any) => {
      const prefix = '[TickBasedDisplay]'
      console.warn(prefix, msg, data)
    },
    error: (msg: string, data?: any) => {
      const prefix = '[TickBasedDisplay]'
      console.error(prefix, msg, data)
    },
    debug: (msg: string, data?: any) => {
      const prefix = '[TickBasedDisplay:DEBUG]'
      if (process.env.NODE_ENV === 'development') {
        console.debug(prefix, msg, data)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE SETTER: Transition state with logging and callbacks
  // ═══════════════════════════════════════════════════════════════════════════

  const transitionState = useCallback(
    (newState: ConnectionState) => {
      setState((prev) => {
        if (prev === newState) return prev // No-op if already in state

        log.debug(`State transition: ${prev} → ${newState}`)

        // Update uptime if entering CONNECTED
        if (newState === ConnectionState.CONNECTED) {
          connectedAtRef.current = Date.now()
          log.info('✓ WebSocket connected and authorized')
        }

        // Update uptime if leaving CONNECTED
        if (
          prev === ConnectionState.CONNECTED &&
          newState !== ConnectionState.CONNECTED
        ) {
          const uptimeMs = Date.now() - connectedAtRef.current
          log.info(`✗ Connection lost after ${(uptimeMs / 1000).toFixed(1)}s`)
        }

        // Call user callback
        configWithDefaults.onStateChange?.(newState)

        return newState
      })
    },
    [configWithDefaults]
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLER: Message received from WebSocket
  // ═══════════════════════════════════════════════════════════════════════════

  const handleMessage = useCallback((event: MessageEvent) => {
    lastMessageAtRef.current = Date.now()
    setLastMessageTime(Date.now())

    try {
      const data = JSON.parse(event.data)
      log.debug('Received:', data)

      // Handle errors in response
      if (data.error) {
        const errorMsg = data.error.message || 'Unknown error'
        log.error('Server error:', errorMsg)
        setError(new Error(errorMsg))
        setErrorCount((prev) => prev + 1)
      }

      // Handle authorization response
      if (data.msg_type === 'authorize') {
        if (data.status === 'ok') {
          log.debug('Authorization successful')
          transitionState(ConnectionState.CONNECTED)
          clearTimeout(connectionTimeoutRef.current)
        } else {
          log.error('Authorization failed:', data)
          transitionState(ConnectionState.RECONNECTING)
        }
      }

      // Update UI with price data, tick data, etc.
      // (Component-level message handlers subscribe to this separately)
    } catch (parseErr) {
      log.error('Failed to parse message:', event.data)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLER: Connection error
  // ═══════════════════════════════════════════════════════════════════════════

  const handleError = useCallback(
    (event: Event) => {
      const errorMsg = `WebSocket error: ${(event as any).message || 'unknown'}`
      log.error(errorMsg)

      const err = new Error(errorMsg)
      setError(err)
      setErrorCount((prev) => prev + 1)
      configWithDefaults.onError?.(err)

      if (state !== ConnectionState.DISCONNECTED) {
        transitionState(ConnectionState.RECONNECTING)
      }
    },
    [state, transitionState, configWithDefaults]
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLER: Connection closed
  // ═══════════════════════════════════════════════════════════════════════════

  const handleClose = useCallback(
    (event: CloseEvent) => {
      setDisconnectCount((prev) => prev + 1)
      log.warn(`WebSocket closed: Code ${event.code}, Reason: ${event.reason}`)

      if (event.code === 1006) {
        log.warn(
          'Code 1006 (abnormal closure) - will attempt to reconnect'
        )
      }

      if (state !== ConnectionState.DISCONNECTED) {
        transitionState(ConnectionState.RECONNECTING)
      }
    },
    [state, transitionState]
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLER: Keep-alive ping
  // ═══════════════════════════════════════════════════════════════════════════

  const sendKeepAlivePing = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({ ping: 1 }))
        log.debug('Keep-alive ping sent')
      } catch (err) {
        log.error('Failed to send keep-alive ping:', err)
      }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: Create WebSocket connection
  // ═══════════════════════════════════════════════════════════════════════════

  const createConnection = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      log.debug('Connection already exists, skipping creation')
      return
    }

    log.info('Creating WebSocket connection...')
    transitionState(ConnectionState.CONNECTING)

    try {
      socketRef.current = new WebSocket(configWithDefaults.url)

      socketRef.current.onopen = () => {
        log.debug('WebSocket opened, sending authorization...')

        // Send authorization
        try {
          socketRef.current?.send(
            JSON.stringify({
              authorize: configWithDefaults.token
            })
          )
        } catch (err) {
          log.error('Failed to send authorization:', err)
          transitionState(ConnectionState.RECONNECTING)
        }

        // Set connection timeout (will cancel if auth succeeds)
        connectionTimeoutRef.current = setTimeout(() => {
          log.warn('Connection authorization timeout, will retry')
          transitionState(ConnectionState.RECONNECTING)
          socketRef.current?.close()
        }, configWithDefaults.connectionTimeoutMs)
      }

      socketRef.current.onmessage = handleMessage
      socketRef.current.onerror = handleError
      socketRef.current.onclose = handleClose
    } catch (err) {
      log.error('Failed to create WebSocket:', err)
      transitionState(ConnectionState.RECONNECTING)
    }
  }, [configWithDefaults.url, configWithDefaults.token, configWithDefaults.connectionTimeoutMs, transitionState, handleMessage, handleError, handleClose])

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: Schedule reconnection with exponential backoff
  // ═══════════════════════════════════════════════════════════════════════════

  const scheduleReconnection = useCallback(
    (attempt: number) => {
      if (attempt >= configWithDefaults.maxReconnectAttempts) {
        log.error(`Max reconnection attempts (${configWithDefaults.maxReconnectAttempts}) reached`)
        transitionState(ConnectionState.DISCONNECTED)
        setReconnectAttempt(0)
        return
      }

      const delay = calculateBackoffDelay(attempt)
      log.info(`↻ Reconnection attempt ${attempt}/${configWithDefaults.maxReconnectAttempts}, waiting ${delay}ms`)
      setReconnectAttempt(attempt)

      reconnectTimerRef.current = setTimeout(() => {
        createConnection()
        scheduleReconnection(attempt + 1)
      }, delay)
    },
    [configWithDefaults.maxReconnectAttempts, calculateBackoffDelay, transitionState, createConnection]
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: Send message (queues if disconnected)
  // ═══════════════════════════════════════════════════════════════════════════

  const send = useCallback(
    async (message: Record<string, any>): Promise<void> => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(message))
        setMessagesSent((prev) => prev + 1)
        log.debug('Message sent:', message)
      } else {
        // Queue message
        messageQueueRef.current.push(message)
        setMessagesQueued(messageQueueRef.current.length)
        log.debug('Message queued (connection not ready):', message)
      }
    },
    []
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: Replay queued messages
  // ═══════════════════════════════════════════════════════════════════════════

  const replayQueuedMessages = useCallback(() => {
    if (messageQueueRef.current.length === 0) return

    const toSend = [...messageQueueRef.current]
    messageQueueRef.current = []
    setMessagesQueued(0)

    log.info(`Replaying ${toSend.length} queued messages...`)

    for (const message of toSend) {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(message))
        setMessagesSent((prev) => prev + 1)
        log.debug('Replayed message:', message)
      }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: Disconnect manually
  // ═══════════════════════════════════════════════════════════════════════════

  const disconnect = useCallback(() => {
    log.info('Disconnect requested')
    transitionState(ConnectionState.DISCONNECTED)
    abortControllerRef.current.abort()
  }, [transitionState])

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION: Check if ready to send
  // ═══════════════════════════════════════════════════════════════════════════

  const isReady = useCallback(() => {
    return state === ConnectionState.CONNECTED && socketRef.current?.readyState === WebSocket.OPEN
  }, [state])

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: Main lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const signal = abortControllerRef.current.signal

    // Abort listeners
    const handleAbort = () => {
      log.info('🛑 Component unmounting, cancelling all pending operations')

      clearInterval(keepAliveTimerRef.current)
      clearTimeout(reconnectTimerRef.current)
      clearTimeout(connectionTimeoutRef.current)

      socketRef.current?.close()
      socketRef.current = null
    }

    signal.addEventListener('abort', handleAbort)

    // Initial connection
    if (state === ConnectionState.IDLE && !signal.aborted) {
      createConnection()
    }

    // Start keep-alive when connected
    if (state === ConnectionState.CONNECTED && !keepAliveTimerRef.current) {
      keepAliveTimerRef.current = setInterval(
        sendKeepAlivePing,
        configWithDefaults.keepAliveIntervalMs
      )

      // Replay any queued messages
      replayQueuedMessages()
    }

    // Stop keep-alive when not connected
    if (state !== ConnectionState.CONNECTED && keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current)
      keepAliveTimerRef.current = undefined
    }

    // Schedule reconnection when entering RECONNECTING state
    if (state === ConnectionState.RECONNECTING && reconnectAttempt === 0) {
      scheduleReconnection(1)
    }

    // Cleanup
    return () => {
      signal.removeEventListener('abort', handleAbort)
    }
  }, [state, configWithDefaults.keepAliveIntervalMs, createConnection, sendKeepAlivePing, replayQueuedMessages, scheduleReconnection, reconnectAttempt])

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT: Track uptime
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (state !== ConnectionState.CONNECTED) return

    const interval = setInterval(() => {
      setUptime(Date.now() - connectedAtRef.current)
    }, 1000)

    return () => clearInterval(interval)
  }, [state])

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN: Connection snapshot
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    state,
    isConnected: state === ConnectionState.CONNECTED,
    isConnecting: state === ConnectionState.CONNECTING || state === ConnectionState.RECONNECTING,
    uptime,
    lastMessageTime,
    lastErrorTime: error ? Date.now() : undefined,
    reconnectAttempt,
    nextRetryIn:
      state === ConnectionState.RECONNECTING
        ? calculateBackoffDelay(reconnectAttempt)
        : undefined,
    messagesSent,
    messagesQueued,
    errorCount,
    disconnectCount,
    lastError: error
      ? {
          message: error.message,
          timestamp: Date.now()
        }
      : undefined,
    send,
    disconnect,
    isReady
  }
}
