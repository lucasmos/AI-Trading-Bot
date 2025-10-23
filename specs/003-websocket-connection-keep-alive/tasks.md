# Phase 2: Implementation Tasks
## WebSocket Connection Keep-Alive for TickBasedDisplay

**Spec**: [spec.md](./spec.md) | **Branch**: `003-websocket-connection-keep-alive`  
**Date**: 2025-10-23 | **Status**: Phase 2 - Task Breakdown  
**Generated From**: Spec (4 user stories), Plan (implementation approach), Research (8 design decisions), Data Model (6 entities)

---

## Quick Reference

| Metric | Value | Notes |
|--------|-------|-------|
| **Total Tasks** | 46 | Organized across 6 phases |
| **Setup Phase** | 3 tasks | Infrastructure + prerequisites |
| **Foundational Phase** | 6 tasks | Shared types, service, test setup |
| **User Story 1** | 10 tasks | Real-time price stability (P1) |
| **User Story 2** | 10 tasks | Network recovery (P1) |
| **User Story 3** | 8 tasks | Keep-alive mechanism (P1) |
| **User Story 4** | 6 tasks | Clean unmount (P2) |
| **Polish Phase** | 3 tasks | Cross-cutting concerns |
| **Parallelizable Tasks** | 18 (39%) | Marked with [P] |
| **Critical Path** | Setup → Foundational → US1 → Others | ~2 weeks implementation |
| **MVP Scope** | Phase 1 + Phase 2 + US1 (Core Hook) | ~40% of total work |

---

## Implementation Strategy

### Approach: Test-First, Hook-Centric, Incremental

1. **Setup Phase**: Create infrastructure (types, project structure)
2. **Foundational Phase**: Implement core hook logic with comprehensive tests
3. **User Story Phases**: Each story adds a feature layer (stability → recovery → keep-alive → cleanup)
4. **Polish Phase**: Cross-cutting concerns, documentation, edge cases

### Parallelization Opportunities

**Setup Phase** (all tasks sequential):
- Must complete in order: types → test setup → project structure

**Foundational Phase** (parallelizable after types):
- `T004` and `T005` (singleton service + hook scaffold) can run in parallel
- `T006` (test infrastructure) blocks story tests

**User Story Phases** (all parallelizable after foundational):
- US1, US2, US3, US4 implementation tasks can run in parallel
- Each story is independent with own test suite
- Only integration tests may require sequential execution

**Example Parallel Execution**:
```
Sequential Baseline:
  T001 → T002 → T003 → T004 → T005 → T006 
    → T007-T016 (US1) → T017-T026 (US2) → ... = ~50 hours

With Parallelization (4 engineers):
  T001 → T002 → T003 → (T004 || T005) → T006 
    → (US1 tasks || US2 tasks || US3 tasks || US4 tasks in parallel)
    → Integration/Polish (sequential) = ~20 hours
```

### MVP Scope Recommendation

**Start with**: Core Hook + US1 (Stability)
- Setup Phase (3 tasks): ~2 hours
- Foundational Phase (6 tasks): ~6 hours  
- US1 (10 tasks): ~10 hours
- **Total MVP**: ~18 hours (~1 business day)

**Then Add**: US2 (Recovery) and US3 (Keep-Alive)
- US2 (10 tasks) + US3 (8 tasks): ~15 hours
- **Extended MVP**: ~33 hours (~2 business days)

**Finally**: US4 (Cleanup) + Polish
- US4 (6 tasks) + Polish (3 tasks): ~8 hours
- **Full Feature**: ~41 hours (~2.5 business days)

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: SETUP (Sequential, 3 tasks, 2 hours)                      │
├─────────────────────────────────────────────────────────────────────┤
│ T001: Create type definitions                                       │
│   ↓                                                                  │
│ T002: Configure test infrastructure                                 │
│   ↓                                                                  │
│ T003: Create project structure & directories                        │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ↓                             ↓
┌───────────────────────────┐  ┌──────────────────────────────────┐
│ PHASE 2: FOUNDATIONAL    │  │ (Can start after T003 completes) │
│ (Sequential, 6 tasks, 6h)│  │                                  │
├───────────────────────────┤  └──────────────────────────────────┘
│ T004: Deriv service base   │
│   ↓                        │
│ T005: Hook scaffold        │
│   ↓                        │
│ T006: Test fixtures        │
│   ↓                        │
│ T007: Error handlers       │
│   ↓                        │
│ T008: Message queue impl   │
│   ↓                        │
│ T009: Logging system       │
└──────────────┬─────────────┘
               │
        ┌──────┴───────────┬──────────────┬──────────────┐
        │                  │              │              │
        ↓                  ↓              ↓              ↓
   ┌────────────┐   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ US1 PHASE  │   │ US2 PHASE  │  │ US3 PHASE  │  │ US4 PHASE  │
   │ (10 tasks) │   │ (10 tasks) │  │ (8 tasks)  │  │ (6 tasks)  │
   │ PARALLEL ✓ │   │ PARALLEL ✓ │  │ PARALLEL ✓ │  │ PARALLEL ✓ │
   │ 10 hours   │   │ 10 hours   │  │ 8 hours    │  │ 6 hours    │
   └────────────┘   └────────────┘  └────────────┘  └────────────┘
        │                │              │              │
        └────────────────┴──────────────┴──────────────┘
                       │
                       ↓
         ┌─────────────────────────────┐
         │ PHASE 6: POLISH (3 tasks)   │
         │ (Sequential, 3 hours)       │
         └─────────────────────────────┘
                       │
                       ↓
         ✅ COMPLETE FEATURE READY
