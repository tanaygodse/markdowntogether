import { useState, useCallback, useRef } from 'react';
import type { Operation } from '../types';

interface OperationHistoryItem {
  operation: Operation;
  inverseOperation: Operation;
  timestamp: Date;
}

interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undoStack: OperationHistoryItem[];
  redoStack: OperationHistoryItem[];
}

export const useUndoRedo = (currentUserId: string | undefined) => {
  const [state, setState] = useState<UndoRedoState>({
    canUndo: false,
    canRedo: false,
    undoStack: [],
    redoStack: [],
  });

  const maxHistorySize = useRef(50); // Limit history to prevent memory issues

  // Add an operation to the undo stack
  const addOperation = useCallback((operation: Operation) => {
    // Only track operations from the current user
    if (!currentUserId || operation.userId !== currentUserId) {
      return;
    }

    const inverseOperation = createInverseOperation(operation);
    if (!inverseOperation) {
      return; // Skip if we can't create an inverse
    }

    const historyItem: OperationHistoryItem = {
      operation,
      inverseOperation,
      timestamp: new Date(),
    };

    setState(prev => {
      const newUndoStack = [...prev.undoStack, historyItem];
      
      // Limit stack size
      if (newUndoStack.length > maxHistorySize.current) {
        newUndoStack.shift();
      }

      return {
        ...prev,
        undoStack: newUndoStack,
        redoStack: [], // Clear redo stack when new operation is added
        canUndo: newUndoStack.length > 0,
        canRedo: false,
      };
    });
  }, [currentUserId]);

  // Undo the last operation
  const undo = useCallback((): Operation | null => {
    if (state.undoStack.length === 0) {
      return null;
    }

    const lastItem = state.undoStack[state.undoStack.length - 1];
    const undoOperation = lastItem.inverseOperation;

    setState(prev => {
      const newUndoStack = prev.undoStack.slice(0, -1);
      const newRedoStack = [...prev.redoStack, lastItem];

      return {
        ...prev,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: newUndoStack.length > 0,
        canRedo: true,
      };
    });

    return undoOperation;
  }, [state.undoStack]);

  // Redo the last undone operation
  const redo = useCallback((): Operation | null => {
    if (state.redoStack.length === 0) {
      return null;
    }

    const lastUndoneItem = state.redoStack[state.redoStack.length - 1];
    const redoOperation = lastUndoneItem.operation;

    setState(prev => {
      const newRedoStack = prev.redoStack.slice(0, -1);
      const newUndoStack = [...prev.undoStack, lastUndoneItem];

      return {
        ...prev,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: true,
        canRedo: newRedoStack.length > 0,
      };
    });

    return redoOperation;
  }, [state.redoStack]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setState({
      canUndo: false,
      canRedo: false,
      undoStack: [],
      redoStack: [],
    });
  }, []);

  return {
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    addOperation,
    undo,
    redo,
    clearHistory,
  };
};

// Create the inverse operation for a given operation
function createInverseOperation(operation: Operation): Operation | null {
  const baseInverseOp = {
    userId: operation.userId,
    timestamp: new Date(),
    version: operation.version, // Will be updated when sent
  };

  switch (operation.type) {
    case 'insert':
      // Inverse of insert is delete
      return {
        ...baseInverseOp,
        type: 'delete' as const,
        position: operation.position,
        length: operation.content?.length || 0,
      };

    case 'delete':
      // For delete operations, we need the deleted content to recreate it
      // This requires the content to be stored in the original operation
      if (!operation.content) {
        console.warn('Cannot create inverse of delete operation without content');
        return null;
      }
      
      return {
        ...baseInverseOp,
        type: 'insert' as const,
        position: operation.position,
        content: operation.content,
      };

    default:
      console.warn(`Unknown operation type: ${operation.type}`);
      return null;
  }
}

// Apply an operation to text and return the result
export function applyOperationToText(content: string, operation: Operation): string {
  switch (operation.type) {
    case 'insert':
      return content.slice(0, operation.position) + 
             (operation.content || '') + 
             content.slice(operation.position);
    
    case 'delete':
      const endPos = operation.position + (operation.length || 0);
      return content.slice(0, operation.position) + content.slice(endPos);
    
    default:
      return content;
  }
}

// Enhanced operation generation that preserves deleted content for undo
export function generateOperationsWithUndo(oldText: string, newText: string, userId: string): Operation[] {
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
  
  // Delete old text (store the deleted content for undo)
  if (oldEnd > i) {
    operations.push({
      type: 'delete',
      position: i,
      length: oldEnd - i,
      content: oldText.slice(i, oldEnd), // Store deleted content for undo
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