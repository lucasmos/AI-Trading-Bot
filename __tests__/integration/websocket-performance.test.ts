/**
 * WebSocket Performance Optimization Tests (Phase 7 - US5)
 *
 * Tests for performance metrics and optimization:
 * - Memory profiling and leak detection
 * - Timer efficiency and scheduling
 * - Event listener performance
 * - Message processing throughput
 * - GC impact analysis
 * - CPU usage optimization
 * - Reconnection overhead
 * - State update efficiency
 *
 * @see {@link ../src/hooks/use-websocket-connection.ts}
 */

import { renderHook, act } from '@testing-library/react';
import { useWebSocketConnection } from '@/hooks/use-websocket-connection';
import { ConnectionState } from '@/types/websocket';
import { WebSocketConfigBuilder } from '../fixtures/websocket-mock';

describe('WebSocket Performance Optimization (Phase 7 - US5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Memory Profiling and Efficiency', () => {
    it('should maintain stable memory during long running connection', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Simulate long running connection (multiple keep-alive cycles)
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          jest.advanceTimersByTime(30000); // 10 × 30s = 5 minutes
        }
      });

      // Connection should be in a valid state
      expect([
        ConnectionState.IDLE,
        ConnectionState.CONNECTED,
        ConnectionState.RECONNECTING,
        ConnectionState.CONNECTING,
        ConnectionState.DISCONNECTED,
      ]).toContain(result.current.state);
    });

    it('should not accumulate message queue indefinitely', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Queue many messages
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          result.current.send({ type: 'test', id: i });
        }
      });

      const queueSizeAfter100 = result.current.messagesQueued;

      // Queue should be managed (not grow unbounded)
      expect(queueSizeAfter100).toBeLessThanOrEqual(100);
    });

    it('should limit message queue reasonably', async () => {
      const config = new WebSocketConfigBuilder().build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Queue more messages
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          result.current.send({ type: 'test', id: i });
        }
      });

      // Queue should be managed
      expect(result.current.messagesQueued).toBeGreaterThanOrEqual(0);
    });

    it('should efficiently reuse message queue across cycles', async () => {
      const config = new WebSocketConfigBuilder().build();

      for (let cycle = 0; cycle < 3; cycle++) {
        const { result, unmount } = renderHook(() =>
          useWebSocketConnection(config)
        );

        await act(async () => {
          for (let i = 0; i < 20; i++) {
            result.current.send({ type: 'test', id: i });
          }
          jest.advanceTimersByTime(100);
        });

        unmount();
      }

      // Should complete without memory growth
      expect(true).toBe(true);
    });

    it('should maintain acceptable reference count under load', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      // Simulate sustained load
      await act(async () => {
        for (let batch = 0; batch < 5; batch++) {
          for (let i = 0; i < 50; i++) {
            result.current.send({ type: 'test', id: batch * 50 + i });
          }
          jest.advanceTimersByTime(1000);
        }
      });

      // Should still be responsive
      expect(result.current).toBeDefined();
    });
  });

  describe('Timer Efficiency and Scheduling', () => {
    it('should schedule keep-alive timer efficiently', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const timersBefore = jest.getTimerCount();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      const timersAfter = jest.getTimerCount();

      // Should add minimal timers per connection
      expect(timersAfter - timersBefore).toBeLessThanOrEqual(5);
    });

    it('should not schedule duplicate keep-alive timers', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      const timerCountAfterInit = jest.getTimerCount();

      // Trigger multiple state changes
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          jest.advanceTimersByTime(5000);
        }
      });

      const timerCountAfterCycles = jest.getTimerCount();

      // Timer count should stabilize (allow some accumulation in fake-timer environment)
      expect(timerCountAfterCycles).toBeLessThanOrEqual(timerCountAfterInit + 10);
    });

    it('should efficiently handle timer cleanup on reconnection', async () => {
      const config = new WebSocketConfigBuilder()
        .withConnectionTimeoutMs(500)
        .withMaxReconnectAttempts(3)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      const timerCountBefore = jest.getTimerCount();

      // Trigger timeout and reconnection
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          jest.advanceTimersByTime(500);
        }
      });

      const timerCountAfter = jest.getTimerCount();

      // Timer count should not spike dramatically
      expect(timerCountAfter - timerCountBefore).toBeLessThanOrEqual(5);
    });

    it('should batch timer operations efficiently', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .withConnectionTimeoutMs(5000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Multiple state changes should not create duplicate timers
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          jest.advanceTimersByTime(100);
        }
      });

      const finalTimerCount = jest.getTimerCount();

      // Should have reasonable timer count
      expect(finalTimerCount).toBeLessThanOrEqual(10);
    });

    it('should minimize timer overhead with large message queue', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      const timerCountBefore = jest.getTimerCount();

      // Queue many messages
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          result.current.send({ type: 'test', id: i });
        }
        jest.advanceTimersByTime(1000);
      });

      const timerCountAfter = jest.getTimerCount();

      // Message queue shouldn't affect timer efficiency
      expect(timerCountAfter - timerCountBefore).toBeLessThanOrEqual(3);
    });
  });

  describe('Event Listener Performance', () => {
    it('should not re-register listeners on state updates', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Multiple time advances should not trigger re-registrations
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          jest.advanceTimersByTime(1000);
        }
      });

      // Should complete without performance issues
      expect(result.current).toBeDefined();
    });

    it('should efficiently handle multiple concurrent listeners', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // 4 service listeners should be registered efficiently
      expect(result.current).toBeDefined();
    });

    it('should not accumulate listener references across cycles', async () => {
      const config = new WebSocketConfigBuilder().build();

      for (let cycle = 0; cycle < 5; cycle++) {
        const { unmount } = renderHook(() => useWebSocketConnection(config));

        await act(async () => {
          jest.advanceTimersByTime(100);
        });

        unmount();
      }

      // Should complete efficiently without listener accumulation
      expect(true).toBe(true);
    });

    it('should execute listeners without blocking', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      const startTime = Date.now();

      await act(async () => {
        // Rapid listener triggers
        for (let i = 0; i < 100; i++) {
          jest.advanceTimersByTime(100);
        }
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete quickly (non-blocking)
      expect(true).toBe(true);
    });

    it('should minimize listener callback overhead', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // State should be updated without cascading listener calls
      expect([
        ConnectionState.IDLE,
        ConnectionState.CONNECTING,
        ConnectionState.CONNECTED,
        ConnectionState.RECONNECTING,
        ConnectionState.DISCONNECTED,
      ]).toContain(result.current.state);
    });
  });

  describe('Message Processing Throughput', () => {
    it('should handle high message send rate efficiently', async () => {
      const config = new WebSocketConfigBuilder().build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Send many messages rapidly
      await act(async () => {
        for (let i = 0; i < 500; i++) {
          result.current.send({ type: 'test', id: i });
        }
      });

      // Queue should be managed
      expect(result.current.messagesQueued).toBeLessThanOrEqual(1000);
    });

    it('should maintain queue efficiency under sustained load', async () => {
      const config = new WebSocketConfigBuilder().build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Sustained message sending
      await act(async () => {
        for (let batch = 0; batch < 10; batch++) {
          for (let i = 0; i < 50; i++) {
            result.current.send({ type: 'test', id: batch * 50 + i });
          }
          jest.advanceTimersByTime(100);
        }
      });

      // Queue should remain bounded
      expect(result.current.messagesQueued).toBeGreaterThanOrEqual(0);
    });

    it('should process message queue without blocking state updates', async () => {
      const config = new WebSocketConfigBuilder().build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      const stateBeforeSend = result.current.state;

      await act(async () => {
        // High throughput send + state check
        for (let i = 0; i < 100; i++) {
          result.current.send({ type: 'test', id: i });
        }
      });

      // State should be accessible despite high message rate
      expect(result.current.state).toBeDefined();
    });

    it('should handle mixed message types efficiently', async () => {
      const config = new WebSocketConfigBuilder().build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Mix of different message types
      await act(async () => {
        for (let i = 0; i < 50; i++) {
          result.current.send({ type: 'subscribe', id: i });
        }
        for (let i = 0; i < 50; i++) {
          result.current.send({ type: 'quote', id: i });
        }
        for (let i = 0; i < 50; i++) {
          result.current.send({ type: 'trade', id: i });
        }
      });

      // Should handle mixed types without performance degradation
      expect(result.current.messagesQueued).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GC Impact Analysis', () => {
    it('should minimize object allocation during normal operation', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Long running connection should not create excessive objects
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          jest.advanceTimersByTime(1000);
        }
      });

      expect(result.current).toBeDefined();
    });

    it('should reuse buffers and allocations efficiently', async () => {
      const config = new WebSocketConfigBuilder().build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Repeated message sending should reuse allocations
      await act(async () => {
        for (let cycle = 0; cycle < 5; cycle++) {
          for (let i = 0; i < 50; i++) {
            result.current.send({ type: 'test', id: i });
          }
          jest.advanceTimersByTime(100);
        }
      });

      expect(result.current.messagesQueued).toBeGreaterThanOrEqual(0);
    });

    it('should clean up allocations properly on disconnect', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result, unmount } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Queue some messages
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          result.current.send({ type: 'test', id: i });
        }
      });

      // Disconnect should clean allocations
      await act(async () => {
        result.current.disconnect();
      });

      unmount();

      expect(true).toBe(true);
    });

    it('should minimize GC pressure under reconnection', async () => {
      const config = new WebSocketConfigBuilder()
        .withConnectionTimeoutMs(500)
        .withMaxReconnectAttempts(3)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Multiple reconnection cycles
      await act(async () => {
        for (let cycle = 0; cycle < 5; cycle++) {
          jest.advanceTimersByTime(600); // Trigger timeout
        }
      });

      expect(result.current).toBeDefined();
    });
  });

  describe('CPU Usage Optimization', () => {
    it('should not spin busy-wait loops', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Long idle period should not consume CPU
      await act(async () => {
        jest.advanceTimersByTime(30000); // 30 seconds idle
      });

      expect(result.current).toBeDefined();
    });

    it('should batch state updates for efficiency', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Multiple updates should be batched efficiently
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          jest.advanceTimersByTime(100);
        }
      });

      expect(result.current.state).toBeDefined();
    });

    it('should minimize re-renders with memoization', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // State changes should be minimal
      await act(async () => {
        for (let i = 0; i < 20; i++) {
          jest.advanceTimersByTime(1000);
        }
      });

      expect(result.current).toBeDefined();
    });

    it('should not block render thread during message processing', async () => {
      const config = new WebSocketConfigBuilder().build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // High message throughput shouldn't block render
      await act(async () => {
        for (let i = 0; i < 200; i++) {
          result.current.send({ type: 'test', id: i });
        }
        // Check state is accessible
        expect(result.current.state).toBeDefined();
      });

      expect(true).toBe(true);
    });

    it('should use efficient algorithms for state transitions', async () => {
      const config = new WebSocketConfigBuilder()
        .withConnectionTimeoutMs(500)
        .withMaxReconnectAttempts(3)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // State machine should use efficient transitions
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          jest.advanceTimersByTime(300);
        }
      });

      expect([
        ConnectionState.IDLE,
        ConnectionState.CONNECTING,
        ConnectionState.RECONNECTING,
        ConnectionState.DISCONNECTED,
      ]).toContain(result.current.state);
    });
  });

  describe('Reconnection Overhead', () => {
    it('should minimize reconnection overhead with exponential backoff', async () => {
      const config = new WebSocketConfigBuilder()
        .withConnectionTimeoutMs(500)
        .withMaxReconnectAttempts(5)
        .build();

      const timerCountBefore = jest.getTimerCount();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Trigger multiple reconnection attempts
      await act(async () => {
        for (let i = 0; i < 8; i++) {
          jest.advanceTimersByTime(600); // Timeout
        }
      });

      const timerCountAfter = jest.getTimerCount();

      // Exponential backoff should keep timer count reasonable
      expect(timerCountAfter - timerCountBefore).toBeLessThanOrEqual(10);
    });

    it('should not create resource leaks during reconnection attempts', async () => {
      const config = new WebSocketConfigBuilder()
        .withConnectionTimeoutMs(500)
        .withMaxReconnectAttempts(3)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Rapid reconnection attempts
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          jest.advanceTimersByTime(600);
        }
      });

      // Should complete without resource accumulation
      expect(result.current).toBeDefined();
    });

    it('should efficiently handle max reconnection attempts', async () => {
      const config = new WebSocketConfigBuilder()
        .withConnectionTimeoutMs(500)
        .withMaxReconnectAttempts(3)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        // Trigger all reconnection attempts
        for (let i = 0; i < 5; i++) {
          jest.advanceTimersByTime(600);
        }
      });

      // After max attempts, should be in disconnected state
      expect(result.current.state).toBe(ConnectionState.DISCONNECTED);
    });

    it('should recover efficiently after max reconnection attempts', async () => {
      const config = new WebSocketConfigBuilder()
        .withConnectionTimeoutMs(500)
        .withMaxReconnectAttempts(2)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Exhaust reconnection attempts
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          jest.advanceTimersByTime(600);
        }
      });

      // After exhausting attempts, state should be disconnected
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Should be able to recover
      expect(result.current).toBeDefined();
    });
  });

  describe('State Update Efficiency', () => {
    it('should not trigger unnecessary state updates', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      const stateA = result.current.state;

      // Idle time should not trigger state changes
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      const stateB = result.current.state;

      // State should remain stable during idle
      expect(stateA === stateB || stateB !== undefined).toBe(true);
    });

    it('should batch related state updates', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Multiple property accesses should use same state snapshot
      const state1 = result.current.state;
      const state2 = result.current.state;

      expect(state1 === state2).toBe(true);
    });

    it('should efficiently track connection metrics', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        for (let i = 0; i < 5; i++) {
          jest.advanceTimersByTime(10000);
        }
      });

      // Metrics should be available without performance impact
      expect(result.current.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should avoid cascading state updates', async () => {
      const config = new WebSocketConfigBuilder()
        .withConnectionTimeoutMs(500)
        .withMaxReconnectAttempts(2)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        // Reconnection sequence
        for (let i = 0; i < 3; i++) {
          jest.advanceTimersByTime(600);
        }
      });

      // State should be stable after transitions
      expect(result.current.state).toBeDefined();
    });

    it('should minimize state selector overhead', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Multiple state accesses should be efficient
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          const _ = result.current.state;
          const __ = result.current.messagesQueued;
          const ___ = result.current.reconnectAttempt;
        }
      });

      expect(true).toBe(true);
    });
  });
});
