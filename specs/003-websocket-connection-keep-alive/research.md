# Phase 0: Research & Design Decisions
## WebSocket Connection Keep-Alive for TickBasedDisplay

**Date**: 2025-10-23  
**Focus**: Validate design patterns, establish connection state machine, resolve design unknowns

---

## Design Pattern Decisions

### 1. Hook vs Service: Connection Lifecycle Management

**Decision**: **Hybrid Approach - Custom Hook + Singleton Service**

**Rationale**:
- **Hook** (`use-websocket-connection`): Manages component-level lifecycle and effect cleanup via AbortController
- **Service** (`DerivWebSocketService`): Manages singleton connection at application level to prevent duplicate connections
- Hook consumes the service, allowing multiple components to share a single WebSocket connection safely

**Alternatives Considered**:
- Pure hook (no service): Would cause multiple WebSocket instances if component mounted multiple times ❌
- Pure service: Would lack proper React cleanup semantics and component lifecycle integration ❌
- Context provider: Added complexity; hybrid approach simpler and sufficient ✅

**Implementation Pattern**:
```typescript
// Service: Singleton connection manager
const DerivWebSocketService = {
  connection: WebSocket | null,
  state: ConnectionState,
  messageQueue: MessageQueue,
  getOrCreateConnection(): WebSocket
  cleanupConnection(): void
}

// Hook: Component-level lifecycle integration
function useWebSocketConnection(config: WebSocketConfig) {
  const abortController = useRef(new AbortController())
  
  useEffect(() => {
    const socket = DerivWebSocketService.getOrCreateConnection()
    setupHandlers(socket, abortController.signal)
    return () => {
      abortController.abort() // Cancel all pending timers
      DerivWebSocketService.cleanupConnection()
    }
  }, [])
}
```

---

### 2. Connection State Machine

**Decision**: **5-State Finite State Machine (FSM)**

**State Definitions**:
```typescript
enum ConnectionState {
  IDLE        = 0,         // Initial state, no connection attempt
  CONNECTING  = 1,         // Connection attempt in progress
  CONNECTED   = 2,         // Connected and authorized
  RECONNECTING = 3,        // Attempting to restore broken connection
  DISCONNECTED = 4         // Permanently closed or component unmounted
}
```

**State Transitions**:
```
IDLE → CONNECTING
  trigger: useEffect on component mount
  guard: No existing connection
  action: Create WebSocket, set 5s timeout

CONNECTING → CONNECTED
  trigger: onopen event fires + authorization succeeds
  guard: readyState === OPEN && authorized
  action: Start keep-alive ping, enable message send

CONNECTING → RECONNECTING
  trigger: onopen event + authorization fails OR 5s timeout expires
  guard: readyState !== OPEN || auth error
  action: Close socket, start backoff timer

CONNECTED → CONNECTED
  trigger: onmessage event (ping/pong, price updates)
  guard: None (maintain state)
  action: Process message, update UI

CONNECTED → RECONNECTING
  trigger: onerror event OR onclose event (Code 1006)
  guard: Not manually disconnected
  action: Close socket, start backoff timer

RECONNECTING → CONNECTING
  trigger: Backoff timer expires
  guard: reconnectAttempts < maxAttempts (6)
  action: Create new WebSocket, increment attempts

RECONNECTING → DISCONNECTED
  trigger: Component unmount signal OR maxAttempts exceeded
  guard: abortSignal.aborted OR attempts === 6
  action: Cancel all timers, cleanup resources

CONNECTED/CONNECTING/RECONNECTING → DISCONNECTED
  trigger: Component unmounts (cleanup phase)
  guard: useEffect cleanup fires
  action: AbortController.abort(), cancel all timers

DISCONNECTED → (no outgoing transitions)
  Permanent end state for this component instance
```

**Rationale**:
- Clear, testable transitions
- Guards prevent invalid state combinations
- Matches real WebSocket lifecycle
- Supports exponential backoff in RECONNECTING state

---

### 3. Exponential Backoff Algorithm

**Decision**: **Binary Exponential Backoff with Maximum Threshold**

