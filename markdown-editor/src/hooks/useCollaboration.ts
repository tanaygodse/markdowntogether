import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useWebSocket } from './useWebSocket';
import { useUndoRedo, generateOperationsWithUndo } from './useUndoRedo';
import { useHighlights } from './useHighlights';
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
  const isUndoRedoOperation = useRef(false);
  
  // Initialize undo/redo functionality
  const undoRedo = useUndoRedo(state.currentUser?.id);
  
  // Initialize highlighting functionality
  const highlights = useHighlights(state.currentUser?.id);

  // Helper function to find user color by ID
  const getUserColor = useCallback((userId: string): string => {
    const user = state.users.find(u => u.id === userId);
    return user?.color || '#999999';
  }, [state.users]);

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
        users: deduplicateUsersByName(payload.users, prev.currentUser?.id),
        isLoading: false,
        error: null,
      }));
      documentVersionRef.current = payload.document.version;
    };

    const handleUserJoin = (message: WebSocketMessage) => {
      const payload = message.payload as JoinPayload;
      setState(prev => ({
        ...prev,
        users: prev.users.some(u => u.id === payload.user.id)
          ? prev.users // User already exists, no change needed
          : deduplicateUsersByName([...prev.users, payload.user], prev.currentUser?.id), // Add user and deduplicate by name
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
      
      // Add visual highlight for remote operation
      const userColor = getUserColor(payload.operation.userId);
      highlights.addOperationHighlight(payload.operation, userColor);
      
      applyRemoteOperation(payload.operation);
    };

    const handleCursor = (message: WebSocketMessage) => {
      const payload = message.payload as CursorPayload;
      
      // Don't show our own cursor
      if (payload.position.userId === state.currentUser?.id) {
        return;
      }

      // Add visual highlight for cursor movement
      const userColor = getUserColor(payload.position.userId);
      highlights.addCursorHighlight(payload.position.position, payload.position.userId, userColor);

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

    // Add to undo history (only for user-initiated operations, not undo/redo)
    if (!isUndoRedoOperation.current) {
      undoRedo.addOperation(operation);
    }

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
  }, [state.currentUser, state.document, documentId, service, undoRedo]);

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
    
    // Use enhanced operation generation that preserves deleted content for undo
    const operations = generateOperationsWithUndo(oldContent, newContent, state.currentUser?.id || '');
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

  // Undo function
  const performUndo = useCallback(() => {
    if (!undoRedo.canUndo || !state.document) {
      return;
    }

    const undoOperation = undoRedo.undo();
    if (undoOperation) {
      console.log('Performing undo:', undoOperation);
      
      // Mark this as an undo operation to prevent it from being added to history again
      isUndoRedoOperation.current = true;
      
      // Apply the undo operation
      sendOperation(
        undoOperation.type as 'insert' | 'delete',
        undoOperation.position,
        undoOperation.content,
        undoOperation.length
      );
      
      // Reset the flag after a short delay
      setTimeout(() => {
        isUndoRedoOperation.current = false;
      }, 10);
    }
  }, [undoRedo, state.document, sendOperation]);

  // Redo function
  const performRedo = useCallback(() => {
    if (!undoRedo.canRedo || !state.document) {
      return;
    }

    const redoOperation = undoRedo.redo();
    if (redoOperation) {
      console.log('Performing redo:', redoOperation);
      
      // Mark this as a redo operation to prevent it from being added to history again
      isUndoRedoOperation.current = true;
      
      // Apply the redo operation
      sendOperation(
        redoOperation.type as 'insert' | 'delete',
        redoOperation.position,
        redoOperation.content,
        redoOperation.length
      );
      
      // Reset the flag after a short delay
      setTimeout(() => {
        isUndoRedoOperation.current = false;
      }, 10);
    }
  }, [undoRedo, state.document, sendOperation]);

  return {
    ...state,
    isConnected,
    sendOperation,
    updateCursor,
    updateContent,
    updateTitle,
    // Undo/Redo functionality
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    undo: performUndo,
    redo: performRedo,
    clearHistory: undoRedo.clearHistory,
    // Highlighting functionality
    highlights: highlights.highlights,
    applyHighlights: highlights.applyHighlights,
    clearHighlights: highlights.clearHighlights,
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

function deduplicateUsersByName(users: User[], currentUserId?: string): User[] {
  // Create a map to store the most recent user for each name
  const userMap = new Map<string, User>();
  
  users.forEach(user => {
    const existingUser = userMap.get(user.name);
    
    // Always keep the current user in their own view
    if (user.id === currentUserId) {
      userMap.set(user.name, user);
    }
    // For other users, keep the most recent one
    else if (!existingUser || new Date(user.joinedAt) > new Date(existingUser.joinedAt)) {
      // Don't override if current user is already stored for this name
      if (!currentUserId || existingUser?.id !== currentUserId) {
        userMap.set(user.name, user);
      }
    }
  });
  
  return Array.from(userMap.values());
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

