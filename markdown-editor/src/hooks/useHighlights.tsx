import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Operation, User } from '../types';

interface Highlight {
  id: string;
  start: number;
  end: number;
  color: string;
  userId: string;
  timestamp: Date;
  type: 'insert' | 'delete' | 'cursor';
}

export const useHighlights = (currentUserId: string | undefined) => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const highlightTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const nextHighlightId = useRef(0);

  // Duration for highlights to fade out (in milliseconds)
  const HIGHLIGHT_DURATION = 2000;

  // Add a highlight for a remote operation
  const addOperationHighlight = useCallback((operation: Operation, userColor: string) => {
    // Don't highlight our own operations
    if (!currentUserId || operation.userId === currentUserId) {
      return;
    }

    const highlightId = `highlight-${nextHighlightId.current++}`;
    let start = operation.position;
    let end = operation.position;
    let type: 'insert' | 'delete' = operation.type === 'insert' ? 'insert' : 'delete';

    // Calculate highlight range based on operation type
    if (operation.type === 'insert' && operation.content) {
      end = start + operation.content.length;
    } else if (operation.type === 'delete' && operation.length) {
      end = start + operation.length;
    }

    const highlight: Highlight = {
      id: highlightId,
      start,
      end,
      color: userColor,
      userId: operation.userId,
      timestamp: new Date(),
      type,
    };

    setHighlights(prev => [...prev, highlight]);

    // Set timeout to remove highlight
    const timeoutId = setTimeout(() => {
      setHighlights(prev => prev.filter(h => h.id !== highlightId));
      highlightTimeoutRefs.current.delete(highlightId);
    }, HIGHLIGHT_DURATION);

    highlightTimeoutRefs.current.set(highlightId, timeoutId);
  }, [currentUserId]);

  // Add a cursor highlight
  const addCursorHighlight = useCallback((position: number, userId: string, userColor: string) => {
    // Don't highlight our own cursor
    if (!currentUserId || userId === currentUserId) {
      return;
    }

    const highlightId = `cursor-${userId}`;
    
    // Remove existing cursor highlight for this user
    setHighlights(prev => prev.filter(h => h.id !== highlightId));
    
    // Clear existing timeout
    const existingTimeout = highlightTimeoutRefs.current.get(highlightId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const highlight: Highlight = {
      id: highlightId,
      start: position,
      end: position,
      color: userColor,
      userId,
      timestamp: new Date(),
      type: 'cursor',
    };

    setHighlights(prev => [...prev, highlight]);

    // Set timeout to remove cursor highlight
    const timeoutId = setTimeout(() => {
      setHighlights(prev => prev.filter(h => h.id !== highlightId));
      highlightTimeoutRefs.current.delete(highlightId);
    }, HIGHLIGHT_DURATION);

    highlightTimeoutRefs.current.set(highlightId, timeoutId);
  }, [currentUserId]);

  // Clear all highlights
  const clearHighlights = useCallback(() => {
    // Clear all timeouts
    highlightTimeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    highlightTimeoutRefs.current.clear();
    
    setHighlights([]);
  }, []);

  // Clear highlights on unmount
  useEffect(() => {
    return () => {
      highlightTimeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Apply highlights to text content for display
  const applyHighlights = useCallback((content: string): React.ReactNode[] => {
    if (highlights.length === 0) {
      return [content];
    }

    // Sort highlights by start position
    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);
    
    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedHighlights.forEach((highlight, idx) => {
      // Add text before this highlight
      if (highlight.start > lastIndex) {
        result.push(content.slice(lastIndex, highlight.start));
      }

      // Add highlighted text
      const highlightedText = content.slice(highlight.start, highlight.end);
      if (highlightedText) {
        const className = `highlight highlight-${highlight.type}`;
        const style = {
          backgroundColor: `${highlight.color}33`, // 20% opacity
          borderBottom: `2px solid ${highlight.color}`,
          animation: 'highlight-fade 2s ease-out forwards',
        };

        result.push(
          <span
            key={highlight.id}
            className={className}
            style={style}
            title={`Edit by user ${highlight.userId}`}
          >
            {highlightedText}
          </span>
        );
      }

      lastIndex = Math.max(lastIndex, highlight.end);
    });

    // Add remaining text
    if (lastIndex < content.length) {
      result.push(content.slice(lastIndex));
    }

    return result;
  }, [highlights]);

  return {
    highlights,
    addOperationHighlight,
    addCursorHighlight,
    clearHighlights,
    applyHighlights,
  };
};