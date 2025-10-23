# Phase 1: Quick Start Guide
## WebSocket Connection Keep-Alive Integration

**Date**: 2025-10-23  
**Target Audience**: Developers integrating with TickBasedDisplay component  
**Time to Integration**: 15-20 minutes

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Integration with TickBasedDisplay](#integration-with-tickbaseddisplay)
5. [Error Handling](#error-handling)
6. [Monitoring Connection Status](#monitoring-connection-status)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The `useWebSocketConnection` hook provides robust WebSocket connectivity with:
- **Automatic reconnection** with exponential backoff (3s → 6s → 12s → 24s → 30s)
- **Keep-alive pings** every 30 seconds (Deriv API requirement)
- **Message queuing** during disconnections (max 100 messages)
- **Lifecycle management** with proper cleanup via AbortController
- **Connection state tracking** with detailed metrics

**Problem Solved**: Code 1006 WebSocket disconnections in TickBasedDisplay (100+ errors in production)

**Before** (problematic):
```typescript
// Direct WebSocket management in component
useEffect(() => {
  const socket = new WebSocket(url)
  // No keep-alive, no retry, no cleanup
}, [])
```

**After** (with hook):
```typescript
const { isConnected, send, state } = useWebSocketConnection({
  url: 'wss://ws.derivws.com/websockets/v3?app_id=...',
  token: apiToken
})
// Automatic keep-alive, retry with backoff, proper cleanup
```

---

## Installation

### Step 1: Copy Hook File

The hook is available at:
```
src/hooks/use-websocket-connection.ts
```

**Status**: Ready for integration (Phase 1b output)

### Step 2: Verify TypeScript Version

Requires TypeScript 5.x and React 18+

```bash
npm list typescript react
```

**Expected**:
```
typescript@5.x
react@18.x
```

### Step 3: No External Dependencies

✅ Uses only:
- React 18+ (built-in hooks)
- Browser WebSocket API (native)
- TypeScript (no runtime impact)

No new packages needed ✅

---

## Basic Usage

### Simplest Integration (5 minutes)

```typescript
import { useWebSocketConnection } from '@/hooks/use-websocket-connection'

function MyComponent() {
  const { isConnected, state, send } = useWebSocketConnection({
    url: 'wss://ws.derivws.com/websockets/v3?app_id=YOUR_APP_ID',
    token: 'your-api-token'
  })

  return (
    <div>
      {isConnected ? (
        <p>✓ Connected</p>
      ) : (
        <p>✗ Disconnected ({state})</p>
      )}

      <button onClick={() => send({ subscribe_tick: 'R_100' })}>
        Subscribe to Tick
      </button>
    </div>
  )
}
```

### With Configuration (5 minutes)

```typescript
const { isConnected, send, reconnectAttempt } = useWebSocketConnection({
  // Required
  url: 'wss://ws.derivws.com/websockets/v3?app_id=12345',
  token: userApiToken,

  // Optional: customize retry behavior
  maxReconnectAttempts: 6,      // default: 6
  baseBackoffMs: 3000,          // default: 3000 (3 seconds)
  maxBackoffMs: 30000,          // default: 30000 (30 seconds)
  keepAliveIntervalMs: 30000,   // default: 30000 (per Deriv spec)
  connectionTimeoutMs: 5000,    // default: 5000 (5 seconds)

  // Optional: handle state changes
  onStateChange: (state) => {
    console.log('Connection state:', state)
  },

  // Optional: handle errors
  onError: (error) => {
    console.error('Connection error:', error)
  }
})
```

---

## Integration with TickBasedDisplay

### Current TickBasedDisplay Location

```
src/app/automated-trading/components/TickBasedDisplay.tsx
(or similar location in your structure)
```

### Integration Steps

#### Step 1: Import the Hook

```typescript
import { useWebSocketConnection, ConnectionState } from '@/hooks/use-websocket-connection'
```

#### Step 2: Extract API Token from Auth Context

```typescript
import { useAuthContext } from '@/contexts/auth-context'

function TickBasedDisplay(props: TickBasedDisplayProps) {
  const { user, authToken } = useAuthContext()
  
  // ... rest of component
}
```

#### Step 3: Replace Manual WebSocket with Hook

**Before**:
```typescript
useEffect(() => {
  const socket = new WebSocket(url)
  socket.onopen = () => { /* ... */ }
  socket.onmessage = (event) => { /* ... */ }
  // No cleanup, no keep-alive, no retry
}, [])
```

**After**:
```typescript
const {
  state,
  isConnected,
  send,
  messagesSent,
  messagesQueued,
  reconnectAttempt,
  error
} = useWebSocketConnection({
  url: `wss://ws.derivws.com/websockets/v3?app_id=${process.env.NEXT_PUBLIC_DERIV_APP_ID}`,
  token: authToken,
  maxReconnectAttempts: 6,
  onStateChange: (newState) => {
    console.log('WebSocket state changed:', newState)
  },
  onError: (err) => {
    console.error('WebSocket error:', err)
  }
})
```

#### Step 4: Subscribe to Ticks

```typescript
// When connected, send subscription message
useEffect(() => {
  if (isConnected && instrumentId) {
    send({
      subscribe_tick: instrumentId,
      subscribe: 1
    })
  }
}, [isConnected, instrumentId, send])
```

#### Step 5: Handle Incoming Messages

```typescript
// If TickBasedDisplay needs to listen to specific message types,
// add listeners to the WebSocket event handler in the hook or
// integrate with existing message router

// The hook handles the connection lifecycle; your component
// can use send() to request data and display UI based on connection state
```

#### Step 6: Display Connection Status

```typescript
function TickBasedDisplay() {
  const { state, isConnected, reconnectAttempt, lastError } = useWebSocketConnection({
    // config...
  })

  return (
    <div className="tick-display">
      {/* Connection Status Bar */}
      <div className={`status-bar status-${state.toLowerCase()}`}>
        {isConnected && <span>✓ Connected</span>}
        {state === 'CONNECTING' && <span>⟳ Connecting...</span>}
        {state === 'RECONNECTING' && (
          <span>↻ Reconnecting ({reconnectAttempt}/6)...</span>
        )}
        {state === 'DISCONNECTED' && <span>✗ Disconnected</span>}
        {state === 'IDLE' && <span>○ Initializing...</span>}

        {lastError && (
          <span className="error-text">{lastError.message}</span>
        )}
      </div>

      {/* Chart/Display Content */}
      {isConnected ? (
        <TickChart {...props} />
      ) : (
        <div className="reconnecting-overlay">
          <p>Connection {state === 'RECONNECTING' ? 'reconnecting' : 'unavailable'}</p>
        </div>
      )}
    </div>
  )
}
```

---

## Error Handling

### Handling Different Error Types

```typescript
const { state, lastError, reconnectAttempt } = useWebSocketConnection({
  url: '...',
  token: '...',
  onError: (error) => {
    // Log for monitoring
    console.error('[WebSocket Error]', error.message)

    // Send to error tracking service
    trackError({
      type: 'WEBSOCKET_ERROR',
      message: error.message,
      timestamp: new Date()
    })
  }
})

// In render:
{lastError && (
  <ErrorBoundary error={lastError}>
    <ErrorMessage>
      Connection issue: {lastError.message}
      {reconnectAttempt < 6 && ' (will retry)'}
    </ErrorMessage>
  </ErrorBoundary>
)}
```

### Expected Error Patterns

| Error | Cause | Action |
|-------|-------|--------|
| "Code 1006" | Abnormal closure (network issue) | Hook retries automatically ✅ |
| "Connection timeout" | No response in 5s | Hook retries automatically ✅ |
| "Authorization failed" | Invalid token or expired | Manual retry needed (request new token) |
| "Max attempts reached" | 6 retries exhausted | Display UI prompting manual reconnect |

### Graceful Degradation

```typescript
function TickBasedDisplay() {
  const { state } = useWebSocketConnection({...})

  if (state === 'DISCONNECTED') {
    return (
      <div className="disconnected-state">
        <p>Unable to connect. Please check your connection and refresh.</p>
        <button onClick={() => window.location.reload()}>
          Refresh Page
        </button>
      </div>
    )
  }

  return <TickChart />
}
```

---

## Monitoring Connection Status

### Real-Time Metrics

```typescript
function ConnectionDashboard() {
  const {
    state,
    isConnected,
    uptime,
    messagesSent,
    messagesQueued,
    errorCount,
    disconnectCount,
    reconnectAttempt,
    nextRetryIn,
    lastMessageTime
  } = useWebSocketConnection({...})

  return (
    <div className="connection-dashboard">
      <h3>WebSocket Connection Status</h3>

      {/* State */}
      <p>
        Current State: <strong>{state}</strong>
      </p>

      {/* Uptime */}
      {isConnected && (
        <p>
          Connected for: <strong>{(uptime / 1000).toFixed(1)}s</strong>
        </p>
      )}

      {/* Retry Info */}
      {state === 'RECONNECTING' && (
        <p>
          Reconnection: Attempt {reconnectAttempt}/6, Next retry in{' '}
          <strong>{(nextRetryIn / 1000).toFixed(1)}s</strong>
        </p>
      )}

      {/* Statistics */}
      <table>
        <tbody>
          <tr>
            <td>Messages Sent:</td>
            <td>{messagesSent}</td>
          </tr>
          <tr>
            <td>Messages Queued:</td>
            <td>{messagesQueued}</td>
          </tr>
          <tr>
            <td>Errors:</td>
            <td>{errorCount}</td>
          </tr>
          <tr>
            <td>Disconnects:</td>
            <td>{disconnectCount}</td>
          </tr>
        </tbody>
      </table>

      {/* Last Activity */}
      {lastMessageTime && (
        <p>
          Last Activity:{' '}
          <strong>{new Date(lastMessageTime).toLocaleTimeString()}</strong>
        </p>
      )}
    </div>
  )
}
```

---

## Testing

### Unit Test Example

```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWebSocketConnection, ConnectionState } from '@/hooks/use-websocket-connection'

