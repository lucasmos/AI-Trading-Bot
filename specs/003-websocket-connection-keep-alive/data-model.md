# Phase 1: Data Model & Entity Definitions
## WebSocket Connection Keep-Alive

**Date**: 2025-10-23  
**Focus**: Define domain entities, validation rules, state transitions, and data contracts

---

## Domain Entities

### 1. ConnectionState (Enumeration)

**Definition**: Represents the lifecycle state of the WebSocket connection

```typescript
enum ConnectionState {
  IDLE = 'IDLE',              // No connection attempt started
  CONNECTING = 'CONNECTING',  // Connection in progress, awaiting onopen
  CONNECTED = 'CONNECTED',    // Connected, authorized, ready for messages
  RECONNECTING = 'RECONNECTING', // Previous connection lost, retry in progress
  DISCONNECTED = 'DISCONNECTED'  // Permanently closed (component unmounted or max attempts exceeded)
}
```

**Validation Rules**:
- ✅ Only valid outgoing transitions defined in research.md FSM
- ✅ No transitions back from DISCONNECTED (terminal state)
- ✅ IDLE is initial state on component mount
- ✅ CONNECTED is only state where messages can be sent

**State Metadata**:
```typescript
interface ConnectionStateMetadata {
  state: ConnectionState,
  enteredAt: number,          // Timestamp when state entered (ms)
  lastMessageAt?: number,     // Last message sent/received in CONNECTED state
  lastErrorAt?: number,       // Last error that triggered transition
  reconnectAttempt?: number   // Current attempt count (1-6) in RECONNECTING state
}
```

---

### 2. ConnectionConfig (Configuration)

**Definition**: Immutable configuration passed to hook on mount

```typescript
interface WebSocketConfig {
  // Required
  url: string,                    // wss://ws.derivws.com/websockets/v3?app_id=...
  token: string,                  // Authorization token
  
  // Optional with defaults
  maxReconnectAttempts?: number,  // Default: 6 (max retry attempts before giving up)
  baseBackoffMs?: number,         // Default: 3000 (3 seconds base exponential backoff)
  maxBackoffMs?: number,          // Default: 30000 (30 seconds, aligns with keep-alive)
  keepAliveIntervalMs?: number,   // Default: 30000 (30 seconds, per Deriv spec)
  connectionTimeoutMs?: number,   // Default: 5000 (5 seconds before giving up on connect)
  onStateChange?: (state: ConnectionState) => void,  // Optional callback
  onError?: (error: Error) => void                    // Optional callback
}
```

**Validation**:
```typescript
function validateConfig(config: WebSocketConfig): string[] {
  const errors: string[] = []
  
  // URL must be wss protocol
  if (!config.url.startsWith('wss://')) {
    errors.push('URL must use wss:// protocol')
  }
  
  // Token must be non-empty string
  if (!config.token || typeof config.token !== 'string') {
    errors.push('Token must be non-empty string')
  }
  
  // Timing constraints
  if (config.maxReconnectAttempts !== undefined && config.maxReconnectAttempts < 1) {
    errors.push('maxReconnectAttempts must be >= 1')
  }
  
  if (config.baseBackoffMs !== undefined && config.baseBackoffMs < 1000) {
    errors.push('baseBackoffMs must be >= 1000')
  }
  
  if (config.maxBackoffMs !== undefined && config.maxBackoffMs < config.baseBackoffMs) {
    errors.push('maxBackoffMs must be >= baseBackoffMs')
  }
  
  if (config.keepAliveIntervalMs !== undefined && config.keepAliveIntervalMs < 5000) {
    errors.push('keepAliveIntervalMs must be >= 5000 (Deriv requires frequent pings)')
  }
  
  return errors
}
```

**Usage**:
```typescript
// Minimal config
useWebSocketConnection({
  url: 'wss://ws.derivws.com/websockets/v3?app_id=12345',
  token: 'user-api-token'
})

// Full config
useWebSocketConnection({
  url: 'wss://ws.derivws.com/websockets/v3?app_id=12345',
  token: 'user-api-token',
  maxReconnectAttempts: 6,
  baseBackoffMs: 3000,
  maxBackoffMs: 30000,
  keepAliveIntervalMs: 30000,
  connectionTimeoutMs: 5000,
  onStateChange: (state) => console.log('State:', state),
  onError: (error) => console.error('Error:', error)
})
```

---

### 3. QueuedMessage (Message Queue Entry)

**Definition**: Stores messages that cannot be sent due to disconnection

```typescript
interface QueuedMessage {
  message: Record<string, any>,     // The actual message payload
  timestamp: number,                // When enqueued (Date.now())
  attempt?: number                  // Replay attempt count (for monitoring)
}
```

