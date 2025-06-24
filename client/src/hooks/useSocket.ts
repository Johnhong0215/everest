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
    
    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
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
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        if (data.type === 'new_message' || data.type === 'message_sent') {
          // Store the complete message data correctly
          setMessages(prev => [...prev, data]);
          
          // Show browser notification for new messages (only for received, not sent)
          if (data.type === 'new_message' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('New message', {
              body: data.message?.content || 'You have a new message',
              icon: '/favicon.ico'
            });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

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