describe('useWebSocketConnection', () => {
  // Mock WebSocket
  beforeEach(() => {
    global.WebSocket = jest.fn(() => ({
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    })) as any
  })

  test('initializes in IDLE state', () => {
    const { result } = renderHook(() =>
      useWebSocketConnection({
        url: 'wss://ws.test.com',
        token: 'test-token'
      })
    )

    expect(result.current.state).toBe(ConnectionState.IDLE)
  })

  test('transitions to CONNECTING on mount', async () => {
    const { result } = renderHook(() =>
      useWebSocketConnection({
        url: 'wss://ws.test.com',
        token: 'test-token'
      })
    )

    await waitFor(() => {
      expect(result.current.state).toBe(ConnectionState.CONNECTING)
    })
  })

  test('provides send() method', () => {
    const { result } = renderHook(() =>
      useWebSocketConnection({
        url: 'wss://ws.test.com',
        token: 'test-token'
      })
    )

    expect(typeof result.current.send).toBe('function')
  })
})
```

### Integration Test Example

```typescript
test('recovers from Code 1006 disconnect', async () => {
  const { result } = renderHook(() =>
    useWebSocketConnection({
      url: 'wss://ws.test.com',
      token: 'test-token',
      baseBackoffMs: 100  // Speed up for testing
    })
  )

  // Wait for connected
  await waitFor(() => {
    expect(result.current.isConnected).toBe(true)
  })

  // Simulate Code 1006 close
  act(() => {
    // Trigger onclose with Code 1006
  })

  // Should transition to RECONNECTING
  expect(result.current.state).toBe(ConnectionState.RECONNECTING)

  // Should retry
  await waitFor(() => {
    expect(result.current.state).toBe(ConnectionState.CONNECTING)
  })
})
```

---

## Troubleshooting

### Issue: Connection stays in CONNECTING state

**Diagnosis**:
```typescript
const { state, lastError } = useWebSocketConnection({...})

