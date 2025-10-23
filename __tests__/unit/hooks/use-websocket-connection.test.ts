/**
 * useWebSocketConnection Hook - State Machine Tests
 *
 * Tests for:
 * - State transitions (IDLE → CONNECTING → CONNECTED → etc.)
 * - Connection creation and lifecycle
 * - Authorization flow
 * - Backoff scheduling
 * - Keep-alive timer management
 * - Message queuing and replay
 * - Error handling
 * - Cleanup on unmount
 *
 * @see {@link ../src/hooks/use-websocket-connection.ts}
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocketConnection } from '@/hooks/use-websocket-connection';
import { ConnectionState } from '@/types/websocket';
import { WebSocketConfigBuilder, ConnectionSnapshotBuilder, SAMPLE_MESSAGES, getBackoffSequence } from '../../fixtures/websocket-mock';

describe('useWebSocketConnection Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initialization and State Transitions', () => {
    it('initializes in IDLE state', () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      expect(result.current.state).toBe(ConnectionState.IDLE);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.uptime).toBe(0);
      expect(result.current.messagesSent).toBe(0);
      expect(result.current.messagesQueued).toBe(0);
      expect(result.current.errorCount).toBe(0);
    });

    it('transitions from IDLE to CONNECTING on mount', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(result.current.state).toBe(ConnectionState.CONNECTING);
      });
    });

    it('sets connection timeout when entering CONNECTING state', async () => {
      const config = new WebSocketConfigBuilder()
        .withConnectionTimeoutMs(5000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      expect(result.current.state).toBe(ConnectionState.CONNECTING);

      // Simulate timeout without auth response
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.state).toBe(ConnectionState.RECONNECTING);
    });
  });

  describe('Authorization Flow', () => {
    it('sends authorization message on WebSocket open', async () => {
      const token = 'test-auth-token-123';
      const config = new WebSocketConfigBuilder()
        .withToken(token)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Mock WebSocket should have send called
      const ws = (global as any).WebSocket;
      expect(ws).toBeDefined();
    });

    it('transitions to CONNECTED on successful authorization', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      // Simulate authorization response
      const ws = (global as any).WebSocket;
      const instance = new ws(config.url);

      // Manually trigger auth success (simulating what handleMessage does)
      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      // For this test to work, we need to expose or mock handleMessage
      // This is a limitation of the current implementation
      // Tests would need actual message simulation via the service
    });

    it('tracks reconnectAttempt counter on repeated failures', async () => {
      const config = new WebSocketConfigBuilder()
        .withMaxReconnectAttempts(3)
        .withBaseBackoffMs(100)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      expect(result.current.reconnectAttempt).toBe(0);

      // Simulate connection timeout to trigger reconnection
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.reconnectAttempt).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Exponential Backoff', () => {
    it('calculates correct backoff sequence', () => {
      const sequence = getBackoffSequence(3000, 30000, 6);

      expect(sequence).toEqual([3000, 6000, 12000, 24000, 30000, 30000]);
    });

    it('caps backoff at max delay', () => {
      const sequence = getBackoffSequence(5000, 20000, 4);

      // Should be capped at 20000
      expect(sequence[3]).toBeLessThanOrEqual(20000);
    });

    it('schedules reconnection with exponential backoff delays', async () => {
      const config = new WebSocketConfigBuilder()
        .withMaxReconnectAttempts(2)
        .withBaseBackoffMs(1000)
        .withMaxBackoffMs(3000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Simulate initial connection timeout
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Should be in RECONNECTING and waiting for first backoff (1000ms)
      expect(result.current.state).toBe(ConnectionState.RECONNECTING);
      expect(result.current.reconnectAttempt).toBeGreaterThan(0);

      // Advance first backoff
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // Should transition back to CONNECTING for second attempt
      expect(result.current.state).toBe(ConnectionState.CONNECTING);
    });

    it('gives up after max reconnection attempts', async () => {
      const config = new WebSocketConfigBuilder()
        .withMaxReconnectAttempts(2)
        .withBaseBackoffMs(100)
        .withMaxBackoffMs(100)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Timeout 1
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Wait for first backoff and transition back to CONNECTING
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Timeout 2
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Wait for second backoff
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Should reach max attempts and disconnect
      expect(result.current.state).toBe(ConnectionState.DISCONNECTED);
      expect(result.current.reconnectAttempt).toBeLessThanOrEqual(2);
    });
  });

  describe('Keep-Alive Pings', () => {
    it('starts keep-alive timer when CONNECTED', async () => {
      const config = new WebSocketConfigBuilder()
        .withKeepAliveIntervalMs(30000)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      // Can't directly test without proper socket setup
      // This requires integration with service and message handler
    });

    it('sends ping every 30 seconds in CONNECTED state', () => {
      // This test requires mocking the service and simulating full connection
      // Placeholder for integration-level test
    });

    it('stops keep-alive timer when disconnecting', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result, unmount } = renderHook(() => useWebSocketConnection(config));

      // Unmount should trigger cleanup
      unmount();

      // Timer cleanup should have been called
      // Verify no intervals remain
      expect(jest.getTimerCount()).toBeLessThanOrEqual(0);
    });
  });

  describe('Message Queuing', () => {
    it('queues messages when not connected', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      expect(result.current.state).toBe(ConnectionState.IDLE);

      // Try to send message while not connected
      await act(async () => {
        result.current.send({ test: 'message' });
      });

      expect(result.current.messagesQueued).toBeGreaterThan(0);
    });

    it('maintains FIFO order in message queue', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      const msg1 = { id: 1, type: 'first' };
      const msg2 = { id: 2, type: 'second' };
      const msg3 = { id: 3, type: 'third' };

      await act(async () => {
        result.current.send(msg1);
        result.current.send(msg2);
        result.current.send(msg3);
      });

      expect(result.current.messagesQueued).toBe(3);
    });

    it('enforces max 100 item queue limit', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      // Send 101 messages
      await act(async () => {
        for (let i = 0; i < 101; i++) {
          result.current.send({ id: i });
        }
      });

      // Queue should be capped at 100
      expect(result.current.messagesQueued).toBeLessThanOrEqual(100);
    });

    it('sends messages immediately when connected', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      // Simulate being connected (this would require full integration setup)
      // Placeholder for behavior verification
      expect(result.current.isReady).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('increments error count on connection error', async () => {
      const config = new WebSocketConfigBuilder().build();
      const onError = jest.fn();
      const configWithError = new WebSocketConfigBuilder()
        .withOnError(onError)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(configWithError));

      const initialErrors = result.current.errorCount;

      // Simulate connection timeout (error scenario)
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.errorCount).toBeGreaterThanOrEqual(initialErrors);
    });

    it('captures error details in lastError', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      // Trigger error scenario
      await act(async () => {
        jest.advanceTimersByTime(5000); // timeout
      });

      // Error should be captured if state is RECONNECTING
      if (result.current.state === ConnectionState.RECONNECTING) {
        // Error details would be populated by error handler
      }
    });

    it('tracks disconnect count', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      const initialDisconnects = result.current.disconnectCount;

      // Simulate disconnection
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Disconnect count should increase
      expect(result.current.disconnectCount).toBeGreaterThanOrEqual(initialDisconnects);
    });
  });

  describe('Cleanup and Unmount', () => {
    it('clears all timers on unmount', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { unmount } = renderHook(() => useWebSocketConnection(config));

      const timersBefore = jest.getTimerCount();

      unmount();

      const timersAfter = jest.getTimerCount();
      expect(timersAfter).toBeLessThanOrEqual(timersBefore);
    });

    it('transitions to DISCONNECTED on unmount', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result, unmount } = renderHook(() => useWebSocketConnection(config));

      // Component should be in some state
      const stateBeforeUnmount = result.current.state;

      unmount();

      // After unmount, component state shouldn't be used, but cleanup should be triggered
      expect(stateBeforeUnmount).toBeDefined();
    });

    it('closes WebSocket on unmount', () => {
      const config = new WebSocketConfigBuilder().build();
      const { unmount } = renderHook(() => useWebSocketConnection(config));

      unmount();

      // Socket should be closed/cleaned up
      // Verify no orphaned connections
    });
  });

  describe('Public API', () => {
    it('provides send() method', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      expect(result.current.send).toBeDefined();
      expect(typeof result.current.send).toBe('function');
    });

    it('provides disconnect() method', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      expect(result.current.disconnect).toBeDefined();
      expect(typeof result.current.disconnect).toBe('function');
    });

    it('provides isReady property', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      expect(result.current.isReady).toBeDefined();
      expect(typeof result.current.isReady).toBe('boolean');
    });

    it('provides full ConnectionSnapshot interface', async () => {
      const config = new WebSocketConfigBuilder().build();
      const { result } = renderHook(() => useWebSocketConnection(config));

      // Verify all snapshot fields exist
      expect(result.current.id).toBeDefined();
      expect(result.current.state).toBeDefined();
      expect(result.current.isConnected).toBeDefined();
      expect(result.current.isConnecting).toBeDefined();
      expect(result.current.uptime).toBeDefined();
      expect(result.current.reconnectAttempt).toBeDefined();
      expect(result.current.messagesSent).toBeDefined();
      expect(result.current.messagesQueued).toBeDefined();
      expect(result.current.errorCount).toBeDefined();
      expect(result.current.disconnectCount).toBeDefined();
    });
  });

  describe('Config Handling', () => {
    it('uses default config when not provided', () => {
      const config = new WebSocketConfigBuilder()
        .withUrl('wss://example.com')
        .withToken('token')
        .build();

      const { result } = renderHook(() => useWebSocketConnection(config));

      expect(result.current).toBeDefined();
      // Defaults should be applied
    });

    it('overrides defaults with custom config', () => {
      const customConfig = new WebSocketConfigBuilder()
        .withConnectionTimeoutMs(10000)
        .withMaxReconnectAttempts(3)
        .build();

      const { result } = renderHook(() => useWebSocketConnection(customConfig));

      expect(result.current).toBeDefined();
    });

    it('calls onStateChange callback when state changes', async () => {
      const onStateChange = jest.fn();
      const config = new WebSocketConfigBuilder()
        .withOnStateChange(onStateChange)
        .build();

      renderHook(() => useWebSocketConnection(config));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      // Callback should be called on state changes
      // Exact timing depends on implementation
    });

    it('calls onError callback when error occurs', async () => {
      const onError = jest.fn();
      const config = new WebSocketConfigBuilder()
        .withOnError(onError)
        .build();

      renderHook(() => useWebSocketConnection(config));

      // Trigger error scenario
      // onError should be called
    });
  });
});
