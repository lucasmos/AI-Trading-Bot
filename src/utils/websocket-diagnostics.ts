/**
 * WebSocket Diagnostic Utility
 * Comprehensive diagnostics for WebSocket connection issues
 */

export interface WebSocketDiagnostics {
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  errorDetails?: {
    type: string;
    message: string;
    code?: number;
    timestamp: string;
  };
  networkDiagnostics: {
    isOnline: boolean;
    connectionType?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
  apiEndpointStatus: {
    url: string;
    reachable: boolean;
    responseTime?: number;
    lastChecked: string;
  };
  authenticationStatus: {
    hasToken: boolean;
    tokenValid?: boolean;
    errorMessage?: string;
  };
  subscriptionState: {
    activeSubscriptions: number;
    pendingSubscriptions: number;
    failedSubscriptions: number;
  };
  performanceMetrics: {
    reconnectAttempts: number;
    totalMessages: number;
    errorCount: number;
    averageLatency?: number;
    uptime?: number;
  };
}

export class WebSocketDiagnosticTool {
  private diagnostics: WebSocketDiagnostics;
  private ws: WebSocket | null = null;
  private startTime: number;
  private messageCount = 0;
  private errorCount = 0;
  private latencyMeasurements: number[] = [];

  constructor(private wsUrl: string, private appId: string) {
    this.startTime = Date.now();
    this.diagnostics = this.getInitialDiagnostics();
  }

  private getInitialDiagnostics(): WebSocketDiagnostics {
    return {
      connectionState: 'disconnected',
      networkDiagnostics: this.getNetworkDiagnostics(),
      apiEndpointStatus: {
        url: this.wsUrl,
        reachable: false,
        lastChecked: new Date().toISOString()
      },
      authenticationStatus: {
        hasToken: false
      },
      subscriptionState: {
        activeSubscriptions: 0,
        pendingSubscriptions: 0,
        failedSubscriptions: 0
      },
      performanceMetrics: {
        reconnectAttempts: 0,
        totalMessages: 0,
        errorCount: 0
      }
    };
  }

  private getNetworkDiagnostics() {
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    return {
      isOnline: navigator.onLine,
      connectionType: connection?.type,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt
    };
  }

  async runFullDiagnostics(apiToken?: string): Promise<WebSocketDiagnostics> {
    console.log('[WebSocket Diagnostics] Starting comprehensive diagnostics...');
    
    // Step 1: Check network connectivity
    this.diagnostics.networkDiagnostics = this.getNetworkDiagnostics();
    
    if (!this.diagnostics.networkDiagnostics.isOnline) {
      this.diagnostics.errorDetails = {
        type: 'NETWORK_OFFLINE',
        message: 'Device is offline. Please check your internet connection.',
        timestamp: new Date().toISOString()
      };
      return this.diagnostics;
    }

    // Step 2: Test API endpoint reachability
    await this.testApiEndpoint();

    // Step 3: Test WebSocket connection
    await this.testWebSocketConnection(apiToken);

    // Step 4: Calculate performance metrics
    this.calculatePerformanceMetrics();

    return this.diagnostics;
  }

  private async testApiEndpoint(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test with a simple HTTP endpoint if available
      // For Binary/Deriv, we'll test the WebSocket endpoint directly
      const testUrl = this.wsUrl.replace('wss://', 'https://').replace('/websockets/v3', '');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(testUrl, { 
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // Avoid CORS issues for diagnostic purposes
      });
      
      clearTimeout(timeoutId);
      
      this.diagnostics.apiEndpointStatus = {
        url: this.wsUrl,
        reachable: true,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      this.diagnostics.apiEndpointStatus = {
        url: this.wsUrl,
        reachable: false,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          this.diagnostics.errorDetails = {
            type: 'ENDPOINT_TIMEOUT',
            message: 'API endpoint request timed out after 5 seconds',
            timestamp: new Date().toISOString()
          };
        } else {
          this.diagnostics.errorDetails = {
            type: 'ENDPOINT_UNREACHABLE',
            message: `Cannot reach API endpoint: ${error.message}`,
            timestamp: new Date().toISOString()
          };
        }
      }
    }
  }