// Check browser console for [TickBasedDisplay:DEBUG] messages
// Look for 'Connection timeout' or authorization errors
```

**Common Causes & Fixes**:

| Issue | Cause | Fix |
|-------|-------|-----|
| WebSocket URL invalid | Wrong wss:// URL or missing app_id | Verify URL format: `wss://ws.derivws.com/websockets/v3?app_id=YOUR_ID` |
| Authorization timeout | Invalid or expired token | Get fresh token from auth context |
| CORS blocked | Browser security policy | Deriv API should allow cross-origin, verify app registration |

### Issue: Rapid reconnection loop

**Diagnosis**:
```
[TickBasedDisplay] ↻ Reconnection attempt 1/6
[TickBasedDisplay] ↻ Reconnection attempt 2/6
[TickBasedDisplay] ↻ Reconnection attempt 3/6
... (too fast, not waiting between attempts)
```

**Cause**: baseBackoffMs set too low or exponential backoff calculation broken

**Fix**:
```typescript
const { ... } = useWebSocketConnection({
  baseBackoffMs: 3000,  // Must be >= 1000 (3 seconds)
  maxBackoffMs: 30000   // Must be >= baseBackoffMs
})
```

### Issue: Messages not being sent

**Diagnosis**:
```typescript
const { send, isReady, messagesSent, messagesQueued, isConnected } = useWebSocketConnection({...})

console.log({
  isConnected,
  isReady: isReady(),
  messagesSent,
  messagesQueued
})

// Send test message
send({ test: true })

// Check if queued or sent
```

