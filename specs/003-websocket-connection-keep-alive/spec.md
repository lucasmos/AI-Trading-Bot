# Feature Specification: WebSocket Connection Keep-Alive for TickBasedDisplay

**Feature Branch**: `003-websocket-connection-keep-alive`  
**Created**: 2025-10-23  
**Status**: Draft  
**Input**: User description: Fix WebSocket disconnections (Code 1006) on TickBasedDisplay by implementing proper connection lifecycle management, 30-second keep-alive pings, graceful error handling, and AbortController cleanup following Deriv API best practices

## User Scenarios & Testing

### User Story 1 - Real-Time Price Updates Without Interruption (Priority: P1)

Users on the Volatility Trading page monitor live price feeds via the TickBasedDisplay component. Currently, WebSocket connections drop unexpectedly (Code 1006 errors), causing price updates to freeze and trades to become unexecutable. This feature ensures users receive continuous, uninterrupted real-time price data for the duration of their trading session.

**Why this priority**: Direct impact on core trading functionality. Without stable WebSocket connections, users cannot execute trades effectively. This is a critical blocker for trading.

**Independent Test**: Can be tested by (1) navigating to Volatility Trading page, (2) enabling TickBasedDisplay with active trades, (3) monitoring browser console for Code 1006 errors, (4) verifying live price updates persist continuously for minimum 10 minutes of active trading without disconnections

**Acceptance Scenarios**:

1. **Given** TickBasedDisplay is active with WebSocket connected and trading running, **When** prices are being streamed from Deriv API, **Then** no Code 1006 errors appear in console and price feed remains active
2. **Given** Deriv API sends price updates, **When** TickBasedDisplay receives them, **Then** prices are displayed immediately without delays caused by connection issues
3. **Given** user actively trades on Volatility page for 10+ minutes, **When** monitoring the connection, **Then** WebSocket maintains connection stability without unexpected disconnections

---

### User Story 2 - Graceful Recovery from Network Failures (Priority: P1)

Temporary network fluctuations (packet loss, latency spikes) currently cause permanent WebSocket disconnections. This feature implements automatic reconnection with proper backoff timing, allowing the system to recover gracefully from transient network issues without user intervention.

**Why this priority**: Trading platforms must handle real-world network conditions. Graceful recovery is essential for user retention and trust. Failure to recover means users lose trading capability.

**Independent Test**: Can be tested by (1) simulating network issues via Chrome DevTools throttling, (2) triggering temporary connection loss, (3) verifying automatic reconnection occurs within expected timeframe, (4) confirming no data loss or duplication after recovery, (5) validating price feed resumes without gaps

**Acceptance Scenarios**:

1. **Given** WebSocket connection is active, **When** network experiences brief interruption (simulated), **Then** connection automatically reconnects within 3-6 seconds without user action
2. **Given** reconnection occurs, **When** Deriv API updates arrive, **Then** all updates are processed without duplicates or gaps
3. **Given** component is monitoring active trades during network recovery, **When** connection is restored, **Then** trade status remains accurate and consistent

---

### User Story 3 - Keep-Alive Mechanism Prevents Server Timeouts (Priority: P1)

Deriv API closes idle WebSocket connections after 2 minutes without activity. This feature implements 30-second keep-alive pings (matching Deriv documentation) to maintain connection viability during periods of low market activity or when user temporarily stops trading.

**Why this priority**: Without keep-alive pings, idle connections will be silently closed by Deriv servers, forcing reconnections and potential data loss when users resume trading.

**Independent Test**: Can be tested by (1) establishing WebSocket connection, (2) disabling market subscriptions to simulate inactivity, (3) monitoring ping messages sent every 30 seconds, (4) verifying server accepts pings and connection remains open beyond 2-minute timeout threshold, (5) confirming no unexpected disconnections occur during inactivity

**Acceptance Scenarios**:

1. **Given** WebSocket connection established, **When** no trading activity occurs for 2+ minutes, **Then** keep-alive pings are sent every 30 seconds
2. **Given** pings are being sent regularly, **When** monitoring Deriv API responses, **Then** server acknowledges pings and connection status remains valid
3. **Given** keep-alive pings active for extended period, **When** user resumes trading, **Then** connection is immediately ready without requiring reconnection

---

### User Story 4 - Clean Component Unmount Prevents Orphaned Connections (Priority: P2)

Users navigating away from Volatility Trading page trigger component unmounting. Currently, orphaned reconnection timers continue running in the background, consuming resources and potentially causing interference with other components. This feature implements proper cleanup using AbortController to cancel all pending operations.

**Why this priority**: Orphaned connections waste resources and cause subtle bugs. While less critical than connection stability, it's important for application health and user experience when navigating between pages.

**Independent Test**: Can be tested by (1) navigating to Volatility Trading page with active TickBasedDisplay, (2) monitoring pending timers/tasks via browser DevTools, (3) navigating away from page, (4) verifying all pending reconnection attempts are immediately cancelled, (5) confirming memory is properly released and no lingering timers remain

**Acceptance Scenarios**:

1. **Given** TickBasedDisplay has pending reconnection timers, **When** component unmounts, **Then** all pending timers are immediately cancelled
2. **Given** component unmounts, **When** checking browser DevTools for pending tasks, **Then** no TickBasedDisplay-related timers or async operations remain
3. **Given** user navigates between pages multiple times, **When** monitoring memory usage, **Then** no memory leaks from orphaned connections occur

---