**Message Queue Container**:
```typescript
class MessageQueue {
  private items: QueuedMessage[] = []
  private readonly MAX_SIZE = 100
  
  add(message: Record<string, any>): void {
    // Trim if needed (FIFO eviction)
    if (this.items.length >= this.MAX_SIZE) {
      const evicted = this.items.shift()
      console.warn('[WARN] Message queue at capacity, evicting oldest:', evicted)
    }
    
    this.items.push({
      message,
      timestamp: Date.now()
    })
  }
  
  getAll(): QueuedMessage[] {
    return [...this.items]  // Return copy to prevent external mutations
  }
  
  clear(): void {
    this.items = []
  }
  
  size(): number {
    return this.items.length
  }
  
  isEmpty(): boolean {
    return this.items.length === 0
  }
}
```

**Validation Rules**:
- ✅ Max 100 items to prevent memory exhaustion (~50KB average message = ~5MB max queue)
- ✅ FIFO ordering (oldest sent first on reconnection)
- ✅ Timestamps enable age monitoring and cleanup
- ✅ Queue cleared immediately after successful replay to prevent duplicates

**Memory Budget**:
```
Worst case:
- 100 messages × 50KB average = 5MB
- Plus hook state overhead: ~500KB
- Total per component instance: ~5.5MB
- Acceptable for desktop/mobile with typical memory availability
```

---

### 4. KeepAliveConfig (Keep-Alive Parameters)

**Definition**: Encapsulates keep-alive ping behavior

```typescript
interface KeepAliveConfig {
  intervalMs: number,              // How often to ping (default: 30000)
  timeoutMs: number,               // Max wait for pong before reconnect (not used in v1)
  message: Record<string, any>     // Message to send (default: { ping: 1 })
}

// Default configuration
const DEFAULT_KEEP_ALIVE: KeepAliveConfig = {
  intervalMs: 30000,               // 30 seconds (Deriv spec)
  timeoutMs: 5000,                 // Grace period (unused in v1)
  message: { ping: 1 }
}
```

**Implementation**:
```typescript
class KeepAliveTimer {
  private timerId?: NodeJS.Timeout
  private readonly config: KeepAliveConfig
  private lastPingAt: number = 0
  
  constructor(config: KeepAliveConfig) {
    this.config = config
  }
  
  start(onPing: () => void): void {
    if (this.timerId) return  // Already running
    
    this.timerId = setInterval(() => {
      this.lastPingAt = Date.now()
      console.log('[INFO] Keep-alive ping sent')
      onPing()
    }, this.config.intervalMs)
  }
  
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = undefined
    }
  }
  
  getLastPingAge(): number {
    return Date.now() - this.lastPingAt
  }
  
  isRunning(): boolean {
    return this.timerId !== undefined
  }
}
```

**Timing Analysis**:
- Deriv timeout: 120 seconds (2 minutes) of inactivity
- Keep-alive interval: 30 seconds
- Gap before timeout: 120s - 30s = 90 seconds (3 pings minimum) ✅
- Safety margin: Ping every 30s << 120s Deriv timeout

---

### 5. ReconnectionConfig (Backoff Strategy)

**Definition**: Encapsulates exponential backoff retry behavior

```typescript
interface ReconnectionConfig {
  maxAttempts: number,             // Max retry attempts (default: 6)
  baseDelayMs: number,             // Base delay for exponential calc (default: 3000)
  maxDelayMs: number               // Cap on delay (default: 30000)
}

// Default configuration
const DEFAULT_RECONNECTION: ReconnectionConfig = {
  maxAttempts: 6,                  // Stop after 6 attempts
  baseDelayMs: 3000,               // Start with 3 second delay
  maxDelayMs: 30000                // Never wait more than 30 seconds
}
```

**Backoff Calculation**:
```typescript
class ExponentialBackoff {
  private readonly config: ReconnectionConfig
  
  constructor(config: ReconnectionConfig) {
    this.config = config
  }
  
  // Calculate delay for attempt N (1-indexed)
  calculateDelay(attempt: number): number {
    // Validation
    if (attempt < 1 || attempt > this.config.maxAttempts) {
      throw new Error(`Attempt must be between 1 and ${this.config.maxAttempts}`)
    }
    
    // Exponential: baseDelay × 2^(attempt - 1)
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt - 1)
    
    // Cap at max
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs)
    
    return cappedDelay
  }
  
  // Get delay sequence for all attempts
  getDelaySequence(): number[] {
    const sequence: number[] = []
    for (let i = 1; i <= this.config.maxAttempts; i++) {
      sequence.push(this.calculateDelay(i))
    }
    return sequence
  }
  
  shouldRetry(attempt: number): boolean {
    return attempt < this.config.maxAttempts
  }
  
  shouldGiveUp(attempt: number): boolean {
    return attempt >= this.config.maxAttempts
  }
}

// Example usage:
const backoff = new ExponentialBackoff(DEFAULT_RECONNECTION)

backoff.getDelaySequence()
// [3000, 6000, 12000, 24000, 30000, 30000]

backoff.calculateDelay(1)  // 3000ms
backoff.calculateDelay(2)  // 6000ms
backoff.calculateDelay(3)  // 12000ms
backoff.calculateDelay(4)  // 24000ms
backoff.calculateDelay(5)  // 30000ms (capped)
backoff.calculateDelay(6)  // 30000ms (capped)
```