**Algorithm**:
```typescript
function calculateBackoffDelay(attempt: number): number {
  // attempt is 1-indexed (attempt 1, attempt 2, etc.)
  const baseDelay = 3000  // 3 seconds
  const maxDelay = 30000  // 30 seconds (Deriv keep-alive interval)
  
  // Calculate: 3s, 6s, 12s, 24s, 30s, 30s, 30s...
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
  
  return Math.min(exponentialDelay, maxDelay)
}

// Examples:
calculateBackoffDelay(1) // 3,000ms   (3s)
calculateBackoffDelay(2) // 6,000ms   (6s)
calculateBackoffDelay(3) // 12,000ms  (12s)
calculateBackoffDelay(4) // 24,000ms  (24s)
calculateBackoffDelay(5) // 30,000ms  (30s - capped at max)
calculateBackoffDelay(6) // 30,000ms  (30s - capped at max)
```

**Rationale**:
- Respects Deriv's 2-minute timeout window (max backoff 30s with 6 attempts = ~90 seconds)
- Prevents hammering Deriv API with rapid reconnection attempts
- Exponential curve avoids linear retry fatigue
- 30-second cap aligns with keep-alive ping interval

**Alternatives Considered**:
- Linear backoff (1s, 2s, 3s, ...): Hits 2-minute timeout too quickly ❌
- Fixed delay (3s): Doesn't handle sustained outages well ❌
- Random jitter: Complicates testing; not needed for single user app ❌

---

### 4. Message Queuing Strategy

**Decision**: **Ring Buffer Queue with Timestamp-Based Ordering**

**Queue Design**:
```typescript
interface MessageQueue {
  items: Array<{ message: any, timestamp: number }>,
  maxSize: 100,
  add(msg: any): void,
  getAll(): any[],
  clear(): void
}

function add(msg: any) {
  const queuedMsg = { message: msg, timestamp: Date.now() }
  
  if (items.length >= maxSize) {
    // Remove oldest (FIFO)
    items.shift()
  }
  
  items.push(queuedMsg)
}

function replayOnReconnect() {
  // Replay in order (FIFO)
  const toSend = [...items]
  items.clear()
  
  for (const { message } of toSend) {
    socket.send(JSON.stringify(message))
  }
}
```

**Rationale**:
- Max 100 messages balances memory (~50KB per message avg) vs data loss risk
- FIFO ordering maintains causal consistency
- Timestamp allows for debugging/monitoring of message age
- Clears immediately after reconnect to avoid duplicate sends

**Alternatives Considered**:
- No queue: Data loss during disconnection ❌
- Unlimited queue: Memory exhaustion risk ❌
- Last-value queue (keep only latest): Not suitable for ordered trades ❌

---

### 5. Keep-Alive Ping Mechanism

**Decision**: **30-Second Interval with Simple Ping Message**

**Ping Protocol**:
```typescript
// Every 30 seconds:
socket.send(JSON.stringify({ ping: 1 }))

// Server response:
{ msg_type: 'ping' }
```

**Implementation**:
```typescript
const keepAliveInterval = setInterval(() => {
  if (connectionState === CONNECTED) {
    socket.send(JSON.stringify({ ping: 1 }))
    console.log('[INFO] Keep-alive ping sent')
  }
}, 30000) // 30 seconds

// Cancel on unmount via AbortController
abortController.signal.addEventListener('abort', () => {
  clearInterval(keepAliveInterval)
})
```

**Rationale**:
- Deriv API closes connections after 2 minutes of inactivity
- 30-second interval provides safety margin (3 pings minimum before timeout)
- Simple stateless message (no response tracking needed)
- Consistent with Deriv's official keep-connection-live documentation

**Timing Analysis**:
- Without keep-alive: Connection dies at 120s of inactivity
- With 30s pings: Latest activity marker updated every 30s
- Actual connection lifetime: 120s + continuous pings = indefinite ✅

---

### 6. Authorization & Error Recovery

**Decision**: **Per-Connection Authorization with Retry-on-Failure Logic**

**Authorization Flow**:
```
Connection Established (onopen)
    ↓
Send: { authorize: '[token]' }
    ↓
Timeout 5s
    ↓
   ↙                ↘
Success             Timeout/Error
    ↓                ↓
CONNECTED       RECONNECTING
                 (exponential backoff)
```

