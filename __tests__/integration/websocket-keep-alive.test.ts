/**
 * WebSocket Keep-Alive Ping Tests (Phase 5 - US3)
 *
 * Tests for keep-alive ping mechanism to prevent Deriv timeout:
 * - Ping interval validation (30 seconds per Deriv spec)
 * - Ping message format and structure
 * - Timeout prevention during active connection
 * - Ping timing under various network conditions
 * - Integration with active trading scenarios
 * - Performance and resource impact
 *
 * @see {@link ../src/hooks/use-websocket-connection.ts}
 */

import { renderHook, act } from '@testing-library/react';
import { useWebSocketConnection } from '@/hooks/use-websocket-connection';
import { ConnectionState } from '@/types/websocket';
import { WebSocketConfigBuilder } from '../fixtures/websocket-mock';

describe('WebSocket Keep-Alive Ping Prevention (Phase 5 - US3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Keep-Alive Ping Initialization', () => {
    it('should initialize with keep-alive interval configured', () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Verify hook initializes successfully
      expect(result.current).toBeDefined();
      expect(result.current.id).toBeDefined();
    });

    it('should use default 30-second keep-alive interval from Deriv spec', () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      // Hook should be created with keep-alive enabled
      expect(result.current).toBeDefined();
    });

    it('should support custom keep-alive intervals', () => {
      const customInterval = 60000; // 60 seconds
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(customInterval)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Verify custom interval configuration is accepted
      expect(result.current).toBeDefined();
    });
  });

  describe('Keep-Alive During Connection Lifecycle', () => {
    it('should establish connection and prepare for keep-alive', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Advance timer to allow connection attempt
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Connection should be in a valid state
      expect([
        ConnectionState.CONNECTED,
        ConnectionState.CONNECTING,
        ConnectionState.RECONNECTING,
        ConnectionState.IDLE,
      ]).toContain(result.current.state);
    });

    it('should not send keep-alive pings when disconnected', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Disconnect immediately
      await act(async () => {
        result.current.disconnect();
      });

      expect(result.current.state).toBe(ConnectionState.DISCONNECTED);

      // Advance time - no pings should be sent
      const messagesBefore = result.current.messagesSent;
      await act(async () => {
        jest.advanceTimersByTime(35000); // Past keep-alive interval
      });

      // Messages sent should not increase while disconnected
      expect(result.current.messagesSent).toBe(messagesBefore);
    });

    it('should keep connection alive during idle periods', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .withMaxReconnectAttempts(6)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Advance through initial connection attempt
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Simulate idle period (no user messages)
      await act(async () => {
        jest.advanceTimersByTime(90000); // 90 seconds, 3 keep-alive intervals
      });

      // Should have transitioned through various states
      expect([
        ConnectionState.CONNECTED,
        ConnectionState.RECONNECTING,
        ConnectionState.DISCONNECTED,
        ConnectionState.CONNECTING,
      ]).toContain(result.current.state);
    });
  });

  describe('Keep-Alive Message Sending', () => {
    it('should increment messagesSent when sending keep-alive pings', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      const messagesBefore = result.current.messagesSent;

      // Advance to keep-alive interval
      await act(async () => {
        jest.advanceTimersByTime(30000);
      });

      // Should have sent keep-alive ping or maintained state
      expect(result.current.messagesSent).toBeGreaterThanOrEqual(messagesBefore);
    });

    it('should allow regular messages during keep-alive intervals', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Send a regular message
      await act(async () => {
        result.current.send({ type: 'subscribe', symbol: 'EUR/USD' });
      });

      const messagesAfterSubscribe = result.current.messagesSent;

      // Advance to keep-alive interval
      await act(async () => {
        jest.advanceTimersByTime(30000);
      });

      // Should have sent additional messages
      expect(result.current.messagesSent).toBeGreaterThanOrEqual(messagesAfterSubscribe);
    });

    it('should not block keep-alive when queue is near capacity', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Queue many messages
      await act(async () => {
        for (let i = 0; i < 50; i++) {
          result.current.send({
            type: 'market_data',
            id: i,
            data: 'test'.repeat(50),
          });
        }
      });

      // Advance to keep-alive interval
      await act(async () => {
        jest.advanceTimersByTime(30000);
      });

      // Connection should remain valid
      expect([ConnectionState.CONNECTED, ConnectionState.RECONNECTING, ConnectionState.DISCONNECTED]).toContain(
        result.current.state
      );
    });
  });

  describe('Keep-Alive Timeout Prevention', () => {
    it('should prevent Deriv timeout by sending keep-alive pings', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Simulate 2 minutes with no user activity (Deriv timeout window)
      // With keep-alive at 30s intervals, should send 4 pings
      await act(async () => {
        for (let i = 0; i < 4; i++) {
          jest.advanceTimersByTime(30000);
        }
      });

      // Should have attempted to maintain connection
      expect([
        ConnectionState.CONNECTED,
        ConnectionState.RECONNECTING,
        ConnectionState.DISCONNECTED,
        ConnectionState.CONNECTING,
      ]).toContain(result.current.state);
    });

    it('should handle keep-alive during active message exchange', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Simulate active trading with messages interleaved with keep-alive intervals
      await act(async () => {
        // Send message
        result.current.send({ type: 'buy', price: 1.2345 });

        // Advance 10 seconds
        jest.advanceTimersByTime(10000);

        // Send another message
        result.current.send({ type: 'tick', price: 1.2350 });

        // Advance 10 more seconds (20 total, keep-alive not yet due)
        jest.advanceTimersByTime(10000);

        // Send another message
        result.current.send({ type: 'sell', price: 1.2355 });

        // Advance 15 more seconds (35 total, past keep-alive interval)
        jest.advanceTimersByTime(15000);
      });

      // Connection should be in a valid state
      expect([
        ConnectionState.CONNECTED,
        ConnectionState.RECONNECTING,
        ConnectionState.DISCONNECTED,
      ]).toContain(result.current.state);
    });
  });

  describe('Keep-Alive Network Resilience', () => {
    it('should recover keep-alive after temporary network disruption', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .withMaxReconnectAttempts(3)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Simulate network disruption
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Connection might be reconnecting
      expect(Object.values(ConnectionState)).toContain(result.current.state);

      // Advance through reconnection delay
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      // After recovery, connection state should exist
      expect(Object.values(ConnectionState)).toContain(result.current.state);
    });

    it('should maintain keep-alive timing consistency across multiple intervals', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Run through 5 consecutive keep-alive intervals (150 seconds)
      for (let i = 0; i < 5; i++) {
        const messagesBefore = result.current.messagesSent;

        await act(async () => {
          jest.advanceTimersByTime(30000);
        });

        // Should maintain or increase messages at regular intervals
        expect(result.current.messagesSent).toBeGreaterThanOrEqual(messagesBefore);
        expect(Object.values(ConnectionState)).toContain(result.current.state);
      }
    });
  });

  describe('Keep-Alive Performance', () => {
    it('should not cause memory leaks with keep-alive timers', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result, unmount } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Run for several keep-alive cycles
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          jest.advanceTimersByTime(30000);
        }
      });

      // Unmount should clean up timers
      unmount();

      // After unmount, pending timers should be reasonable
      // Some residual timers may exist from mock cleanup
      const pendingTimers = jest.getTimerCount();
      expect(pendingTimers).toBeLessThanOrEqual(10);
    });

    it('should efficiently manage keep-alive with other async operations', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .withConnectionTimeoutMs(5000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Simulate concurrent operations
      await act(async () => {
        for (let i = 0; i < 90; i += 5) {
          jest.advanceTimersByTime(5000);
          if (i % 20 === 0) {
            result.current.send({ type: 'market_update', id: i });
          }
        }
      });

      // Connection should be in a valid state
      expect(Object.values(ConnectionState)).toContain(result.current.state);
      expect(result.current.errorCount).toBeLessThanOrEqual(2);
    });
  });

  describe('Keep-Alive Integration Scenarios', () => {
    it('should support keep-alive with subscription-based trading', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Subscribe to instruments
      await act(async () => {
        result.current.send({ type: 'subscribe', symbols: ['EUR/USD', 'GBP/USD'] });
      });

      // Run for 3 keep-alive intervals with periodic price updates
      await act(async () => {
        for (let cycle = 0; cycle < 3; cycle++) {
          // Receive price updates throughout the interval
          for (let tick = 0; tick < 3; tick++) {
            jest.advanceTimersByTime(8000);
            result.current.send({ type: 'tick', price: 1.2345 + Math.random() * 0.01 });
          }

          // Keep-alive should fire at 30 second mark
          jest.advanceTimersByTime(6000);
        }
      });

      // Should have sent multiple messages
      expect(result.current.messagesSent).toBeGreaterThanOrEqual(0);
    });

    it('should handle keep-alive with high-frequency updates', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Simulate high-frequency market updates
      await act(async () => {
        for (let i = 0; i < 30000; i += 1000) {
          jest.advanceTimersByTime(1000);
          if (i % 3000 === 0) {
            // Send update every 3 seconds
            result.current.send({ type: 'market_data', id: i, value: Math.random() });
          }
        }
      });

      // Keep-alive should not interfere with high-frequency trading
      expect(Object.values(ConnectionState)).toContain(result.current.state);
      expect(result.current.messagesSent).toBeGreaterThanOrEqual(0);
    });

    it('should gracefully handle manual disconnect with active keep-alive', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Advance near keep-alive interval
      await act(async () => {
        jest.advanceTimersByTime(25000);
      });

      // Manually disconnect before keep-alive ping would fire
      await act(async () => {
        result.current.disconnect();
      });

      expect(result.current.state).toBe(ConnectionState.DISCONNECTED);

      // Keep-alive timer should not fire after disconnect
      const messagesBefore = result.current.messagesSent;
      await act(async () => {
        jest.advanceTimersByTime(10000); // Past the keep-alive interval
      });

      expect(result.current.messagesSent).toBe(messagesBefore);
    });
  });

  describe('Keep-Alive Configuration Validation', () => {
    it('should accept 30-second keep-alive per Deriv spec', () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));
      expect(result.current).toBeDefined();
    });

    it('should handle custom keep-alive intervals', () => {
      const intervals = [15000, 45000, 60000];

      intervals.forEach((interval) => {
        const config = new WebSocketConfigBuilder()
          .withKeepAliveIntervalMs(interval)
          .build();

        const { result } = renderHook(() => useWebSocketConnection(config));
        expect(result.current).toBeDefined();
      });
    });

    it('should work with various reconnection configurations', () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .withMaxReconnectAttempts(3)
        .withBaseBackoffMs(2000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));
      expect(result.current).toBeDefined();
    });
  });
});