**Timing Analysis**:
```
Total retry window:
  Attempt 1: 3s (total: 3s)
  Attempt 2: 6s (total: 9s)
  Attempt 3: 12s (total: 21s)
  Attempt 4: 24s (total: 45s)
  Attempt 5: 30s (total: 75s)
  Attempt 6: 30s (total: 105s)

Within Deriv's 2-minute idle timeout: ✅ YES (105s < 120s)
```

---

### 6. ConnectionSnapshot (State Export)

**Definition**: Point-in-time snapshot of connection state for consumer components

```typescript
interface ConnectionSnapshot {
  // Identity
  id: string,                      // Unique connection instance ID
  
  // State
  state: ConnectionState,
  isConnected: boolean,            // Convenience: state === CONNECTED
  isConnecting: boolean,           // Convenience: state === CONNECTING || RECONNECTING
  
  // Timing
  uptime: number,                  // Milliseconds since entering CONNECTED state
  lastMessageTime?: number,        // Timestamp of last message (either direction)
  lastErrorTime?: number,          // Timestamp of last error
  
  // Reconnection
  reconnectAttempt: number,        // Current attempt number (1-6)
  nextRetryIn?: number,            // Milliseconds until next retry (only in RECONNECTING)
  
  // Statistics
  messagesSent: number,            // Total messages sent
  messagesQueued: number,          // Currently queued (waiting to send)
  errorCount: number,              // Total errors encountered
  disconnectCount: number,         // Total disconnect events
  
  // Error details
  lastError?: {
    code?: number,                 // WebSocket close code (e.g. 1006)
    message: string,
    timestamp: number
  }
}
```

**Usage in Components**:
```typescript
function TickBasedDisplay() {
  const snapshot = useWebSocketConnection({
    url: '...',
    token: '...'
  })
  
  return (
    <div>
      {snapshot.isConnected && <StatusGreen>Connected</StatusGreen>}
      {snapshot.isConnecting && <StatusYellow>Connecting...</StatusYellow>}
      {!snapshot.isConnected && !snapshot.isConnecting && (
        <StatusRed>Disconnected (attempt {snapshot.reconnectAttempt}/6)</StatusRed>
      )}
      
      {snapshot.lastError && (
        <ErrorMessage>{snapshot.lastError.message}</ErrorMessage>
      )}
      
      <Debug>
        Uptime: {(snapshot.uptime / 1000).toFixed(1)}s
        Queued: {snapshot.messagesQueued}
      </Debug>
    </div>
  )
}
```

---

## State Transition Matrix

### Valid Transitions

| From | To | Trigger | Guard | Action |
|------|----|---------|----|--------|
| IDLE | CONNECTING | useEffect mount | None | Create WebSocket, set 5s timeout |
| CONNECTING | CONNECTED | onopen + auth success | readyState === OPEN | Enable message send, start keep-alive |
| CONNECTING | RECONNECTING | onopen + auth fail OR timeout | readyState !== OPEN OR auth error | Close socket, start backoff |
| CONNECTED | CONNECTED | onmessage | Any message | Process, update timestamp |
| CONNECTED | RECONNECTING | onerror/onclose Code 1006 | Not manually disconnected | Close socket, increment attempt |
| RECONNECTING | CONNECTING | backoff timer expires | attempt < 6 | Create new WebSocket |
| RECONNECTING | DISCONNECTED | max attempts reached OR abort signal | attempt === 6 OR abort fired | Cancel timers, cleanup |
| CONNECTED → DISCONNECTED | useEffect cleanup | abortSignal.aborted | None | AbortController.abort() cascade |
| CONNECTING → DISCONNECTED | useEffect cleanup | abortSignal.aborted | None | AbortController.abort() cascade |

### Invalid Transitions (Prevented by Guard Logic)

- ❌ IDLE → CONNECTED (must pass through CONNECTING)
- ❌ DISCONNECTED → * (terminal state)
- ❌ RECONNECTING → CONNECTED (must pass through CONNECTING first)
- ❌ CONNECTING → RECONNECTING without successful connection

---

## Validation Rules & Constraints

### Message Validation

