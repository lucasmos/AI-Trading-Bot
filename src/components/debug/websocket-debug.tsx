'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTickStream } from '@/services/deriv-tick-stream';
import type { InstrumentType, PriceTick } from '@/types';

interface WebSocketDebugProps {
  instrument: InstrumentType;
}

export function WebSocketDebug({ instrument }: WebSocketDebugProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [tickCount, setTickCount] = useState(0);
  const [lastTick, setLastTick] = useState<PriceTick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-9), `${timestamp}: ${message}`]);
  };

  useEffect(() => {
    const tickStream = getTickStream();
    
    addLog(`Setting up subscription for ${instrument}`);
    
    const unsubscribe = tickStream.subscribe(instrument, {
      onTick: (tick) => {
        setTickCount(prev => prev + 1);
        setLastTick(tick);
        addLog(`Tick received: ${tick.price} at ${tick.time}`);
      },
      onError: (error) => {
        setError(error.message);
        addLog(`Error: ${error.message}`);
      },
      onConnect: () => {
        setConnectionStatus('connected');
        setError(null);
        addLog('Connected to WebSocket');
      },
      onDisconnect: () => {
        setConnectionStatus('disconnected');
        addLog('Disconnected from WebSocket');
      }
    });

    // Check connection status periodically
    const statusInterval = setInterval(() => {
      const status = tickStream.getConnectionStatus();
      setConnectionStatus(status);
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      unsubscribe();
      addLog('Cleaned up subscription');
    };
  }, [instrument]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          WebSocket Debug
          <Badge className={getStatusColor()}>
            {connectionStatus}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <strong>Instrument:</strong> {instrument}
        </div>
        <div>
          <strong>Tick Count:</strong> {tickCount}
        </div>
        {lastTick && (
          <div>
            <strong>Last Tick:</strong>
            <div className="text-sm">
              Price: {lastTick.price}<br/>
              Time: {lastTick.time}<br/>
              Epoch: {lastTick.epoch}
            </div>
          </div>
        )}
        {error && (
          <div className="text-red-500">
            <strong>Error:</strong> {error}
          </div>
        )}
        <div>
          <strong>Recent Logs:</strong>
          <div className="text-xs bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
        <Button 
          onClick={() => {
            setTickCount(0);
            setLastTick(null);
            setError(null);
            setLogs([]);
            addLog('Reset debug info');
          }}
          variant="outline"
          size="sm"
        >
          Reset
        </Button>
      </CardContent>
    </Card>
  );
}