```

---

## PHASE 1: SETUP & INFRASTRUCTURE

**Goal**: Establish project structure, type system, test infrastructure  
**Duration**: 2 hours (sequential)  
**Completion Criteria**: All types defined, tests runnable, project structure ready

### Setup Phase Tasks

- [ ] T001 Create type definitions file `src/types/websocket.ts`
  **Task**: Create comprehensive TypeScript interfaces and enums for WebSocket feature
  **Inputs**: data-model.md, research.md (type definitions sections)
  **Outputs**: 
    - `src/types/websocket.ts` (~150 lines)
    - Exports: `ConnectionState`, `WebSocketConfig`, `QueuedMessage`, `KeepAliveConfig`, `ReconnectionConfig`, `ConnectionSnapshot`
  **Checklist**:
    - [ ] ConnectionState enum with 5 states (IDLE, CONNECTING, CONNECTED, RECONNECTING, DISCONNECTED)
    - [ ] WebSocketConfig interface with required (url, token) and optional (maxReconnectAttempts, etc.) fields
    - [ ] QueuedMessage interface with message and timestamp
    - [ ] KeepAliveConfig interface
    - [ ] ReconnectionConfig interface (maxAttempts, baseDelayMs, maxDelayMs)
    - [ ] ConnectionSnapshot interface (16 fields for state export)
    - [ ] No "any" types (strict TypeScript)
    - [ ] All interfaces have JSDoc comments
    - [ ] Export all types (no default exports)
  **Estimated Effort**: 1 hour

- [ ] T002 Configure Jest and React Testing Library
  **Task**: Set up testing infrastructure for hooks and WebSocket integration tests
  **Inputs**: jest.config.js (existing), research.md (testing strategy)
  **Outputs**:
    - Jest configuration for hook testing
    - Test setup file with WebSocket mocks
    - React Testing Library configuration
  **Checklist**:
    - [ ] Jest configured for .tsx/.ts files
    - [ ] React Testing Library installed and configured
    - [ ] WebSocket mock available (for tests)
    - [ ] setupTests.ts created with global test fixtures
    - [ ] Can run `npm test` successfully
    - [ ] Coverage reporting configured (optional but recommended)
  **Estimated Effort**: 0.5 hours

- [ ] T003 Create project directory structure
  **Task**: Create required directories for hook, services, and tests
  **Inputs**: plan.md (project structure section)
  **Outputs**:
    - Directory tree created in src/ and __tests__/
  **Checklist**:
    - [ ] `src/hooks/` directory exists
    - [ ] `src/services/` directory exists
    - [ ] `src/types/` directory exists
    - [ ] `__tests__/integration/` directory exists
    - [ ] `__tests__/unit/` directory exists
    - [ ] README.md in each directory explaining purpose (optional)
  **Estimated Effort**: 0.5 hours

---

## PHASE 2: FOUNDATIONAL & SHARED INFRASTRUCTURE

**Goal**: Implement core service, hook scaffold, logging, message queue, error handling  
**Duration**: 6 hours (sequential foundation, enables parallel story work)  
**Completion Criteria**: All foundational pieces in place, unit tested, hook ready for feature layers

### Foundational Phase Tasks

- [ ] T004 Implement Deriv WebSocket service (singleton pattern)
  **Task**: Create singleton service managing low-level WebSocket lifecycle
  **Inputs**: research.md (Hook vs Service pattern), data-model.md (entities), contracts/use-websocket-connection.ts (reference)
  **Outputs**: 
    - `src/services/deriv-websocket-service.ts` (~150 lines)
  **Details**:
    - Manages raw WebSocket connection (CONNECTING → OPEN → CLOSED)
    - Singleton instance (one connection max)
    - Methods: `getOrCreateConnection()`, `closeConnection()`, `send()`, `addEventListener()`, `removeEventListener()`
    - Prevents duplicate connections if multiple components request
    - Handles low-level WebSocket events (onopen, onmessage, onerror, onclose)
    - Does NOT manage state machine (that's the hook's job)
  **Checklist**:
    - [ ] Singleton pattern implemented (lazy initialization)
    - [ ] getOrCreateConnection() returns existing or creates new
    - [ ] closeConnection() properly closes and nullifies
    - [ ] send(msg) delegates to socket.send()
    - [ ] Event listeners manageable (addEventListener pattern)
    - [ ] TypeScript strict mode (no any)
    - [ ] Proper error handling in constructor
  **Estimated Effort**: 1.5 hours

- [ ] T005 Create hook scaffold and main lifecycle
  **Task**: Create base `useWebSocketConnection` hook with state management and main useEffect lifecycle
  **Inputs**: contracts/use-websocket-connection.ts (full implementation), data-model.md (state machine)
  **Outputs**:
    - `src/hooks/use-websocket-connection.ts` (~400 lines, partial in this task)
  **Details**:
    - Function signature: `useWebSocketConnection(config: WebSocketConfig): UseWebSocketConnectionReturn`
    - useState for: state, error, reconnectAttempt, messagesSent, messagesQueued, errorCount, disconnectCount, uptime, lastMessageTime
    - useRef for: socket, abortController, timers, messageQueue, lifecycle timestamps
    - Main useEffect: lifecycle orchestration (IDLE → CONNECTING, keep-alive, reconnection scheduling, cleanup)
    - Helper functions: transitionState(), calculateBackoffDelay(), log.*()
    - Only lifecycle logic in this task; handlers and message logic in subsequent tasks
  **Checklist**:
    - [ ] Hook accepts WebSocketConfig parameter
    - [ ] Returns proper interface (snapshot + methods)
    - [ ] State initialized to IDLE
    - [ ] useRef for socket, abortController, timers, queues
    - [ ] Main useEffect orchestrates state transitions
    - [ ] IDLE → CONNECTING transition on mount
    - [ ] AbortController signal cleanup on unmount
    - [ ] No infinite loops in useEffect (proper dependencies)
    - [ ] transitionState() function updates state + calls config callbacks
    - [ ] calculateBackoffDelay() implements exponential backoff formula
    - [ ] log.info/warn/error/debug functions available
  **Estimated Effort**: 1.5 hours

- [ ] T006 [P] Create test infrastructure and mocks
  **Task**: Set up WebSocket mocks, test utilities, fixture builders
  **Inputs**: research.md (testing strategy), jest.config.js
  **Outputs**:
    - `__tests__/fixtures/websocket-mock.ts` - Mock WebSocket class
    - `__tests__/fixtures/builders.ts` - Config/snapshot builders
    - `__tests__/utils/test-helpers.ts` - Assertion helpers
  **Details**:
    - Mock WebSocket that mimics browser behavior (readyState, events, send)
    - Builders for creating test configs and snapshots easily
    - Helpers for triggering WebSocket events in tests (onopen, onmessage, onerror, onclose)
    - Helpers for waiting on state transitions
  **Checklist**:
    - [ ] MockWebSocket class has readyState property (0, 1, 2, 3)
    - [ ] Mock can emit events (onopen, onmessage, onerror, onclose)
    - [ ] configBuilder() creates WebSocketConfig with sensible defaults
    - [ ] snapshotBuilder() creates ConnectionSnapshot
    - [ ] Test helpers: waitFor state change, waitFor message sent, trigger event
    - [ ] Global setup replaces WebSocket with mock
  **Estimated Effort**: 1 hour

- [ ] T007 Implement message handlers (onmessage, onerror, onclose)
  **Task**: Add message handling, error handling, and close event logic to hook
  **Inputs**: contracts/use-websocket-connection.ts (handlers section), research.md (error recovery)
  **Outputs**:
    - `src/hooks/use-websocket-connection.ts` (updated with handlers)
  **Details**:
    - handleMessage(): Parse JSON, detect authorization responses, detect errors, detect pings
    - handleError(): Create error object, increment error count, trigger reconnection
    - handleClose(): Track disconnect count, detect Code 1006, trigger reconnection based on state
    - All handlers update lastMessageTime when appropriate
  **Checklist**:
    - [ ] handleMessage() parses incoming JSON (with error handling)
    - [ ] Detects { msg_type: 'authorize' } responses
    - [ ] Detects { error: ... } responses and increments errorCount
    - [ ] Detects { msg_type: 'ping' } responses (keep-alive echo)
    - [ ] Transitions to RECONNECTING on error (not if already DISCONNECTED)
    - [ ] handleError() logs error, increments errorCount, triggers reconnection
    - [ ] handleClose() detects Code 1006, logs with specific message
    - [ ] All handlers avoid transitions after component unmounted
  **Estimated Effort**: 1 hour

- [ ] T008 Implement message queue (add, replay, clear)
  **Task**: Add message queuing logic to hook for storing messages during disconnection
  **Inputs**: data-model.md (MessageQueue section), research.md (message queuing strategy)
  **Outputs**:
    - Message queue implementation in hook (methods: add, getAll, clear, size)
    - Updated hook with queue integration
  **Details**:
    - Queue stored in useRef (messageQueueRef)
    - Max 100 messages (FIFO eviction)
    - add(message): Push to queue, remove oldest if at capacity
    - replayQueuedMessages(): Send all queued messages in order, clear queue
    - Queue integrated into send() method (send to socket if CONNECTED, else queue)
    - Queue replayed when entering CONNECTED state
  **Checklist**:
    - [ ] messageQueueRef initialized as empty array
    - [ ] send() checks socket.readyState; if OPEN sends directly, else queues
    - [ ] add() maintains max 100 items (FIFO eviction)
    - [ ] replayQueuedMessages() sends all in order, clears queue, logs count
    - [ ] Queue replayed in CONNECTED → CONNECTED keep-alive effect
    - [ ] messagesQueued state updated when queue changes
    - [ ] Tests verify queue max size and FIFO ordering
  **Estimated Effort**: 0.75 hours

- [ ] T009 Implement logging system (INFO + DEBUG levels)
  **Task**: Add comprehensive logging for connection lifecycle and protocol details
  **Inputs**: research.md (logging strategy section)
  **Outputs**:
    - Logging functions integrated into hook
  **Details**:
    - log.info(): User-facing lifecycle events (connection, reconnection, errors)
    - log.warn(): Warning-level events (timeouts, max attempts, etc.)
    - log.error(): Error events
    - log.debug(): Protocol details (only in development mode)
    - Consistent prefix: `[TickBasedDisplay]` for INFO/WARN/ERROR, `[TickBasedDisplay:DEBUG]` for DEBUG
    - Logs include: state transitions, pings, message sends, timeouts, errors
  **Checklist**:
    - [ ] log.info() prefixes with `[TickBasedDisplay]`
    - [ ] log.debug() prefixes with `[TickBasedDisplay:DEBUG]` and checks NODE_ENV
    - [ ] State transitions logged at DEBUG level
    - [ ] Connection/disconnection logged at INFO level
    - [ ] Errors logged at ERROR level with details
    - [ ] Keep-alive pings logged at DEBUG
    - [ ] Timeout events logged at WARN
    - [ ] All handlers use logging
    - [ ] No log spam (excessive logging filtered)
  **Estimated Effort**: 0.5 hours

---

## PHASE 3: USER STORY 1 - Real-Time Price Stability (P1)

**Goal**: Implement core WebSocket connection lifecycle ensuring stable, uninterrupted price feeds  
**Duration**: 10 hours (parallelizable after foundational)  
**Dependencies**: T001-T009 complete  
**Test Criteria**: 10-minute stability test without Code 1006 errors  
**User Story**: US1 - Real-Time Price Updates Without Interruption

### US1 Phase Tasks

- [ ] T010 [P] [US1] Create connection creation flow
  **Task**: Implement WebSocket creation with authorization timeout
  **Inputs**: research.md (FSM), data-model.md (ConnectionState)
  **Outputs**:
    - `createConnection()` function in hook
  **Details**:
    - Transition IDLE → CONNECTING
    - Create new WebSocket with Deriv URL
    - Set up event handlers (onopen, onmessage, onerror, onclose)
    - Send authorization message in onopen
    - Set 5-second connection timeout (fails if auth not received)
    - Handle timeout by transitioning to RECONNECTING
  **Checklist**:
    - [ ] createConnection() transitions state to CONNECTING
    - [ ] WebSocket created with correct Deriv URL format
    - [ ] Event handlers attached correctly
    - [ ] Authorization message sent with token
    - [ ] Connection timeout set to 5 seconds
    - [ ] Timeout clears connection and triggers reconnection
    - [ ] Already-connected check prevents duplicate connections
  **Estimated Effort**: 1 hour

- [ ] T011 [P] [US1] Implement authorization success flow
  **Task**: Handle successful authorization response and transition to CONNECTED state
  **Inputs**: research.md (authorization flow), contracts/use-websocket-connection.ts
  **Outputs**:
    - Authorization response handling in handleMessage()
  **Details**:
    - Detect { msg_type: 'authorize', status: 'ok' } response
    - Clear connection timeout timer
    - Transition to CONNECTED state
    - Enable keep-alive ping mechanism
    - Replay queued messages
    - Log authorization success
  **Checklist**:
    - [ ] handleMessage() detects authorize response
    - [ ] Connection timeout cleared on auth success
    - [ ] State transitions to CONNECTED
    - [ ] Keep-alive timer starts (or scheduled for next effect)
    - [ ] Message queue replayed immediately
    - [ ] Success logged at INFO level
  **Estimated Effort**: 0.5 hours

- [ ] T012 [P] [US1] Implement exponential backoff scheduler
  **Task**: Create reconnection scheduler with exponential backoff delays
  **Inputs**: research.md (backoff algorithm), data-model.md (ReconnectionConfig)
  **Outputs**:
    - `scheduleReconnection()` function in hook
  **Details**:
    - Calculate delay based on attempt number: baseDelay × 2^(attempt-1), capped at maxDelay
    - Sequence: 3s, 6s, 12s, 24s, 30s, 30s
    - Schedule timeout for delay amount
    - On timeout: call createConnection(), increment attempt counter
    - After max attempts (6): transition to DISCONNECTED, stop retrying
    - Log each retry with attempt number and next delay
  **Checklist**:
    - [ ] calculateBackoffDelay() returns correct sequence: [3000, 6000, 12000, 24000, 30000, 30000]
    - [ ] scheduleReconnection() uses formula: baseDelay × 2^(attempt-1)
    - [ ] Delay capped at maxBackoffMs (30s)
    - [ ] Reconnection scheduled after delay
    - [ ] Attempt counter incremented
    - [ ] Max attempts (6) respected (stops retrying after 6)
    - [ ] Logs show: "Reconnection attempt X/6, waiting Yms"
  **Estimated Effort**: 0.75 hours

- [ ] T013 [P] [US1] Implement keep-alive ping interval
  **Task**: Send keep-alive pings every 30 seconds when connected
  **Inputs**: research.md (keep-alive mechanism), data-model.md (KeepAliveConfig)
  **Outputs**:
    - `sendKeepAlivePing()` and timer management in hook
  **Details**:
    - Start interval timer every 30 seconds (only when CONNECTED)
    - Timer sends { ping: 1 } message via socket.send()
    - Stop interval when disconnecting
    - Interval must be cancellable via AbortController
    - Log each ping at DEBUG level
  **Checklist**:
    - [ ] setInterval(sendKeepAlivePing, 30000) in CONNECTED state
    - [ ] sendKeepAlivePing() checks socket.readyState === OPEN
    - [ ] Sends { ping: 1 } message
    - [ ] clearInterval when leaving CONNECTED state
    - [ ] Interval managed via AbortController
    - [ ] DEBUG log each ping sent
    - [ ] No pings sent when not CONNECTED
  **Estimated Effort**: 0.75 hours

- [ ] T014 [P] [US1] Add connection state effects (lifecycle orchestration)
  **Task**: Implement main useEffect that orchestrates state machine transitions
  **Inputs**: research.md (FSM), contracts/use-websocket-connection.ts (effects section)
  **Outputs**:
    - Main useEffect in hook with all lifecycle logic
  **Details**:
    - When state === IDLE: call createConnection()
    - When state === CONNECTED: start keep-alive timer, replay messages
    - When state === RECONNECTING: schedule reconnection
    - Cleanup: AbortController.abort() when component unmounts
    - Abort listener: cancel timers, close socket
  **Checklist**:
    - [ ] useEffect watches `state` as dependency
    - [ ] IDLE → CONNECTING transition on effect
    - [ ] CONNECTED → start keep-alive, replay queue
    - [ ] RECONNECTING → schedule next connection attempt
    - [ ] Cleanup function handles AbortController abort
    - [ ] No memory leaks (all listeners cleaned up)
    - [ ] No infinite loops (dependencies correct)
  **Estimated Effort**: 1 hour

- [ ] T015 [P] [US1] Unit tests: Connection lifecycle state transitions
  **Task**: Test IDLE → CONNECTING → CONNECTED → RECONNECTING → CONNECTED → DISCONNECTED flow
  **Inputs**: `__tests__/unit/hooks/use-websocket-connection.test.ts`
  **Outputs**:
    - `src/__tests__/unit/hooks/use-websocket-connection.state-machine.test.ts` (~100 lines)
  **Details**:
    - Test each state transition with guards
    - Verify no invalid transitions occur
    - Test timeout behavior (CONNECTING times out → RECONNECTING)
    - Test backoff sequence (1st attempt 3s, 2nd attempt 6s, etc.)
  **Checklist**:
    - [ ] Hook initializes in IDLE state
    - [ ] IDLE → CONNECTING on mount
    - [ ] CONNECTING → CONNECTED after auth success
    - [ ] CONNECTED → RECONNECTING on error
    - [ ] RECONNECTING → CONNECTING after backoff
    - [ ] Max attempts triggers DISCONNECTED
    - [ ] Unmount triggers DISCONNECTED
    - [ ] Tests use mock WebSocket and jest.useFakeTimers()
  **Estimated Effort**: 1.5 hours

- [ ] T016 [P] [US1] Unit tests: Authorization and timeout
  **Task**: Test authorization success/failure and connection timeout flows
  **Inputs**: `__tests__/unit/hooks/`
  **Outputs**:
    - Tests in existing test file
  **Checklist**:
    - [ ] Auth success (status: 'ok') → CONNECTED
    - [ ] Auth failure (error present) → RECONNECTING
    - [ ] Connection timeout after 5s → RECONNECTING
    - [ ] Connection timeout clears before auth success
  **Estimated Effort**: 1 hour

- [ ] T017 [P] [US1] Unit tests: Message sending and queuing
  **Task**: Test send() method with queuing when disconnected and replay when reconnected
  **Inputs**: `__tests__/unit/hooks/`
  **Outputs**:
    - Tests in existing test file
  **Checklist**:
    - [ ] send() when CONNECTED → sends immediately
    - [ ] send() when DISCONNECTED → queues message
    - [ ] Queue maintains max 100 items
    - [ ] Queue replayed on CONNECTED → CONNECTED
    - [ ] Queue cleared after replay
    - [ ] FIFO ordering maintained
  **Estimated Effort**: 1 hour

- [ ] T018 [P] [US1] Integration tests: 10-minute stability
  **Task**: End-to-end test of 10-minute connected stability without disconnects
  **Inputs**: `__tests__/integration/`
  **Outputs**:
    - `src/__tests__/integration/websocket-stability.test.ts` (~80 lines)
  **Details**:
    - Create hook instance
    - Simulate 10+ minutes of activity (mocked time)
    - Verify no Code 1006 errors
    - Verify keep-alive pings sent (every 30s)
    - Verify uptime counter increases
  **Checklist**:
    - [ ] Test completes 10-minute simulation
    - [ ] No disconnects occur
    - [ ] Keep-alive pings sent at 30s intervals
    - [ ] messagesSent/messagesQueued tracked correctly
    - [ ] errorCount remains 0
    - [ ] Uses jest.useFakeTimers() for time control
  **Estimated Effort**: 1 hour

- [ ] T019 [P] [US1] Integration test: Continuous price updates (mock Deriv stream)
  **Task**: Test that price update messages flow continuously from "Deriv API"
  **Inputs**: `__tests__/integration/`
  **Outputs**:
    - `src/__tests__/integration/websocket-price-stream.test.ts` (~100 lines)
  **Details**:
    - Hook receives subscription confirmation
    - Simulate price update messages every 2 seconds
    - Verify updates arrive without gaps (simulating broker streaming)
    - Verify message count matches expected (300+ messages in 10 minutes)
  **Checklist**:
    - [ ] Price updates arrive continuously
    - [ ] Updates processed without errors
    - [ ] No "message received in DISCONNECTED state" scenarios
    - [ ] Simulates realistic broker message frequency
  **Estimated Effort**: 1 hour

---

## PHASE 4: USER STORY 2 - Graceful Network Recovery (P1)

**Goal**: Implement automatic recovery from network failures without data loss  
**Duration**: 10 hours (parallelizable with US1, US3, US4)  
**Dependencies**: T001-T009 complete  
**Test Criteria**: Reconnection within 3-6 seconds, no message loss or duplication  
**User Story**: US2 - Graceful Recovery from Network Failures

### US2 Phase Tasks

- [ ] T020 [P] [US2] Code 1006 error detection and handling
  **Task**: Detect WebSocket Code 1006 (abnormal closure) and trigger appropriate recovery
  **Inputs**: research.md (error recovery), contracts/use-websocket-connection.ts (handleClose)
  **Outputs**:
    - Updated handleClose() handler in hook
  **Details**:
    - Detect code === 1006 in onclose event
    - Log specific message: "Code 1006 (abnormal closure) - will attempt to reconnect"
    - Transition to RECONNECTING (not DISCONNECTED)
    - Schedule exponential backoff reconnection
    - Distinguish from normal closure (code === 1000)
  **Checklist**:
    - [ ] handleClose() detects event.code === 1006
    - [ ] Logs warning with Code 1006 message
    - [ ] Transitions to RECONNECTING (not DISCONNECTED)
    - [ ] scheduleReconnection() called with attempt counter
    - [ ] Normal closes (code 1000) handled differently (transition to DISCONNECTED)
  **Estimated Effort**: 0.5 hours

- [ ] T021 [P] [US2] Network failure simulation capability
  **Task**: Create test utilities to simulate network failures
  **Inputs**: `__tests__/fixtures/`, research.md
  **Outputs**:
    - `__tests__/fixtures/network-simulator.ts` (~80 lines)
  **Details**:
    - triggerCode1006(): Simulate abnormal WebSocket closure
    - triggerNetworkError(): Simulate generic network error
    - triggerTimeout(): Simulate connection timeout
    - triggerAuthFailure(errorCode): Simulate auth failure
  **Checklist**:
    - [ ] Fixtures available for all error scenarios
    - [ ] Can trigger errors with specific codes
    - [ ] Can simulate timing (delays, timeouts)
  **Estimated Effort**: 0.5 hours

- [ ] T022 [P] [US2] Unit test: Code 1006 triggers reconnection
  **Task**: Test that Code 1006 errors trigger exponential backoff reconnection
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] Code 1006 detected correctly
    - [ ] State transitions to RECONNECTING
    - [ ] First reconnection attempt scheduled in 3 seconds
    - [ ] disconnect count incremented
    - [ ] Error logged appropriately
  **Estimated Effort**: 0.75 hours

- [ ] T023 [P] [US2] Unit test: Full exponential backoff sequence
  **Task**: Test complete backoff sequence (3s, 6s, 12s, 24s, 30s, 30s)
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] All 6 attempts execute with correct delays
    - [ ] Timing verified with jest.useFakeTimers()
    - [ ] After 6th attempt, transitions to DISCONNECTED
    - [ ] No infinite retry loop
  **Estimated Effort**: 1 hour

- [ ] T024 [P] [US2] Unit test: Message queue during disconnection
  **Task**: Test that messages sent during disconnection are queued and replayed
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] Send messages while in RECONNECTING state → queued
    - [ ] Queue max capacity (100) enforced
    - [ ] Oldest messages evicted if exceeded
    - [ ] Messages replayed in FIFO order on reconnection
    - [ ] No duplicates or loss (unless queue exceeded)
  **Estimated Effort**: 1 hour

- [ ] T025 [P] [US2] Unit test: No data loss on reconnection
  **Task**: Test message integrity across disconnection/reconnection cycle
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] Queue messages while disconnected
    - [ ] Reconnect and verify all messages sent in order
    - [ ] Message content unchanged
    - [ ] No message duplication
  **Estimated Effort**: 1 hour

- [ ] T026 [P] [US2] Integration test: Simulate network interruption
  **Task**: End-to-end test simulating network interruption and recovery
  **Inputs**: `__tests__/integration/`
  **Outputs**:
    - `src/__tests__/integration/websocket-network-recovery.test.ts` (~120 lines)
  **Details**:
    - Establish connection (CONNECTED)
    - Send test message (succeeds)
    - Trigger Code 1006 error (simulate network failure)
    - Verify state → RECONNECTING
    - Queue messages during recovery window
    - Advance time 3 seconds (first reconnection attempt)
    - Verify reconnection succeeds
    - Verify queued messages replayed
  **Checklist**:
    - [ ] Network interruption detected
    - [ ] Automatic recovery triggered
    - [ ] Recovery completes within 3-6 seconds
    - [ ] Messages queued during recovery
    - [ ] Messages replayed without loss/duplication
    - [ ] Test uses jest.useFakeTimers() for control
  **Estimated Effort**: 1.5 hours

- [ ] T027 [P] [US2] Integration test: Multiple network failures in sequence
  **Task**: Test resilience to repeated network failures
  **Inputs**: `__tests__/integration/`
  **Outputs**:
    - `src/__tests__/integration/websocket-recovery-sequence.test.ts` (~100 lines)
  **Details**:
    - Establish connection
    - Trigger failure #1 (Code 1006) → reconnect
    - Verify reconnection succeeds
    - Trigger failure #2 (different error) → reconnect again
    - Verify multiple recoveries work
    - After 6 failures: verify DISCONNECTED state, no further retries
  **Checklist**:
    - [ ] Multiple failures handled
    - [ ] Each failure triggers appropriate backoff
    - [ ] Max attempts (6) enforced
    - [ ] After max attempts, transitions to DISCONNECTED
    - [ ] UI can detect max attempts state and show "reconnect" button
  **Estimated Effort**: 1 hour

- [ ] T028 [US2] Integration test: Recovery under load (high message frequency)
  **Task**: Test recovery doesn't lose messages even during high message frequency
  **Inputs**: `__tests__/integration/`
  **Outputs**:
    - `src/__tests__/integration/websocket-recovery-under-load.test.ts` (~80 lines)
  **Details**:
    - Simulate high message frequency (100 messages/second from broker)
    - During disconnection window: queue as many as possible (up to 100)
    - Recovery: verify all queued messages sent, none lost
  **Checklist**:
    - [ ] High message frequency handled
    - [ ] Queue capacity respected (max 100)
    - [ ] Messages replayed efficiently
    - [ ] No buffer overflow errors
  **Estimated Effort**: 1 hour

---

## PHASE 5: USER STORY 3 - Keep-Alive Mechanism (P1)

**Goal**: Implement 30-second keep-alive pings to prevent Deriv's 2-minute idle timeout  
**Duration**: 8 hours (parallelizable with US1, US2, US4)  
**Dependencies**: T001-T009 complete  
**Test Criteria**: Pings sent every 30±2 seconds, no idle timeouts  
**User Story**: US3 - Keep-Alive Mechanism Prevents Server Timeouts

### US3 Phase Tasks

- [ ] T029 [P] [US3] Implement keep-alive ping mechanism (already done in T013)
  **Task**: Verify keep-alive timer is working and test edge cases
  **Inputs**: research.md (keep-alive mechanism), T013 (already implemented)
  **Outputs**:
    - Enhanced keep-alive with edge case handling
  **Details**:
    - Ping only when CONNECTED (not CONNECTING or RECONNECTING)
    - Stop pings when disconnected
    - Handle socket errors during ping send (don't crash, just log)
    - Track last ping time for monitoring
  **Checklist**:
    - [ ] Ping interval: exactly 30 seconds
    - [ ] Ping sent only in CONNECTED state
    - [ ] Ping stopped when disconnecting
    - [ ] Errors during ping don't crash hook
    - [ ] Last ping time tracked (for debugging)
  **Estimated Effort**: 0.5 hours

- [ ] T030 [P] [US3] Unit test: Ping interval timing
  **Task**: Test that pings are sent at correct 30-second intervals
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] First ping at t=30s
    - [ ] Second ping at t=60s
    - [ ] Third ping at t=90s
    - [ ] Pings stop immediately on DISCONNECTED
    - [ ] Uses jest.useFakeTimers() for control
  **Estimated Effort**: 0.75 hours

- [ ] T031 [P] [US3] Unit test: Ping message format
  **Task**: Test that ping messages have correct format
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] Ping message is { ping: 1 }
    - [ ] Sent as JSON string
    - [ ] Only sent when socket readyState === OPEN
  **Estimated Effort**: 0.5 hours

- [ ] T032 [P] [US3] Unit test: Idle connection stays alive
  **Task**: Test that connection survives beyond 2-minute Deriv timeout with pings
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] Simulate 3 minutes of idle (no trading activity)
    - [ ] No market data subscriptions (truly idle)
    - [ ] Pings sent: at 30s, 60s, 90s, 120s, 150s, 180s (6 pings)
    - [ ] Connection remains CONNECTED throughout
    - [ ] No timeout or disconnection occurs
  **Estimated Effort**: 1 hour

- [ ] T033 [P] [US3] Unit test: Ping error handling
  **Task**: Test that ping errors don't crash or disconnect
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] If socket.send() throws during ping, error caught and logged
    - [ ] Connection state unchanged (still CONNECTED)
    - [ ] Next ping scheduled normally
  **Estimated Effort**: 0.5 hours

- [ ] T034 [P] [US3] Integration test: Long idle connection stability
  **Task**: End-to-end test of extended idle period with keep-alive
  **Inputs**: `__tests__/integration/`
  **Outputs**:
    - `src/__tests__/integration/websocket-idle-stability.test.ts` (~100 lines)
  **Details**:
    - Establish connection (CONNECTED)
    - Simulate 5+ minutes of idle (no subscriptions, no messages from broker)
    - Verify keep-alive pings sent regularly
    - Verify server accepts pings (simulated pong responses)
    - Connection remains CONNECTED throughout
    - No unexpected disconnections occur
  **Checklist**:
    - [ ] 5-minute test completes successfully
    - [ ] Pings sent approximately every 30 seconds
    - [ ] At least 10 pings sent (5 min / 30s = 10)
    - [ ] Connection remains stable
    - [ ] errorCount remains 0
  **Estimated Effort**: 1 hour

- [ ] T035 [P] [US3] Integration test: Keep-alive survives Deriv 2-minute window
  **Task**: Specifically test that keep-alive pings prevent 2-minute timeout
  **Inputs**: `__tests__/integration/`
  **Outputs**:
    - `src/__tests__/integration/websocket-deriv-timeout-prevention.test.ts` (~80 lines)
  **Details**:
    - Establish connection
    - Track time until 2 minutes (Deriv timeout threshold)
    - Verify pings sent: 30s, 60s, 90s, 120s (4 pings before threshold)
    - After 120s: connection should still be CONNECTED
    - Without pings: connection would have been closed by Deriv
  **Checklist**:
    - [ ] Reaches 120-second mark without disconnection
    - [ ] Pings prevent timeout (verify with and without pings)
    - [ ] Timeout test shows Code 1006 without pings
    - [ ] Keep-alive test shows no errors with pings
  **Estimated Effort**: 1 hour

---

## PHASE 6: USER STORY 4 - Clean Unmount (P2)

**Goal**: Ensure proper resource cleanup when component unmounts  
**Duration**: 6 hours (parallelizable with other stories)  
**Dependencies**: T001-T009 complete  
**Test Criteria**: All timers cancelled within 100ms, no memory leaks  
**User Story**: US4 - Clean Component Unmount Prevents Orphaned Connections

### US4 Phase Tasks

- [ ] T036 [P] [US4] Implement AbortController cleanup cascade
  **Task**: Ensure all pending operations cancelled on component unmount
  **Inputs**: research.md (resource cleanup), contracts/use-websocket-connection.ts (cleanup pattern)
  **Outputs**:
    - Updated hook with comprehensive cleanup
  **Details**:
    - AbortController initialized in useRef
    - Cleanup function in main useEffect calls abortController.abort()
    - Abort listener cancels: keep-alive timer, reconnect timer, connection timeout
    - Close socket connection
    - Clear message queue
    - Update state to DISCONNECTED
  **Checklist**:
    - [ ] abortControllerRef.current used throughout hook
    - [ ] Cleanup function checks signal.aborted
    - [ ] clearInterval(keepAliveTimerRef.current)
    - [ ] clearTimeout(reconnectTimerRef.current)
    - [ ] clearTimeout(connectionTimeoutRef.current)
    - [ ] socket?.close()
    - [ ] messageQueue cleared
  **Estimated Effort**: 1 hour

- [ ] T037 [P] [US4] Unit test: Timers cancelled on unmount
  **Task**: Test that all pending timers are cancelled immediately on unmount
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] Keep-alive timer cleared
    - [ ] Reconnection timer cleared
    - [ ] Connection timeout cleared
    - [ ] No timers remain after unmount
    - [ ] Unmount triggers within component lifecycle
  **Estimated Effort**: 1 hour

- [ ] T038 [P] [US4] Unit test: Socket closed on unmount
  **Task**: Test that WebSocket is properly closed on unmount
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] socket.close() called on unmount
    - [ ] Socket set to null after closing
    - [ ] Prevents "close on closed socket" errors
  **Estimated Effort**: 0.5 hours

- [ ] T039 [P] [US4] Unit test: No pending operations after unmount
  **Task**: Test that component is fully cleaned up with no orphaned operations
  **Inputs**: `__tests__/unit/`
  **Outputs**:
    - Test in existing test file
  **Checklist**:
    - [ ] After unmount, no async operations pending
    - [ ] Message queue cleared
    - [ ] Reconnection state reset
    - [ ] Can safely remount without issues
  **Estimated Effort**: 0.75 hours

- [ ] T040 [P] [US4] Integration test: Memory stability across navigation
  **Task**: Test that multiple mount/unmount cycles don't leak memory
  **Inputs**: `__tests__/integration/`
  **Outputs**:
    - `src/__tests__/integration/websocket-memory-stability.test.ts` (~100 lines)
  **Details**:
    - Simulate user navigating to trading page (mount hook)
    - Active trading for 1 minute
    - Navigate away (unmount hook)
    - Verify memory released
    - Repeat 5 times
    - Memory usage should be stable (no leak)
  **Checklist**:
    - [ ] Mount/unmount cycle completes
    - [ ] Memory tracked before/after
    - [ ] No significant memory increase after cycles
    - [ ] Uses performance memory API or similar
  **Estimated Effort**: 1.5 hours

- [ ] T041 [P] [US4] Integration test: Cleanup prevents errors on page navigation
  **Task**: Test that navigating away mid-reconnection doesn't cause errors
  **Inputs**: `__tests__/integration/`
  **Outputs**:
    - `src/__tests__/integration/websocket-unmount-during-reconnection.test.ts` (~80 lines)
  **Details**:
    - Establish connection
    - Trigger disconnection (Code 1006)
    - Immediately unmount component (simulating user navigation)
    - Verify no errors thrown
    - Verify pending reconnection cancelled
    - Verify no dangling callbacks or timers
  **Checklist**:
    - [ ] Unmount during RECONNECTING state handled
    - [ ] Unmount during CONNECTING state handled
    - [ ] No errors thrown in console
    - [ ] Cleanup completes cleanly
  **Estimated Effort**: 1 hour

---

## PHASE 7: POLISH & CROSS-CUTTING CONCERNS

**Goal**: Integration, documentation, edge cases, production readiness  
**Duration**: 3 hours (sequential, after core features)  
**Dependencies**: T010-T041 complete  
**Test Criteria**: Full feature tested, documented, ready for production

### Polish Phase Tasks

- [ ] T042 Integrate hook into TickBasedDisplay component
  **Task**: Wire hook into actual TickBasedDisplay component
  **Inputs**: quickstart.md (integration guide), existing TickBasedDisplay component
  **Outputs**:
    - Updated `src/components/trade-history/tick-based-trades-display.tsx`
  **Details**:
    - Replace manual WebSocket code with useWebSocketConnection hook
    - Extract Deriv token from auth context
    - Display connection status UI
    - Subscribe to price ticks on connection
    - Handle price update messages
    - Show error UI on disconnection
  **Checklist**:
    - [ ] Hook imported and used in component
    - [ ] Token extracted from auth context
    - [ ] Connection status displayed (✓/✗/↻)
    - [ ] Price subscription sent when connected
    - [ ] Price updates flow to chart
    - [ ] Error messages displayed
    - [ ] Navigation away properly cleans up
  **Estimated Effort**: 1.5 hours

- [ ] T043 Create comprehensive feature documentation
  **Task**: Document hook for developers
  **Inputs**: quickstart.md (already written), research.md, data-model.md
  **Outputs**:
    - Feature documentation in README or docs/ folder
    - JSDoc in hook implementation
  **Details**:
    - Hook usage guide
    - Configuration options explained
    - Error handling patterns
    - Testing examples
    - Troubleshooting guide
  **Checklist**:
    - [ ] README updated or docs/websocket-keep-alive.md created
    - [ ] Hook function has detailed JSDoc
    - [ ] All interfaces documented
    - [ ] Examples provided
    - [ ] Links to research.md and data-model.md
  **Estimated Effort**: 1 hour

- [ ] T044 Edge case validation and error handling
  **Task**: Test edge cases and ensure robust error handling
  **Inputs**: spec.md (edge cases section), research.md (risks)
  **Outputs**:
    - Edge case test suite
  **Details**:
    - Rapid disconnect-reconnect cycles
    - Multiple component instances (should use singleton)
    - Authorization failure during reconnection
    - Queue overflow (>100 messages)
    - Socket errors during send
    - Invalid message formats
  **Checklist**:
    - [ ] All edge cases from spec.md tested
    - [ ] Graceful handling (no crashes)
    - [ ] Error messages clear and actionable
    - [ ] Recovery possible from all edge cases
    - [ ] Edge cases documented in comments
  **Estimated Effort**: 0.5 hours

---

## TASK EXECUTION CHECKLIST

### Pre-Execution Validation

- [ ] All tasks have clear file paths
- [ ] All tasks are independently executable
- [ ] Task IDs sequential (T001-T044)
- [ ] User Story labels correct ([US1], [US2], [US3], [US4])
- [ ] Parallelization markers [P] accurate
- [ ] Phase transitions clear
- [ ] Test tasks independently verifiable
- [ ] Effort estimates reasonable (total ~41 hours)

### Execution Order Recommendations

**Week 1 (Core Hook + US1)**:
- Setup Phase (T001-T003): 2 hours
- Foundational Phase (T004-T009): 6 hours
- US1 Phase (T010-T019): 10 hours
- **Week 1 Total**: ~18 hours (achievable as MVP)

**Week 2 (Recovery + Keep-Alive)**:
- US2 Phase (T020-T028): 10 hours
- US3 Phase (T029-T035): 8 hours
- **Week 2 Total**: ~18 hours

**Week 3 (Cleanup + Polish)**:
- US4 Phase (T036-T041): 6 hours
- Polish Phase (T042-T044): 3 hours
- **Week 3 Total**: ~9 hours

**Total Timeline**: ~3 weeks (full feature), or ~1 week for MVP

### Success Metrics

After completing all tasks:

- ✅ All 4 user stories implemented
- ✅ 44+ passing unit tests
- ✅ 12+ passing integration tests
- ✅ 10-minute stability test passes
- ✅ 3-6 second recovery time verified
- ✅ 30±2 second keep-alive timing verified
- ✅ 100% message fidelity verified
- ✅ Zero Code 1006 errors in normal operation
- ✅ No memory leaks across navigation cycles
- ✅ Hook integrated into TickBasedDisplay
- ✅ Full documentation complete
- ✅ Ready for production deployment

---

## Appendix: Task Dependencies

```
T001 (Types) ──────┐
                   ├──→ T002 (Jest) ──┐
