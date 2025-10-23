# Feature Specification: Turbo & Safe Mode Risk Distribution

**Feature Branch**: `001-risk-distribution-turbo-safe`  
**Created**: 2025-10-23  
**Status**: Ready for Planning  
**Input**: User description: Implement price-based risk distribution for Turbo and Safe execution modes in Volatility Trading

## Clarifications

### Session 2025-10-23

- Q: How Are Price Tiers Selected? → A: Real-Time Bid/Ask Spread - Use current live bid/ask prices from Deriv API as the two price tiers. Tier 1 uses the best available price (bid or ask), Tier 2 uses the next price level from real-time market data. This is most practical for live trading and aligns with Volatility Trading workflow.
- Q: Definition of "Matched Prices" Within Each Tier → A: Snapshot at Tier Execution - When a tier starts executing, capture the current bid/ask price snapshot and use that exact price for ALL trades in that tier, even if market prices change during tier execution. This prevents price slippage within tiers. IMPORTANT CONTEXT: Deriv uses tick-based execution system: entry at price 1 → skip price 2 → execute at price 3 (applies to ticks 1-10 with same logic). Each tier execution will follow this tick skip pattern.
- Q: User Visibility of Trade Distribution → A: Pre-Execution Preview - Before trade execution starts, show confirmation dialog/panel displaying: "Your N trades will distribute as: [X trades at $P1] [Y trades at $P2]..." with Confirm/Cancel button. Gives users transparency and allows review before capital commitment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turbo Mode Risk Distribution (1-5 Trades) (Priority: P1)

Traders using Turbo mode with 1-5 bulk trades execute trades with equal risk split across exactly 2 ticks, where all trades at each tick execute at the same price point for that tick. This ensures consistent entry pricing within each tier while spreading risk across multiple price levels.

**Why this priority**: Core trading functionality that affects how users' capital is distributed. Turbo mode is a primary execution mode, and correct risk distribution ensures predictable trade allocation.

**Independent Test**: Can be tested by (1) setting execution mode to Turbo, (2) selecting 1-5 bulk trades, (3) initiating trade execution, and (4) verifying that trades are split equally across 2 distinct price ticks with matching prices within each tick group.

**Acceptance Scenarios**:

1. **Given** user selects Turbo mode with 1 trade, **When** trade executes, **Then** 1 trade executes at price tier 1
2. **Given** user selects Turbo mode with 2 trades, **When** trade executes, **Then** 1 trade executes at price tier 1 and 1 trade at price tier 2 (matching prices within each tier)
3. **Given** user selects Turbo mode with 3 trades, **When** trade executes, **Then** 2 trades execute at price tier 1 and 1 trade at price tier 2 (equal split with matching prices)
4. **Given** user selects Turbo mode with 5 trades, **When** trade executes, **Then** 2-3 trades execute per price tier with matched prices within each tier
5. **Given** user adjusts any setting (execution type, account type, trade type, ticks, stake), **When** Turbo mode executes, **Then** risk distribution rule still applies

---

### User Story 2 - Safe Mode Risk Distribution (1-4 Trades) (Priority: P1)

Traders using Safe mode with 1-4 bulk trades execute trades with equal risk split across exactly 2 ticks, where all trades at each tick execute at the same price point for that tick. Safe mode offers tighter distribution for conservative trading.

**Why this priority**: Core trading functionality for conservative traders. Safe mode is frequently used for risk-averse strategies, and correct implementation ensures user trust.

**Independent Test**: Can be tested by (1) setting execution mode to Safe, (2) selecting 1-4 bulk trades, (3) initiating trade execution, and (4) verifying that trades are split equally across 2 distinct price ticks with matching prices within each tick group.

**Acceptance Scenarios**:

1. **Given** user selects Safe mode with 1 trade, **When** trade executes, **Then** 1 trade executes at price tier 1
2. **Given** user selects Safe mode with 2 trades, **When** trade executes, **Then** 1 trade executes at price tier 1 and 1 trade at price tier 2 (matching prices)
3. **Given** user selects Safe mode with 3 trades, **When** trade executes, **Then** 2 trades at tier 1, 1 trade at tier 2 (matching prices within tiers)
4. **Given** user selects Safe mode with 4 trades, **When** trade executes, **Then** 2 trades at tier 1, 2 trades at tier 2 (matching prices)
5. **Given** user adjusts any setting (execution type, account type, trade type, ticks, stake), **When** Safe mode executes, **Then** risk distribution rule still applies

---

### User Story 3 - Extended Risk Distribution (5+ Trades) (Priority: P1)

Traders using either Turbo or Safe mode with 5 or more bulk trades execute trades according to the predefined distribution table in `trade-distribution.ts`, which specifies optimal risk allocation across multiple price ticks while maintaining matched prices within each tick group.

**Why this priority**: Ensures system handles bulk orders beyond the simple 2-tier distribution. Uses optimized distribution patterns for larger trade volumes.

