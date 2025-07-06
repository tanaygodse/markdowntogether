import type { WebSocketMessage, User, CursorPosition, Operation, CreateRoomPayload, JoinRoomPayload } from '../types';
import { MessageTypes } from '../types';

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  constructor(url: string = 'ws://localhost:8080/ws') {
    this.url = url;
  }

  connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnecting = false;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect().catch(() => {
          // Reconnection failed, will try again
        });
      }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }

    // Also trigger generic message handlers
    const genericHandlers = this.eventHandlers.get('*');
    if (genericHandlers) {
      genericHandlers.forEach(handler => handler(message));
    }
  }

  on(eventType: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  // Specific message sending methods
  joinDocument(user: User, documentId: string): void {
    this.send({
      type: MessageTypes.JOIN,
      payload: {
        user,
        documentId,
      },
    });
  }

  leaveDocument(userId: string): void {
    this.send({
      type: MessageTypes.LEAVE,
      payload: {
        userId,
      },
    });
  }

  sendOperation(operation: Operation, documentId: string): void {
    this.send({
      type: MessageTypes.OPERATION,
      payload: {
        operation,
        documentId,
      },
      userId: operation.userId,
    });
  }

  sendCursorPosition(position: CursorPosition, documentId: string): void {
    this.send({
      type: MessageTypes.CURSOR,
      payload: {
        position,
        documentId,
      },
    });
  }

  sendTitleUpdate(newTitle: string, documentId: string): void {
    this.send({
      type: MessageTypes.TITLE_UPDATE,
      payload: {
        newTitle,
        documentId,
      },
    });
  }

  createRoom(user: User, title: string, content: string): void {
    this.send({
      type: MessageTypes.CREATE_ROOM,
      payload: {
        user,
        title,
        content,
      },
    });
  }

  joinRoom(user: User, roomCode: string): void {
    this.send({
      type: MessageTypes.JOIN_ROOM,
      payload: {
        user,
        roomCode,
      },
    });
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const websocketService = new WebSocketService();