**Error Handling**:
```typescript
if (data.error) {
  // Terminal errors: Pause reconnection, log for manual intervention
  if (TERMINAL_ERRORS.includes(data.error.code)) {
    console.error('[ERROR] Terminal auth error:', data.error)
    // Don't retry automatically for token expiry, invalid token, etc.
    state = DISCONNECTED
  }
  
  // Transient errors: Trigger normal reconnection
  else {
    console.warn('[WARN] Transient error, will retry:', data.error)
    state = RECONNECTING
    scheduleReconnection()
  }
}
```

**Rationale**:
- Authorization must succeed before enabling message send
- Errors distinguished: terminal (don't retry) vs transient (do retry)
- 5-second timeout prevents hanging connections
- Aligns with TickBasedDisplay's existing auth patterns

---

### 7. Resource Cleanup Strategy

**Decision**: **AbortController-Based Cleanup with Cascade Cancellation**

**Cleanup Mechanism**:
```typescript
const abortController = useRef(new AbortController())

useEffect(() => {
  const signal = abortController.current.signal
  
  // Cancel all pending timers
  const keepAliveTimerId = setInterval(...)
  const reconnectTimerId = setTimeout(...)
  
  signal.addEventListener('abort', () => {
    clearInterval(keepAliveTimerId)
    clearTimeout(reconnectTimerId)
    socket.close()
  })
  
  return () => {
    abortController.current.abort() // Triggers cascade cleanup
  }
}, [])
```

**Cleanup Sequence**:
1. Component unmounts → useEffect cleanup fires
2. `abortController.abort()` → signal changes to aborted
3. All abort listeners fire immediately
4. Timers cleared, socket closed, resources released
5. No orphaned timers or pending operations remain

**Rationale**:
- AbortController is native React lifecycle pattern (React 18+)
- Cascade cleanup prevents orphaned operations
- Clean separation of concerns (timers, sockets, state)
- Testable and observable

---

### 8. Logging Strategy

**Decision**: **Two-Tier Logging: INFO (user-facing) + DEBUG (developer)**

**INFO Level - Connection Lifecycle**:
```
[TickBasedDisplay] ✓ WebSocket connected
[TickBasedDisplay] ✓ Authorization successful
[TickBasedDisplay] ✓ Keep-alive ping sent (attempt 1)
[TickBasedDisplay] ✗ WebSocket closed: Code 1006, will reconnect in 3000ms
[TickBasedDisplay] ↻ Reconnection attempt 1/6
[TickBasedDisplay] ✓ Reconnected successfully
[TickBasedDisplay] ✗ Max reconnection attempts (6) reached
[TickBasedDisplay] 🛑 Component unmounting, cancelling all pending operations
```

**DEBUG Level - Protocol Details**:
```
[TickBasedDisplay:DEBUG] WebSocket state: IDLE → CONNECTING
[TickBasedDisplay:DEBUG] Sent: { authorize: '***' }
[TickBasedDisplay:DEBUG] Received: { msg_type: 'authorize', status: 'ok' }
[TickBasedDisplay:DEBUG] Message queue length: 3
[TickBasedDisplay:DEBUG] Replaying 3 queued messages...
[TickBasedDisplay:DEBUG] Backoff calculation: attempt 2 = 6000ms
[TickBasedDisplay:DEBUG] Connection timeout triggered (5s elapsed)
```

**Rationale**:
- INFO level provides operational visibility without noise
- DEBUG level enables deep troubleshooting
- Consistent prefixes allow filtering
- Timestamps and state changes aid debugging

---

## Type System Definitions

### Core Types

```typescript
// Connection state machine
enum ConnectionState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED'
}

// Configuration
interface WebSocketConfig {
  url: string,
  token: string,
  maxReconnectAttempts: number, // default: 6
  baseBackoffMs: number,        // default: 3000
  maxBackoffMs: number,         // default: 30000
  keepAliveIntervalMs: number,  // default: 30000
  connectionTimeoutMs: number   // default: 5000
}

// Message queue entry
interface QueuedMessage {
  message: Record<string, any>,
  timestamp: number,
  attempt?: number
}

// Hook return value
interface WebSocketConnectionState {
  state: ConnectionState,
  isConnected: boolean,
  error?: Error,
  messageCount: number,
  reconnectAttempt: number,
  lastMessageTime?: number
}

// Event handlers
type MessageHandler = (data: any) => void
type ErrorHandler = (error: Error) => void
type StateChangeHandler = (newState: ConnectionState) => void
```

---

## Integration Points

### TickBasedDisplay Component Integration

**Current State** (problematic):
```typescript
// Manages its own WebSocket directly in component
useEffect(() => {
  const socket = new WebSocket(url)
  // No keep-alive, no proper cleanup
}, [])
```

**New State** (with hook):
```typescript
// Uses the hook, offloads lifecycle management
const {
  state,
  isConnected,
  error,
  messageCount
} = useWebSocketConnection({
  url: 'wss://ws.derivws.com/websockets/v3?app_id=...',
  token: apiToken,
  maxReconnectAttempts: 6,
  baseBackoffMs: 3000
})

// Component can now:
// - React to connection state changes
// - Display connection status
// - Handle errors gracefully
// - No worry about cleanup or timers
```

---

## Testing Strategy

### Unit Tests (use-websocket-connection hook)

```typescript
describe('useWebSocketConnection', () => {
  // State machine tests
  test('transitions from IDLE to CONNECTING on mount')
  test('transitions to CONNECTED after onopen + auth success')
  test('transitions to RECONNECTING on Code 1006')
  test('respects max reconnection attempts')
  
  // Keep-alive tests
  test('sends ping every 30 seconds when connected')
  test('cancels ping on unmount')
  
  // Message queue tests
  test('queues messages during disconnection')
  test('replays messages in order on reconnection')
  test('maintains max queue size of 100')
  
  // Cleanup tests
  test('cancels all timers on unmount')
  test('closes socket on unmount')
  test('no orphaned operations after unmount')
})
```

### Integration Tests

```typescript
describe('WebSocket Connection - End-to-End', () => {
  // Real WebSocket tests (using mock server)
  test('10-minute connection stability without errors')
  test('3-6 second recovery on network interruption')
  test('graceful handling of Code 1006 errors')
  test('no data loss or duplication on reconnection')
})
```

---

## Dependencies & Compatibility

### Technology Stack

| Technology | Version | Reason |
|-----------|---------|--------|
| TypeScript | 5.x | Strict type safety for connection state |
| React | 18+ | AbortController, proper cleanup semantics |
| Next.js | 15+ | SSR-safe, API route support |
| Browser WebSocket API | Native | No external package needed |

### Browser Compatibility

- ✅ Chrome 43+
- ✅ Firefox 11+
- ✅ Safari 10.1+
- ✅ Edge (all versions)
- ✅ iOS Safari 11+
- ✅ Android Chrome

---

## Risk Assessment & Mitigation

### Risk 1: Multiple Simultaneous Connection Attempts

**Risk**: If component mounts multiple times, multiple WebSockets created

**Mitigation**: Singleton service pattern with reference counting

### Risk 2: Token Expiration During Session

**Risk**: Authorization fails after reconnection

**Mitigation**: Terminal error detection; application can request fresh token via context

### Risk 3: Message Queue Overflow

**Risk**: If disconnected for very long time, queue fills up

**Mitigation**: Max 100 items with FIFO eviction; monitoring in DEBUG logs

### Risk 4: Exponential Backoff Timeout

**Risk**: After 6 attempts (~90 seconds), connection stops retrying

**Mitigation**: By design; prevents infinite retry loops; UI can display "Reconnect?" button

---

## Next Steps

**Phase 1 Output Will Include**:
1. ✅ `data-model.md` - Entity definitions with validation rules
2. ✅ `contracts/use-websocket-connection.ts` - Hook API TypeScript contract
3. ✅ `quickstart.md` - Integration guide with code examples
4. ✅ Updated `plan.md` with Phase 1 completion

**Phase 2** (via `/speckit.tasks`):
- Granular implementation tasks
- Effort estimates
- Test-first task ordering

---

**Research Phase Status**: ✅ COMPLETE  
**All Design Decisions Documented**: ✅ YES  
**Ready for Phase 1 (Data Model & Contracts)**: ✅ YES