**Common Causes & Fixes**:

| Issue | Cause | Fix |
|-------|-------|-----|
| Messages queued | Not yet connected | Wait for `isConnected === true` before sending |
| isReady() returns false | Socket closed | Hook will auto-reconnect, wait for CONNECTED state |
| Messages sent but no response | Message format wrong | Check Deriv API documentation for message format |

### Issue: Memory usage increasing over time

**Diagnosis**:
```typescript
// Monitor message queue
const { messagesQueued } = useWebSocketConnection({...})

// If messagesQueued constantly growing, messages aren't being flushed
```

**Cause**: Connection never fully establishes (stuck in RECONNECTING)

**Fix**:
1. Check connection logs for errors
2. Verify token is fresh (request new token if needed)
3. Check Deriv API status (may be temporarily unavailable)

---

## Common Patterns

### Pattern 1: Subscribe Once Connected

```typescript
useEffect(() => {
  if (isConnected && instrumentId) {
    send({
      subscribe_tick: instrumentId,
      subscribe: 1
    })
  }
}, [isConnected, instrumentId, send])
```

### Pattern 2: Retry on Manual Disconnect

```typescript
const [manuallyDisconnected, setManuallyDisconnected] = useState(false)

function handleDisconnect() {
  setManuallyDisconnected(true)
  disconnect()
}

function handleReconnect() {
  setManuallyDisconnected(false)
  // Component will remount hook with new config, re-establishing connection
}
```

### Pattern 3: Load Balancing Multiple Instruments

```typescript
// Separate hook for each instrument to balance load
const btcPrice = useWebSocketConnection({
  url: '...',
  token: '...',
  onStateChange: (state) => {
    if (state === 'CONNECTED') {
      btcPrice.send({ subscribe_tick: 'EURUSD' })
    }
  }
})

const eurusdPrice = useWebSocketConnection({
  url: '...',
  token: '...',
  onStateChange: (state) => {
    if (state === 'CONNECTED') {
      eurusdPrice.send({ subscribe_tick: 'EURUSD' })
    }
  }
})
```

---

## Performance Considerations

### Memory Budget

- Per-connection instance: ~500KB (hook state + timers)
- Message queue (100 messages): ~5MB max
- Keep-alive timer: Minimal overhead
- **Total**: <10MB per active component

### CPU Impact

- Exponential backoff: O(log n) calculations
- Message queue replay: O(n) on reconnection (where n ≤ 100)
- Keep-alive ping: 1 message per 30 seconds
- **Total**: Negligible impact on CPU

### Network Impact

- Keep-alive: 1 ping message per 30s (~100 bytes)
- Message queue: Only sent during active trading
- Backoff: Reduces traffic during outages ✅

---

## Next Steps

1. **Copy** `use-websocket-connection.ts` to `src/hooks/`
2. **Integrate** with TickBasedDisplay component
3. **Test** connection state transitions
4. **Monitor** connection metrics in production
5. **Execute** Phase 2 task breakdown via `/speckit.tasks`

---

## Support

For issues, questions, or detailed implementation:
- Check [research.md](./research.md) for design decisions
- Review [data-model.md](./data-model.md) for entity definitions
- See [contracts/use-websocket-connection.ts](./contracts/use-websocket-connection.ts) for full type definitions

**Ready for Phase 2**: Task breakdown and implementation execution
