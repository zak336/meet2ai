import { useEffect, useRef, useState } from 'react';
import WebSocketService from '../services/websocket-service';

interface UseWebSocketOptions {
  sessionId: string;
  userId: string;
  onAIResponse?: (data: any) => void;
  onWhiteboardUpdate?: (data: any) => void;
  onCodeUpdate?: (data: any) => void;
  onWebRTCSignal?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL;
    
    if (!wsUrl) {
      setError('WebSocket URL not configured');
      return;
    }

    const ws = new WebSocketService(wsUrl, options.sessionId, options.userId);
    wsRef.current = ws;

    // Set up event handlers
    if (options.onAIResponse) {
      ws.on('ai-response', options.onAIResponse);
    }
    if (options.onWhiteboardUpdate) {
      ws.on('whiteboard', options.onWhiteboardUpdate);
    }
    if (options.onCodeUpdate) {
      ws.on('code', options.onCodeUpdate);
    }
    if (options.onWebRTCSignal) {
      ws.on('webrtc-signal', options.onWebRTCSignal);
    }
    if (options.onError) {
      ws.on('error', options.onError);
    }

    ws.on('connection-failed', () => {
      setError('Failed to connect to server');
      setConnected(false);
    });

    // Connect
    ws.connect()
      .then(() => setConnected(true))
      .catch((err) => {
        setError(err.message);
        setConnected(false);
      });

    // Cleanup
    return () => {
      ws.disconnect();
    };
  }, [options.sessionId, options.userId]);

  return {
    connected,
    error,
    ws: wsRef.current,
    sendChatMessage: (prompt: string, messages: any[], whiteboardText: string, image?: string, screenShareOn?: boolean) => {
      wsRef.current?.sendChatMessage(prompt, messages, whiteboardText, image, screenShareOn);
    },
    syncWhiteboard: (data: any) => {
      wsRef.current?.syncWhiteboard(data);
    },
    syncCode: (data: any) => {
      wsRef.current?.syncCode(data);
    },
    sendSignal: (targetUserId: string, signal: any, fromUserId: string) => {
      wsRef.current?.sendSignal(targetUserId, signal, fromUserId);
    }
  };
}
