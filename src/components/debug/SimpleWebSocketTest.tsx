'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function SimpleWebSocketTest() {
  const [status, setStatus] = useState<string>('Not connected');
  const [messages, setMessages] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const connect = () => {
    const wsUrl = `${process.env.NEXT_PUBLIC_DERIV_WS_URL}?app_id=${process.env.NEXT_PUBLIC_DERIV_APP_ID}`;
    console.log('Connecting to:', wsUrl);
    setMessages(prev => [...prev, `Attempting to connect to: ${wsUrl}`]);
    setStatus('Connecting...');

    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      setStatus('Connected');
      setMessages(prev => [...prev, 'WebSocket connected']);
      
      // Subscribe to R_10 ticks
      const subscribeMessage = {
        ticks: 'R_10',
        subscribe: 1
      };
      websocket.send(JSON.stringify(subscribeMessage));
      setMessages(prev => [...prev, 'Subscribed to R_10 ticks']);
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.msg_type === 'tick') {
        setMessages(prev => [...prev, `Tick: ${data.tick.quote} at ${new Date(data.tick.epoch * 1000).toLocaleTimeString()}`]);
      } else {
        setMessages(prev => [...prev, `Message: ${JSON.stringify(data)}`]);
      }
    };
    
    websocket.onerror = (error) => {
      setStatus('Error');
      console.error('WebSocket error:', error);
      setMessages(prev => [...prev, `Error occurred: ${JSON.stringify(error)}`]);
    };
    
    websocket.onclose = (event) => {
      setStatus('Disconnected');
      setMessages(prev => [...prev, `WebSocket disconnected - Code: ${event.code}, Reason: ${event.reason || 'No reason'}, Clean: ${event.wasClean}`]);
    };
    
    setWs(websocket);
  };

  const disconnect = () => {
    if (ws) {
      ws.close();
      setWs(null);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Simple WebSocket Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button onClick={connect} disabled={!!ws}>
            Connect
          </Button>
          <Button onClick={disconnect} disabled={!ws} variant="outline">
            Disconnect
          </Button>
          <span className="text-sm">Status: {status}</span>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-md max-h-60 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-sm">No messages yet</p>
          ) : (
            messages.slice(-20).map((msg, index) => (
              <div key={index} className="text-xs font-mono text-gray-700 mb-1">
                {msg}
              </div>
            ))
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          <p>WebSocket URL: {process.env.NEXT_PUBLIC_DERIV_WS_URL}?app_id={process.env.NEXT_PUBLIC_DERIV_APP_ID}</p>
        </div>
      </CardContent>
    </Card>
  );
}
