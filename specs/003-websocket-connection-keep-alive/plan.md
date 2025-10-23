# Implementation Plan: WebSocket Connection Keep-Alive for TickBasedDisplay# Implementation Plan: [FEATURE]



**Branch**: `003-websocket-connection-keep-alive` | **Date**: 2025-10-23 | **Spec**: [spec.md](./spec.md)  **Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/003-websocket-connection-keep-alive/spec.md`**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`



## Summary**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.



Fix critical WebSocket reliability issues (Code 1006 disconnections) preventing real-time price updates on the Volatility Trading page by implementing:## Summary



1. **Keep-Alive Mechanism**: 30-second pings to prevent Deriv API's 2-minute idle timeout[Extract from feature spec: primary requirement + technical approach from research]

2. **Graceful Recovery**: Exponential backoff reconnection (3s → 30s) with proper state management

3. **Resource Cleanup**: AbortController-based cancellation of pending operations## Technical Context

4. **Message Queuing**: Store/replay messages during disconnection with fidelity guarantees

5. **Comprehensive Logging**: INFO-level lifecycle events + DEBUG-level protocol details<!--

  ACTION REQUIRED: Replace the content in this section with the technical details

## Technical Context  for the project. The structure here is presented in advisory capacity to guide

  the iteration process.

**Language/Version**: TypeScript 5.x (Next.js 15, React 18)  -->

**Primary Dependencies**: React hooks (useEffect, useRef, useCallback), browser WebSocket API, AbortController  

**Storage**: In-memory message queue (max 100 items), no persistence required  **Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  

**Testing**: Jest + React Testing Library for hooks; browser integration tests for WebSocket behavior  **Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  

**Target Platform**: Browser (Chrome, Firefox, Safari, Edge) - Web application  **Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  

**Project Type**: Web frontend (Next.js/React component)  **Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  

**Performance Goals**: <100ms timer cancellation on unmount, 3-6 second recovery on network failure  **Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Constraints**: Keep memory footprint <1MB, no new npm packages (use existing stack only)  **Project Type**: [single/web/mobile - determines source structure]  

**Scale/Scope**: Single hook (~300 lines) + integration into TickBasedDisplay component**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  

## Constitution Check**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]



✅ **PASS** - All principles aligned:## Constitution Check



- ✅ **Principle I (Theme Compatibility)**: Hook is UI-agnostic; no theme dependencies*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **Principle II (Component Stability)**: Extends TickBasedDisplay non-breakingly via custom hook

- ✅ **Principle III (Type Safety)**: TypeScript strict mode, functional hook design, proper interfaces[Gates determined based on constitution file]

- ✅ **Principle IV (React Best Practices)**: Functional hook with useEffect, useRef, useCallback; proper cleanup

- ✅ **Principle V (Test-First)**: Core logic requires unit tests + integration tests for WebSocket behavior## Project Structure

- ✅ **Principle VI (Dependency Constraint)**: Uses only browser APIs + existing React packages; NO new npm packages

### Documentation (this feature)

**Gate Status**: ✅ PASSED - No violations, ready for Phase 0

```text

## Project Structurespecs/[###-feature]/

├── plan.md              # This file (/speckit.plan command output)

### Documentation (this feature)├── research.md          # Phase 0 output (/speckit.plan command)

├── data-model.md        # Phase 1 output (/speckit.plan command)

```text├── quickstart.md        # Phase 1 output (/speckit.plan command)

specs/003-websocket-connection-keep-alive/├── contracts/           # Phase 1 output (/speckit.plan command)

├── spec.md                              # Feature specification (4 user stories, 12 FR, 8 SC)└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)

├── plan.md                              # This file```

├── research.md                          # Phase 0: Design decisions & patterns (generated)

├── data-model.md                        # Phase 1: Entity definitions & state machine (generated)### Source Code (repository root)

├── quickstart.md                        # Phase 1: Integration guide (generated)<!--

