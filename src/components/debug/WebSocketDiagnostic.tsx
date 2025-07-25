'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTickStream } from '@/services/deriv-tick-stream';
import { instrumentToDerivSymbol } from '@/services/deriv';
import type { InstrumentType, PriceTick } from '@/types';

interface WebSocketDiagnosticProps {
  instrument?: InstrumentType;
}

export function WebSocketDiagnostic({ instrument = 'Volatility 10 Index' }: WebSocketDiagnosticProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [tickCount, setTickCount] = useState(0);
  const [lastTick, setLastTick] = useState<PriceTick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]); // Keep last 20 logs
  };

  const testConnection = () => {
    setError(null);
    setTickCount(0);
    setLastTick(null);
    setLogs([]);
    addLog('Starting WebSocket diagnostic test...');

    const tickStream = getTickStream();
    const derivSymbol = instrumentToDerivSymbol(instrument);
    
    addLog(`Testing instrument: ${instrument} -> ${derivSymbol}`);
    addLog(`WebSocket URL: ${process.env.NEXT_PUBLIC_DERIV_WS_URL}?app_id=${process.env.NEXT_PUBLIC_DERIV_APP_ID}`);

    // Monitor connection status
    const statusInterval = setInterval(() => {
      const status = tickStream.getConnectionStatus();
      setConnectionStatus(status);
      if (status !== connectionStatus) {
        addLog(`Connection status changed: ${status}`);
      }
    }, 1000);

    // Subscribe to ticks
    const unsubscribe = tickStream.subscribe(instrument, {
      onTick: (tick: PriceTick) => {
        setTickCount(prev => prev + 1);
        setLastTick(tick);
        addLog(`✅ Tick received: ${tick.price} at ${new Date(tick.epoch * 1000).toLocaleTimeString()}`);
      },
      onError: (error: Error) => {
        setError(error.message);
        addLog(`❌ Error: ${error.message}`);
      },
      onConnect: () => {
        addLog('🔗 Connected to WebSocket');
        setConnectionStatus('connected');
      },
      onDisconnect: () => {
        addLog('🔌 Disconnected from WebSocket');
        setConnectionStatus('disconnected');
      }
    });

    setIsSubscribed(true);
    addLog('Subscription created, waiting for ticks...');

    // Cleanup function
    return () => {
      clearInterval(statusInterval);
      unsubscribe();
      setIsSubscribed(false);
      addLog('Subscription cleaned up');
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          WebSocket Diagnostic Tool
          <Badge className={getStatusColor(connectionStatus)}>
            {connectionStatus.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button onClick={testConnection} disabled={isSubscribed}>
            {isSubscribed ? 'Testing...' : 'Start Test'}
          </Button>
          <div className="text-sm text-muted-foreground">
            Testing: {instrument}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 font-medium">Error:</p>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-blue-50 rounded-md">
            <p className="text-sm font-medium text-blue-800">Tick Count</p>
            <p className="text-2xl font-bold text-blue-600">{tickCount}</p>
          </div>
          
          <div className="p-3 bg-green-50 rounded-md">
            <p className="text-sm font-medium text-green-800">Last Price</p>
            <p className="text-2xl font-bold text-green-600">
              {lastTick ? lastTick.price.toFixed(3) : 'N/A'}
            </p>
          </div>
          
          <div className="p-3 bg-purple-50 rounded-md">
            <p className="text-sm font-medium text-purple-800">Last Update</p>
            <p className="text-sm font-bold text-purple-600">
              {lastTick ? new Date(lastTick.epoch * 1000).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Connection Logs:</h4>
          <div className="bg-gray-50 p-3 rounded-md max-h-60 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-sm">No logs yet. Click "Start Test" to begin.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-xs font-mono text-gray-700 mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Environment Check:</strong></p>
          <p>WebSocket URL: {process.env.NEXT_PUBLIC_DERIV_WS_URL || 'Not set'}</p>
          <p>App ID: {process.env.NEXT_PUBLIC_DERIV_APP_ID || 'Not set'}</p>
          <p>Deriv Symbol: {instrumentToDerivSymbol(instrument)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