  private testWebSocketConnection(apiToken?: string): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.diagnostics.connectionState = 'error';
        this.diagnostics.errorDetails = {
          type: 'CONNECTION_TIMEOUT',
          message: 'WebSocket connection timed out after 10 seconds',
          timestamp: new Date().toISOString()
        };
        if (this.ws) {
          this.ws.close();
        }
        resolve();
      }, 10000);

      try {
        const fullUrl = `${this.wsUrl}?app_id=${this.appId}`;
        console.log(`[WebSocket Diagnostics] Attempting connection to: ${fullUrl}`);
        
        this.ws = new WebSocket(fullUrl);
        this.diagnostics.connectionState = 'connecting';

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('[WebSocket Diagnostics] Connection established');
          this.diagnostics.connectionState = 'connected';
          
          if (apiToken) {
            // Test authentication
            this.diagnostics.authenticationStatus.hasToken = true;
            this.ws!.send(JSON.stringify({ authorize: apiToken }));
            
            // Wait for auth response
            setTimeout(() => {
              this.ws?.close();
              resolve();
            }, 2000);
          } else {
            // Test ping without auth
            this.ws!.send(JSON.stringify({ ping: 1 }));
            setTimeout(() => {
              this.ws?.close();
              resolve();
            }, 1000);
          }
        };

        this.ws.onmessage = (event) => {
          this.messageCount++;
          try {
            const data = JSON.parse(event.data);
            
            if (data.error) {
              this.errorCount++;
              this.diagnostics.errorDetails = {
                type: 'API_ERROR',
                message: data.error.message || 'Unknown API error',
                code: data.error.code,
                timestamp: new Date().toISOString()
              };
              
              if (data.error.code === 'AuthorizationRequired' || data.error.code === 'InvalidToken') {
                this.diagnostics.authenticationStatus.tokenValid = false;
                this.diagnostics.authenticationStatus.errorMessage = data.error.message;
              }
            } else if (data.msg_type === 'authorize') {
              this.diagnostics.authenticationStatus.tokenValid = true;
            } else if (data.msg_type === 'pong') {
              const latency = Date.now() - this.startTime;
              this.latencyMeasurements.push(latency);
            }
          } catch (error) {
            console.error('[WebSocket Diagnostics] Message parse error:', error);
          }
        };

        this.ws.onerror = (event) => {
          clearTimeout(timeout);
          this.errorCount++;
          console.error('[WebSocket Diagnostics] WebSocket error event:', event);
          
          this.diagnostics.connectionState = 'error';
          this.diagnostics.errorDetails = {
            type: 'WEBSOCKET_ERROR',
            message: 'WebSocket connection error occurred',
            timestamp: new Date().toISOString()
          };
          
          // Check for specific error patterns
          if (this.ws?.readyState === WebSocket.CLOSED) {
            this.checkClosureReason();
          }
          
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log(`[WebSocket Diagnostics] Connection closed: Code ${event.code}, Reason: ${event.reason}`);
          
          this.diagnostics.connectionState = 'disconnected';
          
          // Analyze close codes
          this.analyzeCloseCode(event.code, event.reason);
          
          resolve();
        };

      } catch (error) {
        clearTimeout(timeout);
        this.diagnostics.connectionState = 'error';
        
        if (error instanceof Error) {
          this.diagnostics.errorDetails = {
            type: 'CONNECTION_FAILED',
            message: error.message,
            timestamp: new Date().toISOString()
          };
        }
        
        resolve();
      }
    });
  }

  private checkClosureReason() {
    // Common closure reasons
    const reasons = {
      1000: 'Normal closure',
      1001: 'Endpoint going away (server shutdown or browser navigation)',
      1002: 'Protocol error',
      1003: 'Unsupported data type',
      1006: 'Abnormal closure (no close frame received)',
      1007: 'Invalid data received',
      1008: 'Policy violation',
      1009: 'Message too large',
      1010: 'Mandatory extension missing',
      1011: 'Server error',
      1015: 'TLS handshake failure'
    };
    
    // Additional diagnostics based on state
    if (!navigator.onLine) {
      this.diagnostics.errorDetails = {
        type: 'NETWORK_LOST',
        message: 'Network connection was lost during WebSocket operation',
        timestamp: new Date().toISOString()
      };
    }
  }

  private analyzeCloseCode(code: number, reason: string) {
    const closeReasons: Record<number, string> = {
      1000: 'Normal closure',
      1001: 'Endpoint going away',
      1002: 'Protocol error',
      1003: 'Unsupported data type',
      1006: 'Abnormal closure',
      1007: 'Invalid data',
      1008: 'Policy violation',
      1009: 'Message too large',
      1010: 'Mandatory extension missing',
      1011: 'Server error',
      1015: 'TLS handshake failure'
    };

    const knownReason = closeReasons[code];
    
    if (code >= 4000 && code <= 4999) {
      // Application-specific close codes
      this.diagnostics.errorDetails = {
        type: 'APPLICATION_ERROR',
        message: `Application error: ${reason || 'Unknown'}`,
        code,
        timestamp: new Date().toISOString()
      };
    } else if (knownReason) {
      this.diagnostics.errorDetails = {
        type: 'WEBSOCKET_CLOSE',
        message: `${knownReason}${reason ? `: ${reason}` : ''}`,
        code,
        timestamp: new Date().toISOString()
      };
    }
  }

  private calculatePerformanceMetrics() {
    const uptime = Date.now() - this.startTime;
    const avgLatency = this.latencyMeasurements.length > 0
      ? this.latencyMeasurements.reduce((a, b) => a + b, 0) / this.latencyMeasurements.length
      : undefined;

    this.diagnostics.performanceMetrics = {
      reconnectAttempts: 0, // Would be tracked in actual implementation
      totalMessages: this.messageCount,
      errorCount: this.errorCount,
      averageLatency: avgLatency,
      uptime
    };
  }

  generateReport(): string {
    const report: string[] = [
      '=== WebSocket Diagnostic Report ===',
      '',
      `Timestamp: ${new Date().toISOString()}`,
      `WebSocket URL: ${this.wsUrl}`,
      `App ID: ${this.appId}`,
      '',
      '--- Connection Status ---',
      `State: ${this.diagnostics.connectionState}`,
      ''
    ];

    if (this.diagnostics.errorDetails) {
      report.push('--- Error Details ---');
      report.push(`Type: ${this.diagnostics.errorDetails.type}`);
      report.push(`Message: ${this.diagnostics.errorDetails.message}`);
      if (this.diagnostics.errorDetails.code) {
        report.push(`Code: ${this.diagnostics.errorDetails.code}`);
      }
      report.push('');
    }

    report.push('--- Network Diagnostics ---');
    report.push(`Online: ${this.diagnostics.networkDiagnostics.isOnline}`);
    if (this.diagnostics.networkDiagnostics.connectionType) {
      report.push(`Connection Type: ${this.diagnostics.networkDiagnostics.connectionType}`);
    }
    if (this.diagnostics.networkDiagnostics.effectiveType) {
      report.push(`Effective Type: ${this.diagnostics.networkDiagnostics.effectiveType}`);
    }
    if (this.diagnostics.networkDiagnostics.rtt) {
      report.push(`RTT: ${this.diagnostics.networkDiagnostics.rtt}ms`);
    }
    report.push('');

    report.push('--- API Endpoint ---');
    report.push(`URL: ${this.diagnostics.apiEndpointStatus.url}`);
    report.push(`Reachable: ${this.diagnostics.apiEndpointStatus.reachable}`);
    if (this.diagnostics.apiEndpointStatus.responseTime) {
      report.push(`Response Time: ${this.diagnostics.apiEndpointStatus.responseTime}ms`);
    }
    report.push('');

    if (this.diagnostics.authenticationStatus.hasToken) {
      report.push('--- Authentication ---');
      report.push(`Has Token: ${this.diagnostics.authenticationStatus.hasToken}`);
      if (this.diagnostics.authenticationStatus.tokenValid !== undefined) {
        report.push(`Token Valid: ${this.diagnostics.authenticationStatus.tokenValid}`);
      }
      if (this.diagnostics.authenticationStatus.errorMessage) {
        report.push(`Auth Error: ${this.diagnostics.authenticationStatus.errorMessage}`);
      }
      report.push('');
    }

    report.push('--- Performance Metrics ---');
    report.push(`Total Messages: ${this.diagnostics.performanceMetrics.totalMessages}`);
    report.push(`Error Count: ${this.diagnostics.performanceMetrics.errorCount}`);
    if (this.diagnostics.performanceMetrics.averageLatency) {
      report.push(`Average Latency: ${this.diagnostics.performanceMetrics.averageLatency.toFixed(2)}ms`);
    }
    report.push('');

    report.push('--- Recommended Actions ---');
    report.push(...this.getRecommendedActions());

    return report.join('\n');
  }

  private getRecommendedActions(): string[] {
    const actions: string[] = [];

    if (!this.diagnostics.networkDiagnostics.isOnline) {
      actions.push('1. Check internet connection');
      actions.push('2. Verify network adapter settings');
      actions.push('3. Test with different network (mobile hotspot)');
    } else if (this.diagnostics.errorDetails?.type === 'ENDPOINT_UNREACHABLE') {
      actions.push('1. Check firewall settings for WebSocket connections');
      actions.push('2. Verify proxy configuration');
      actions.push('3. Test with VPN disabled');
      actions.push('4. Check if ws.binaryws.com is accessible');
    } else if (this.diagnostics.errorDetails?.type === 'WEBSOCKET_ERROR') {
      actions.push('1. Clear browser cache and cookies');
      actions.push('2. Disable browser extensions temporarily');
      actions.push('3. Try different browser');
      actions.push('4. Check browser console for additional errors');
    } else if (this.diagnostics.authenticationStatus.tokenValid === false) {
      actions.push('1. Verify API token is correct');
      actions.push('2. Check token expiration');
      actions.push('3. Generate new API token from Deriv account');
      actions.push('4. Ensure token has required permissions');
    } else if (this.diagnostics.errorDetails?.type === 'CONNECTION_TIMEOUT') {
      actions.push('1. Check network latency and stability');
      actions.push('2. Verify DNS resolution for ws.binaryws.com');
      actions.push('3. Test with different DNS servers (8.8.8.8)');
      actions.push('4. Check for ISP-level blocking');
    }

    if (actions.length === 0) {
      actions.push('Connection appears to be working correctly');
    }

    return actions;
  }

  cleanup() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
  }
}

// Export convenience function for quick diagnostics
export async function runWebSocketDiagnostics(
  wsUrl: string,
  appId: string,
  apiToken?: string
): Promise<WebSocketDiagnostics> {
  const tool = new WebSocketDiagnosticTool(wsUrl, appId);
  const diagnostics = await tool.runFullDiagnostics(apiToken);
  const report = tool.generateReport();
  
  console.log(report);
  tool.cleanup();
  
  return diagnostics;
}
