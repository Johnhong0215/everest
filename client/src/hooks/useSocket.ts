import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';

export function useSocket() {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Authenticate the connection
      ws.send(JSON.stringify({
        type: 'auth',
        userId: user.id,
      }));
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat') {
        setMessages(prev => [...prev, data.message]);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isAuthenticated, user]);

  const sendMessage = (eventId: number, content: string, messageType = 'text', metadata?: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        eventId,
        content,
        messageType,
        metadata,
      }));
    }
  };

  return {
    isConnected,
    messages,
    sendMessage,
  };
}