├── contracts/                           # Phase 1: Hook API contract (generated)  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout

│   └── use-websocket-connection.ts  for this feature. Delete unused options and expand the chosen structure with

├── checklists/requirements.md           # Quality validation (already complete)  real paths (e.g., apps/admin, packages/something). The delivered plan must

├── README.md                            # Navigation & summary  not include Option labels.

└── CLARIFICATION_COMPLETION_REPORT.md   # Workflow documentation-->

```

```text

### Source Code (repository root)# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)

src/

```text├── models/

src/├── services/

├── hooks/├── cli/

│   ├── use-websocket-connection.ts      # Main hook implementation (NEW)└── lib/

│   ├── use-websocket-connection.test.ts # Unit tests (NEW)

│   └── [existing hooks]tests/

├── services/├── contract/

│   ├── deriv-websocket-service.ts       # Singleton connection manager (NEW)├── integration/

│   └── [existing services]└── unit/

├── types/

│   ├── websocket.ts                     # Types: ConnectionState, MessageQueue, Config (NEW)# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)

│   └── [existing types]backend/

├── components/├── src/

│   ├── trade-history/│   ├── models/

│   │   ├── tick-based-trades-display.tsx # MODIFIED: integrate use-websocket-connection│   ├── services/

│   │   └── tick-based-trades-display.test.tsx # MODIFIED: add integration tests│   └── api/

│   └── [existing components]└── tests/

└── __tests__/

    ├── integration/frontend/

    │   ├── websocket-connection.integration.test.ts # NEW: End-to-end WebSocket tests├── src/

    │   └── [existing integration tests]│   ├── components/

    └── [existing tests]│   ├── pages/

```│   └── services/

└── tests/

**Structure Decision**: Single-hook approach integrated into existing Next.js/React codebase. Uses browser native WebSocket API + React hooks. No new files in external directories needed; all changes confined to `src/` and tests.

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)

## Implementation Approachapi/

└── [same as backend above]

### Phase 0: Research & Design Decisions

ios/ or android/

**Focus**: Validate design patterns, establish connection state machine, document integration approach└── [platform-specific structure: feature modules, UI flows, platform tests]

```

**Artifacts Generated**:

- `research.md`: Design patterns for connection lifecycle, reconnection logic, message queuing**Structure Decision**: [Document the selected structure and reference the real

- Type definitions and interfaces for all entities (ConnectionState, MessageQueue, ReconnectionConfig)directories captured above]



### Phase 1: Core Contract & Integration Design## Complexity Tracking



**Focus**: Define hook API contract, data model, entity relationships, integration entry points> **Fill ONLY if Constitution Check has violations that must be justified**



**Artifacts Generated**:| Violation | Why Needed | Simpler Alternative Rejected Because |

- `data-model.md`: Complete entity definitions with validation rules and state transitions|-----------|------------|-------------------------------------|

- `contracts/use-websocket-connection.ts`: Hook API contract (parameters, return values, events)| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |

- `quickstart.md`: Step-by-step integration guide for developers| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


**Key Design Decisions to Document**:
1. Hook vs Service: When to use custom hook vs singleton service pattern
2. Connection Ownership: How TickBasedDisplay "owns" connection lifecycle
3. Message Queue Strategy: Max size, replay order, error handling
4. State Machine: Detailed transitions and guard conditions
5. Error Recovery: Exponential backoff algorithm, max attempts behavior

### Phase 2: Task Breakdown

**Executed via**: `/speckit.tasks 003-websocket-connection-keep-alive`

Will generate:
- `tasks.md`: Granular implementation tasks organized by phase and dependency
- Estimated effort for each task
- Test-first approach validation

---

## Complexity Tracking

**No Constitution Check violations** - No complexity justification needed. All work uses existing dependencies and adheres to all principles.

---

**Plan Status**: ✅ Ready for Phase 0 (research.md generation)  
**Next Command**: Generate Phase 0 research artifacts (design decisions, patterns, validation)
