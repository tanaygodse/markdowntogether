import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useWebSocket } from './useWebSocket';
import type { 
  User, 
  Document, 
  CursorPosition, 
  Operation, 
  WebSocketMessage,
  DocumentSyncPayload,
  OperationPayload,
  CursorPayload,
  JoinPayload,
  LeavePayload,
  TitleUpdatePayload
} from '../types';
import { MessageTypes } from '../types';

interface CollaborationState {
  document: Document | null;
  users: User[];
  cursors: CursorPosition[];
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
}

export const useCollaboration = (documentId: string, userName: string) => {
  const { isConnected, on, off, service } = useWebSocket();
  const [state, setState] = useState<CollaborationState>({
    document: null,
    users: [],
    cursors: [],
    currentUser: null,
    isLoading: true,
    error: null,
  });

  const documentVersionRef = useRef(0);

  // Create current user
  useEffect(() => {
    if (!state.currentUser && userName) {
      const user: User = {
        id: uuidv4(),
        name: userName,
        color: generateUserColor(),
        joinedAt: new Date(),
      };
      setState(prev => ({ ...prev, currentUser: user }));
    }
  }, [userName, state.currentUser]);

  // Join document when connected and user is ready
  useEffect(() => {
    if (isConnected && state.currentUser && documentId) {
      service.joinDocument(state.currentUser, documentId);
    }
  }, [isConnected, state.currentUser, documentId, service]);

  const applyRemoteOperation = useCallback((operation: Operation) => {
    console.log('applyRemoteOperation called with:', operation);
    setState(prev => {
      if (!prev.document) {
        console.log('No document to apply operation to');
        return prev;
      }

      console.log('Current document content:', prev.document.content);
      const newContent = applyOperationToText(prev.document.content, operation);
      console.log('New content after operation:', newContent);
      
      const updatedDocument = {
        ...prev.document,
        content: newContent,
        version: operation.version,
        lastModified: new Date(),
      };
      
      console.log('Updated document state:', updatedDocument);
      return {
        ...prev,
        document: updatedDocument,
      };
    });
    documentVersionRef.current = operation.version;
  }, []);

  // Set up WebSocket event listeners
  useEffect(() => {
    const handleDocumentSync = (message: WebSocketMessage) => {
      const payload = message.payload as DocumentSyncPayload;
      setState(prev => ({
        ...prev,
        document: payload.document,
        users: payload.users,
        isLoading: false,
        error: null,
      }));
      documentVersionRef.current = payload.document.version;
    };

    const handleUserJoin = (message: WebSocketMessage) => {
      const payload = message.payload as JoinPayload;
      setState(prev => ({
        ...prev,
        users: [...prev.users, payload.user].filter((user, index, arr) => 
          arr.findIndex(u => u.id === user.id) === index
        ),
      }));
    };

    const handleUserLeave = (message: WebSocketMessage) => {
      const payload = message.payload as LeavePayload;
      setState(prev => ({
        ...prev,
        users: prev.users.filter(user => user.id !== payload.userId),
        cursors: prev.cursors.filter(cursor => cursor.userId !== payload.userId),
      }));
    };

    const handleOperation = (message: WebSocketMessage) => {
      const payload = message.payload as OperationPayload;
      
      console.log('Received operation:', payload);
      
      // Don't apply operations from ourselves
      if (payload.operation.userId === state.currentUser?.id) {
        console.log('Ignoring operation from self:', payload.operation.userId);
        return;
      }

      console.log('Applying remote operation:', payload.operation);
      applyRemoteOperation(payload.operation);
    };

    const handleCursor = (message: WebSocketMessage) => {
      const payload = message.payload as CursorPayload;
      
      // Don't show our own cursor
      if (payload.position.userId === state.currentUser?.id) {
        return;
      }

      setState(prev => ({
        ...prev,
        cursors: [
          ...prev.cursors.filter(cursor => cursor.userId !== payload.position.userId),
          payload.position,
        ],
      }));
    };

    const handleTitleUpdate = (message: WebSocketMessage) => {
      const payload = message.payload as TitleUpdatePayload;
      
      console.log('Received title update:', payload);
      
      setState(prev => {
        if (!prev.document || prev.document.id !== payload.documentId) {
          console.log('Title update not for current document');
          return prev;
        }

        console.log('Updating document title from', prev.document.title, 'to', payload.newTitle);
        
        return {
          ...prev,
          document: {
            ...prev.document,
            title: payload.newTitle,
            lastModified: new Date(),
          },
        };
      });
    };

    const handleError = (message: WebSocketMessage) => {
      setState(prev => ({
        ...prev,
        error: message.payload.message,
        isLoading: false,
      }));
    };

    on(MessageTypes.DOCUMENT_SYNC, handleDocumentSync);
    on(MessageTypes.JOIN, handleUserJoin);
    on(MessageTypes.LEAVE, handleUserLeave);
    on(MessageTypes.OPERATION, handleOperation);
    on(MessageTypes.TITLE_UPDATE, handleTitleUpdate);
    on(MessageTypes.CURSOR, handleCursor);
    on(MessageTypes.ERROR, handleError);

    return () => {
      off(MessageTypes.DOCUMENT_SYNC, handleDocumentSync);
      off(MessageTypes.JOIN, handleUserJoin);
      off(MessageTypes.LEAVE, handleUserLeave);
      off(MessageTypes.OPERATION, handleOperation);
      off(MessageTypes.TITLE_UPDATE, handleTitleUpdate);
      off(MessageTypes.CURSOR, handleCursor);
      off(MessageTypes.ERROR, handleError);
    };
  }, [on, off, state.currentUser?.id, applyRemoteOperation]);

  const sendOperation = useCallback((type: 'insert' | 'delete', position: number, content?: string, length?: number) => {
    if (!state.currentUser || !state.document) {
      console.log('Cannot send operation: missing user or document');
      return;
    }

    const operation: Operation = {
      type,
      position,
      content,
      length,
      userId: state.currentUser.id,
      timestamp: new Date(),
      version: documentVersionRef.current + 1,
    };

    console.log('Sending operation:', operation);

    // Apply operation locally first
    setState(prev => {
      if (!prev.document) return prev;

      const newContent = applyOperationToText(prev.document.content, operation);
      console.log('Local operation applied, new content:', newContent);
      
      return {
        ...prev,
        document: {
          ...prev.document,
          content: newContent,
          version: operation.version,
          lastModified: new Date(),
        },
      };
    });

    documentVersionRef.current = operation.version;
    service.sendOperation(operation, documentId);
  }, [state.currentUser, state.document, documentId, service]);

  const updateCursor = useCallback((position: number, line: number, column: number) => {
    if (!state.currentUser) return;

    const cursorPosition: CursorPosition = {
      userId: state.currentUser.id,
      position,
      line,
      column,
    };

    service.sendCursorPosition(cursorPosition, documentId);
  }, [state.currentUser, documentId, service]);

  const updateContent = useCallback((newContent: string, _selectionStart: number) => {
    if (!state.document) {
      console.log('Cannot update content: no document');
      return;
    }

    const oldContent = state.document.content;
    console.log('updateContent called:', { oldContent, newContent });
    
    const operations = generateOperations(oldContent, newContent, state.currentUser?.id || '');
    console.log('Generated operations:', operations);
    
    operations.forEach(op => {
      if (op.type === 'insert' || op.type === 'delete') {
        sendOperation(op.type, op.position, op.content, op.length);
      }
    });
  }, [state.document, state.currentUser?.id, sendOperation]);

  const updateTitle = useCallback((newTitle: string) => {
    if (!state.document) {
      console.log('Cannot update title: no document');
      return;
    }

    console.log('updateTitle called:', { oldTitle: state.document.title, newTitle });

    // Update local state first for immediate feedback
    setState(prev => {
      if (!prev.document) return prev;
      
      return {
        ...prev,
        document: {
          ...prev.document,
          title: newTitle,
          lastModified: new Date(),
        },
      };
    });

    // Send title update to server
    service.sendTitleUpdate(newTitle, state.document.id);
  }, [state.document, service]);

  return {
    ...state,
    isConnected,
    sendOperation,
    updateCursor,
    updateContent,
    updateTitle,
  };
};