T001 (Types) ──────┘                   ├──→ T003 (Structure) ──┐
                                       │                       │
                    ┌──────────────────┘                       │
                    │                                          │
                    ├──→ T004 (Service) ──┐                    │
                    │                     ├──→ T006 (Mocks) ─┐ │
                    ├──→ T005 (Hook) ─────┘                  │ │
                    │                                         │ │
                    ├──→ T007 (Handlers) ──┐                 │ │
                    │                      ├──→ Tests ──────┘ │
                    ├──→ T008 (Queue) ─────┤                  │
                    │                      │                  │
                    ├──→ T009 (Logging) ──┘                  │
                    │                                         │
                    └─ (Foundational Complete) ──────────────┘
                                                               │
                    ┌──────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┬───────────────┬──────────────┐
    │               │               │               │              │
    ↓               ↓               ↓               ↓              ↓
  US1 (10h)     US2 (10h)       US3 (8h)        US4 (6h)       (Parallel)
  T010-T019     T020-T028       T029-T035       T036-T041
    │               │               │               │              │
    └───────────────┴───────────────┴───────────────┴──────────────┘
                    │
                    ↓
              Polish Phase (3h)
              T042-T044
                    │
                    ↓
            ✅ Feature Complete
```

---

## File Generation Status

Generated: 2025-10-23  
Total Tasks: 46  
Estimated Implementation Time: 41 hours  
Recommended MVP Time: 18 hours (1 business day)  
Recommended Full Feature Time: 2.5 business days

**Next Steps**:
1. Execute tasks sequentially or in parallel per phase
2. Run tests after each task
3. Commit to branch `003-websocket-connection-keep-alive` after each phase
4. Review against spec.md success criteria
5. Deploy to production after Polish phase complete

**Status**: ✅ **READY FOR IMPLEMENTATION**

---

*Phase 2 (Task Breakdown) Complete. Generated from spec.md (4 US, 12 FR, 8 SC), plan.md (technical context), research.md (8 decisions), and data-model.md (6 entities). All tasks independently executable, testable, and aligned with constitutional principles.*
