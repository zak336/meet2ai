// WebSocket Service for AWS API Gateway
type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private sessionId: string;
  private userId: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string, sessionId: string, userId: string) {
    this.url = url;
    this.sessionId = sessionId;
    this.userId = userId;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.url}?sessionId=${this.sessionId}&userId=${this.userId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.handleReconnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('connection-failed', {});
    }
  }

  private handleMessage(message: any) {
    const { type, data } = message;
    this.emit(type, data);
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: MessageHandler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  send(action: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action,
        sessionId: this.sessionId,
        data
      }));
    } else {
      console.error('WebSocket not connected');
    }
  }

  // Send chat message to AI
  sendChatMessage(prompt: string, messages: any[], whiteboardText: string, image?: string, screenShareOn?: boolean) {
    this.send('chat', {
      prompt,
      messages,
      whiteboardText,
      image,
      screenShareOn
    });
  }

  // Sync whiteboard state
  syncWhiteboard(whiteboardData: any) {
    this.send('whiteboard', whiteboardData);
  }

  // Sync code editor state
  syncCode(codeData: any) {
    this.send('code', codeData);
  }

  // Send WebRTC signaling data
  sendSignal(targetUserId: string, signal: any, fromUserId: string) {
    this.send('webrtc-signal', {
      targetUserId,
      signal,
      fromUserId
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export default WebSocketService;