```typescript
interface MessageValidation {
  maxSizeBytes: number,            // Default: 1MB (per Deriv spec)
  requiredFields: string[],        // Fields that must be present
  forbiddenFields: string[]        // Fields not allowed
}

function validateMessage(msg: any, validation: MessageValidation): string[] {
  const errors: string[] = []
  
  // Check JSON serializable
  try {
    JSON.stringify(msg)
  } catch (e) {
    errors.push('Message is not JSON serializable')
  }
  
  // Check size
  const sizeBytes = new Blob([JSON.stringify(msg)]).size
  if (sizeBytes > validation.maxSizeBytes) {
    errors.push(`Message size ${sizeBytes}B exceeds limit ${validation.maxSizeBytes}B`)
  }
  
  // Check required fields
  for (const field of validation.requiredFields) {
    if (!(field in msg)) {
      errors.push(`Missing required field: ${field}`)
    }
  }
  
  // Check forbidden fields
  for (const field of validation.forbiddenFields) {
    if (field in msg) {
      errors.push(`Forbidden field present: ${field}`)
    }
  }
  
  return errors
}
```

### Connection Timing Constraints

```typescript
interface TimingConstraints {
  // Must connect within this time
  connectionTimeoutMs: number,     // 5000ms (hard limit)
  
  // Deriv API closes after this inactivity
  derivIdleTimeoutMs: number,      // 120000ms (2 minutes)
  
  // Keep-alive ping frequency
  keepAlivePingIntervalMs: number, // 30000ms (per Deriv spec)
  
  // Exponential backoff limits
  minBackoffMs: number,            // 3000ms (3 seconds)
  maxBackoffMs: number,            // 30000ms (30 seconds)
  maxBackoffMs: number             // Must be < derivIdleTimeoutMs
}

const TIMING_CONSTRAINTS: TimingConstraints = {
  connectionTimeoutMs: 5000,
  derivIdleTimeoutMs: 120000,
  keepAlivePingIntervalMs: 30000,
  minBackoffMs: 3000,
  maxBackoffMs: 30000
}

// Validate constraints
function validateTimingConstraints(constraints: TimingConstraints): string[] {
  const errors: string[] = []
  
  // Keep-alive must be less than idle timeout
  if (constraints.keepAlivePingIntervalMs >= constraints.derivIdleTimeoutMs) {
    errors.push('Keep-alive interval must be < Deriv idle timeout')
  }
  
  // Max backoff must leave room for at least 1 reconnection attempt
  if (constraints.maxBackoffMs >= constraints.derivIdleTimeoutMs) {
    errors.push('Max backoff must be < Deriv idle timeout')
  }
  
  return errors
}
```

---

## Type Safety Guarantees

### Immutability for Config

```typescript
// Config is immutable after initialization
const config: Readonly<WebSocketConfig> = {
  url: '...',
  token: '...'
}

// TypeScript prevents mutation
// config.token = 'new-token' ❌ Compile error
```

### Discriminated Union for State Events

```typescript
type ConnectionEvent =
  | { type: 'CONNECTING', timestamp: number }
  | { type: 'CONNECTED', timestamp: number }
  | { type: 'RECONNECTING', attempt: number, nextRetryIn: number }
  | { type: 'DISCONNECTED', reason: 'MAX_ATTEMPTS' | 'UNMOUNT' | 'ERROR' }
  | { type: 'MESSAGE_QUEUED', size: number }
  | { type: 'MESSAGE_SENT', count: number }

function handleEvent(event: ConnectionEvent) {
  switch (event.type) {
    case 'CONNECTING':
      console.log('Connecting at', new Date(event.timestamp))
      break
    case 'RECONNECTING':
      console.log(`Retry ${event.attempt}/6 in ${event.nextRetryIn}ms`)
      break
    // ...
  }
}
```

---

## Integration with Existing Types

### TickBasedDisplay Props

```typescript
interface TickBasedDisplayProps {
  // Existing props
  dataPoints: DataPoint[]
  onTick: (tick: Tick) => void
  
  // New WebSocket config props
  derivApiToken: string,
  derivApiAppId: string,
  onConnectionStateChange?: (state: ConnectionState) => void,
  onConnectionError?: (error: Error) => void
}
```

### Existing Auth Context Integration

```typescript
// Hook can retrieve token from existing auth context
const useWebSocketConnection = (config: Partial<WebSocketConfig>) => {
  const { authToken } = useAuthContext()
  
  const fullConfig: WebSocketConfig = {
    url: `wss://ws.derivws.com/websockets/v3?app_id=${process.env.NEXT_PUBLIC_DERIV_APP_ID}`,
    token: authToken,
    ...config
  }
  
  // ... rest of implementation
}
```

---

## Next Phase

**Phase 1 Outputs Generated**:
- ✅ `research.md` - Design decisions & patterns
- ✅ `data-model.md` - Entity definitions (THIS FILE)
- ⏳ `contracts/use-websocket-connection.ts` - Hook API contract
- ⏳ `quickstart.md` - Integration guide

**Ready for Phase 1b**: Type contracts and integration examples