### Edge Cases

- **Rapid Disconnect-Reconnect Cycles**: What happens when WebSocket connects, immediately receives Code 1006, and attempts reconnection while previous reconnection is pending?
- **Multiple Component Instances**: What happens if multiple TickBasedDisplay components are mounted simultaneously, each trying to manage the same shared connection?
- **Authorization Failure During Reconnection**: How does system handle when reconnected socket successfully connects but authorization fails with specific error codes?
- **Max Reconnection Attempts**: What is the behavior when max reconnection attempts are exhausted (currently 6 attempts with exponential backoff reaching 30 seconds)?
- **Message Queue Overflow**: If connection is down for extended period, how many queued messages should be retained before oldest messages are discarded?

## Requirements

### Functional Requirements

- **FR-001**: System MUST establish WebSocket connection to Deriv API using `wss://ws.derivws.com/websockets/v3?app_id={app_id}` following Deriv documentation
- **FR-002**: System MUST send `{ping: 1}` message every 30 seconds to keep connection alive (prevents 2-minute idle timeout per Deriv API spec)
- **FR-003**: System MUST implement exponential backoff reconnection strategy: attempt 1 at 3s, attempt 2 at 6s, attempt 3 at 12s, attempt 4 at 24s, attempt 5+ at 30s
- **FR-004**: System MUST queue messages sent during disconnection and replay them once connection is restored
- **FR-005**: System MUST handle Code 1006 (abnormal closure) errors with graceful reconnection rather than crashing component
- **FR-006**: System MUST implement AbortController-based cleanup to cancel all pending timers and async operations on component unmount
- **FR-007**: System MUST prevent concurrent connection attempts by tracking connection state (IDLE, CONNECTING, CONNECTED, DISCONNECTING)
- **FR-008**: System MUST log connection lifecycle events at INFO level (connect, reconnect, ping, authorize, disconnect) for debugging
- **FR-009**: System MUST log detailed protocol interactions at DEBUG level (message send/receive, backoff calculations, state transitions)
- **FR-010**: System MUST validate all incoming messages are valid JSON before processing to prevent crashes from malformed data
- **FR-011**: System MUST implement timeout protection: if onopen event doesn't fire within 5 seconds, treat as connection failure
- **FR-012**: System MUST not attempt reconnection if component has unmounted (check against AbortController abort signal)

### Key Entities

- **WebSocketConnection**: Manages low-level WebSocket lifecycle
  - `url`: `wss://ws.derivws.com/websockets/v3?app_id={app_id}`
  - `readyState`: 0 (CONNECTING), 1 (OPEN), 2 (CLOSING), 3 (CLOSED)
  - Methods: `send()`, `close()`
  - Events: `onopen`, `onmessage`, `onerror`, `onclose`

- **ConnectionState**: Enumeration tracking component-level connection status
  - `IDLE`: Initial state, not yet connected
  - `CONNECTING`: Connection attempt in progress
  - `CONNECTED`: Successfully connected and authorized
  - `RECONNECTING`: Attempting to restore broken connection
  - `DISCONNECTED`: Permanently closed or component unmounted

- **MessageQueue**: Queue for messages sent during disconnection
  - `maxSize`: 100 messages (oldest discarded if exceeded)
  - Messages stored with timestamp
  - Replayed in order upon reconnection

- **ReconnectionConfig**: Configuration for retry logic
  - `maxAttempts`: 6
  - `baseDelayMs`: 3000
  - `maxDelayMs`: 30000
  - `backoffMultiplier`: 2

- **KeepAliveInterval**: Ping mechanism
  - `intervalMs`: 30000 (30 seconds per Deriv spec)
  - Cancellable via AbortController

## Success Criteria

### Measurable Outcomes

- **SC-001**: WebSocket connections maintain stability for minimum 10 minutes of continuous trading without Code 1006 errors
- **SC-002**: When network is interrupted, automatic reconnection occurs within 3-6 seconds (matching first retry attempt)
- **SC-003**: Keep-alive pings are sent every 30 ±2 seconds when connection is idle
- **SC-004**: Message queue maintains fidelity: 100% of queued messages are replayed upon reconnection without loss or duplication
- **SC-005**: When component unmounts, all pending reconnection timers are cancelled within 100ms
- **SC-006**: Console logs show no Code 1006 errors occurring during normal 10-minute trading session
- **SC-007**: Memory usage remains stable across 5 consecutive page navigations (no memory leaks from orphaned connections)
- **SC-008**: Authorization fails gracefully (no infinite loops) if Deriv API returns error after reconnection

## Assumptions

- Deriv API endpoint `wss://ws.derivws.com/websockets/v3` is publicly accessible and stable
- App ID is properly configured in environment variables
- Browser supports native WebSocket API
- Network has sufficient bandwidth to handle keep-alive pings every 30 seconds
- Component will unmount cleanly (not forcefully terminated)
- Deriv API will send pong response to ping messages within 5 seconds

## Dependencies

- **Deriv WebSocket API**: Version 3 (https://developers.deriv.com/docs/websockets)
- **Deriv Keep-Connection-Live Guide**: https://developers.deriv.com/docs/keep-connection-live
- **React**: useEffect, useRef, useCallback hooks
- **Browser APIs**: AbortController, native WebSocket

## Out of Scope

- UI notification system for connection status (separate feature)
- Fallback to alternative data providers if Deriv unavailable
- Persistent connection state storage across page refreshes
- Modification of Deriv API client library itself
