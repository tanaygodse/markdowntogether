import { useEffect, useRef, useState } from 'react';
import { websocketService, type WebSocketEventHandler } from '../services/websocket';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventHandlersRef = useRef<Map<string, WebSocketEventHandler[]>>(new Map());

  useEffect(() => {
    const connect = async () => {
      try {
        await websocketService.connect();
        setIsConnected(true);
        setError(null);
      } catch (err) {
        setError('Failed to connect to WebSocket server');
        setIsConnected(false);
      }
    };

    connect();

    // Monitor connection status
    const checkConnection = setInterval(() => {
      setIsConnected(websocketService.isConnected());
    }, 1000);

    return () => {
      clearInterval(checkConnection);
      websocketService.disconnect();
    };
  }, []);

  const on = (eventType: string, handler: WebSocketEventHandler) => {
    if (!eventHandlersRef.current.has(eventType)) {
      eventHandlersRef.current.set(eventType, []);
    }
    eventHandlersRef.current.get(eventType)!.push(handler);
    websocketService.on(eventType, handler);
  };

  const off = (eventType: string, handler: WebSocketEventHandler) => {
    const handlers = eventHandlersRef.current.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
    websocketService.off(eventType, handler);
  };

  // Cleanup handlers on unmount
  useEffect(() => {
    return () => {
      eventHandlersRef.current.forEach((handlers, eventType) => {
        handlers.forEach(handler => {
          websocketService.off(eventType, handler);
        });
      });
      eventHandlersRef.current.clear();
    };
  }, []);

  return {
    isConnected,
    error,
    on,
    off,
    service: websocketService,
  };
};