// Helper functions
function generateUserColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function applyOperationToText(content: string, operation: Operation): string {
  const text = content;
  
  switch (operation.type) {
    case 'insert':
      return text.slice(0, operation.position) + 
             (operation.content || '') + 
             text.slice(operation.position);
    
    case 'delete':
      const endPos = operation.position + (operation.length || 0);
      return text.slice(0, operation.position) + text.slice(endPos);
    
    default:
      return text;
  }
}

function generateOperations(oldText: string, newText: string, userId: string): Operation[] {
  const operations: Operation[] = [];
  
  // Simple diff algorithm - find the first difference
  let i = 0;
  while (i < Math.min(oldText.length, newText.length) && oldText[i] === newText[i]) {
    i++;
  }
  
  // Find the last difference
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > i && newEnd > i && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  
  // Delete old text
  if (oldEnd > i) {
    operations.push({
      type: 'delete',
      position: i,
      length: oldEnd - i,
      userId,
      timestamp: new Date(),
      version: 0, // Will be set by the caller
    });
  }
  
  // Insert new text
  if (newEnd > i) {
    operations.push({
      type: 'insert',
      position: i,
      content: newText.slice(i, newEnd),
      userId,
      timestamp: new Date(),
      version: 0, // Will be set by the caller
    });
  }
  
  return operations;
}