**Independent Test**: Can be tested by (1) setting execution mode to Turbo or Safe, (2) selecting 5-100 bulk trades, (3) initiating trade execution, and (4) verifying that trades follow the distribution table with all trades in each tier matching that tier's price.

**Acceptance Scenarios**:

1. **Given** user selects Turbo/Safe mode with 6 trades, **When** trade executes, **Then** distribution matches table (e.g., [2,2,2] = 2 trades at tier 1, 2 at tier 2, 2 at tier 3) with matched prices per tier
2. **Given** user selects Turbo/Safe mode with 10 trades, **When** trade executes, **Then** distribution from table applied with all trades at each price tier matching
3. **Given** user selects Turbo/Safe mode with 50 trades, **When** trade executes, **Then** appropriate 5-tick distribution table entry used with matched prices per tier
4. **Given** trade count exceeds table maximum (100), **When** user attempts execution, **Then** system prevents execution or splits into multiple sessions

---

### Edge Cases

- What happens when user selects 0 or negative bulk trades? System should reject and prompt for valid input (1-100)
- What happens when trade count falls between defined table entries? Should use nearest valid distribution or round appropriately
- What happens when user changes execution mode mid-session (Turbo ↔ Safe)? New distribution rules apply to subsequent trades
- How does system handle fractional trade allocations (e.g., 5 trades across 3 ticks)? Remainder trades allocated to earliest or final ticks consistently

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST distribute 1-5 Turbo mode trades equally across exactly 2 price ticks with matched prices within each tick
- **FR-002**: System MUST distribute 1-4 Safe mode trades equally across exactly 2 price ticks with matched prices within each tick
- **FR-003**: System MUST use `trade-distribution.ts` table for trades ≥5 with all trades at each price tier executing at that tier's matched price
- **FR-004**: System MUST validate trade count input is between 1-100 before execution
- **FR-005**: System MUST apply risk distribution rules regardless of execution type, account type (demo/real), trade type, tick duration, or total stake settings
- **FR-006**: System MUST track and log trade allocation across price tiers for audit trail
- **FR-007**: System MUST recalculate distribution if execution mode switches between Turbo/Safe
- **FR-008**: System MUST prevent execution if trade count + settings would violate distribution logic

### User Interface & Confirmation Requirements

Per clarification: System must display pre-execution preview before any trades execute:

**Pre-Execution Confirmation Dialog** must show:
- Execution mode (Turbo/Safe)
- Total number of trades to execute
- Distribution breakdown by tier: "Tier 1: X trades at $P1.XX" / "Tier 2: Y trades at $P2.XX" (etc. for extended distributions)
- Risk allocation per tier (percentage of total capital)
- Estimated execution timeline based on tick duration
- Confirm button to proceed
- Cancel button to abort

**During Execution**:
- Update confirmation dialog (or show live execution panel) with real-time status: "Executing Tier 1: 2/3 trades complete at $X.XX"
- Allow user to see which tier is currently executing
- Display prices locked/used for each tier as they execute

**Post-Execution**:
- Show summary: All N trades distributed correctly across tiers with final prices achieved

### Tick-Based Execution Model

Per clarification: System must account for Deriv's tick-based execution where trading skips prices. When user selects N ticks (1-10):
- Entry occurs at price 1
- Price 2 is skipped (no execution)
- Execution occurs at price 3 onwards following the same pattern

This applies to all tier distributions. Each tier's snapshot must be taken after the tick skip has occurred for that tier's execution window.

### Key Entities

- **TradeDistributionBatch**: Represents a set of trades to be distributed across price ticks. Contains: numberOfTrades (1-100), executionMode (turbo/safe), tradesPerTick (array), pricesPerTick (array - live bid/ask prices)
- **PriceTier**: Represents execution at a specific price level from live market data. Contains: tierIndex (1-N), priceLevel (bid or ask from Deriv API), tradeCount, executedTrades[] (all at same price level)
- **ExecutionSettings**: Represents user-selected execution parameters. Contains: executionMode, numberOfBulkTrades, executionType, accountType, tradeType, tickDuration, totalStake

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Turbo mode trades (1-5) distribute correctly to 2 price tiers with matching prices within each tier
- **SC-002**: 100% of Safe mode trades (1-4) distribute correctly to 2 price ticks with matching prices within each tier
- **SC-003**: 100% of large trades (5-100) match the `trade-distribution.ts` table allocation with correct price matching
- **SC-004**: Distribution behavior remains consistent across all combinations of execution type, account type, trade type, and stake values
- **SC-005**: No trades execute at incorrect price levels due to distribution logic (100% accuracy)
- **SC-006**: Trade execution completes in under 5 seconds for single batch (standard performance baseline)
- **SC-007**: Zero failed trades due to miscalculation of distribution (100% reliability)

- **SC-008**: Pre-execution confirmation dialog displays correctly before any trades execute, showing distribution breakdown and allowing user to review/confirm


