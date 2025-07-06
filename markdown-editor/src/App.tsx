import { useState, useEffect } from 'react'
import Header from './components/Header/Header'
import Editor from './components/Editor/Editor'
import RoomManager from './components/RoomManager/RoomManager'
import { useCollaboration } from './hooks/useCollaboration'
import { useWebSocket } from './hooks/useWebSocket'
import type { User, CreateRoomResponse, WebSocketMessage } from './types'
import { MessageTypes } from './types'
import { v4 as uuidv4 } from 'uuid'
import './App.css'

function App() {
  const [mode, setMode] = useState<'room-selection' | 'editor'>('room-selection');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const { isConnected, on, off, service } = useWebSocket();

  // Initialize user name - only manage the name, not the full user object
  const [userName] = useState(() => {
    // Get user name from localStorage or generate one
    const saved = localStorage.getItem('markdown-editor-username');
    return saved || `User ${Math.floor(Math.random() * 1000)}`;
  });

  // Save username to localStorage
  useEffect(() => {
    localStorage.setItem('markdown-editor-username', userName);
  }, [userName]);

  // Initialize currentUser for room operations only
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Create temporary user for room operations
  useEffect(() => {
    if (!currentUser) {
      const user: User = {
        id: uuidv4(),
        name: userName,
        color: generateUserColor(),
        joinedAt: new Date(),
      };
      setCurrentUser(user);
    }
  }, [userName, currentUser]);

  // Set up room-related WebSocket handlers
  useEffect(() => {
    const handleCreateRoomResponse = (message: WebSocketMessage) => {
      setIsConnecting(false);
      const response = message.payload as CreateRoomResponse;
      setDocumentId(response.document.id);
      setMode('editor');
      setRoomError(null);
      
      // Update URL with room code
      const url = new URL(window.location.href);
      url.searchParams.set('room', response.roomCode);
      window.history.pushState(null, '', url.toString());
    };

    const handleJoinRoomSuccess = (message: WebSocketMessage) => {
      setIsConnecting(false);
      if (message.type === MessageTypes.DOCUMENT_SYNC) {
        const payload = message.payload;
        setDocumentId(payload.document.id);
        setMode('editor');
        setRoomError(null);
        
        // Update URL with room code
        const url = new URL(window.location.href);
        url.searchParams.set('room', payload.document.roomCode);
        window.history.pushState(null, '', url.toString());
      }
    };

    const handleError = (message: WebSocketMessage) => {
      setIsConnecting(false);
      const errorPayload = message.payload;
      setRoomError(errorPayload.message || 'An error occurred');
    };

    on(MessageTypes.CREATE_ROOM, handleCreateRoomResponse);
    on(MessageTypes.DOCUMENT_SYNC, handleJoinRoomSuccess);
    on(MessageTypes.ERROR, handleError);

    return () => {
      off(MessageTypes.CREATE_ROOM, handleCreateRoomResponse);
      off(MessageTypes.DOCUMENT_SYNC, handleJoinRoomSuccess);
      off(MessageTypes.ERROR, handleError);
    };
  }, [on, off]);

  // Check for room code in URL on app start
  useEffect(() => {
    if (currentUser && isConnected) {
      const params = new URLSearchParams(window.location.search);
      const roomCode = params.get('room');
      
      if (roomCode) {
        setIsConnecting(true);
        service.joinRoom(currentUser, roomCode);
      }
    }
  }, [currentUser, isConnected, service]);

  const collaboration = useCollaboration(documentId || '', userName);

  const handleCreateRoom = (title: string, content: string) => {
    if (!currentUser) return;
    setIsConnecting(true);
    setRoomError(null);
    service.createRoom(currentUser, title, content);
  };

  const handleJoinRoom = (roomCode: string) => {
    if (!currentUser) return;
    setIsConnecting(true);
    setRoomError(null);
    service.joinRoom(currentUser, roomCode);
  };

  const handleSave = () => {
    if (collaboration.document) {
      console.log('Saving document:', collaboration.document);
      // TODO: Implement actual save functionality
    }
  };

  const handleExport = () => {
    if (collaboration.document) {
      const blob = new Blob([collaboration.document.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${collaboration.document.title}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    collaboration.updateTitle(newTitle);
  };

  // Show room manager if not in editor mode
  if (mode === 'room-selection' && currentUser) {
    return (
      <RoomManager
        user={currentUser}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        isConnecting={isConnecting}
        error={roomError}
      />
    );
  }

  // Show loading state
  if (collaboration.isLoading || !currentUser) {
    return (
      <div className="app loading">
        <div className="loading-message">
          Connecting to collaborative editor...
        </div>
      </div>
    );
  }

  // Show collaboration error
  if (collaboration.error) {
    return (
      <div className="app error">
        <div className="error-message">
          <h2>Connection Error</h2>
          <p>{collaboration.error}</p>
          <button onClick={() => window.location.reload()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Show editor
  return (
    <div className="app">
      <Header 
        title={collaboration.document?.title || 'Untitled Document'}
        onTitleChange={handleTitleChange}
        onSave={handleSave}
        onExport={handleExport}
        roomCode={collaboration.document?.roomCode}
      />
      <Editor 
        content={collaboration.document?.content || ''}
        onContentChange={collaboration.updateContent}
        onCursorChange={collaboration.updateCursor}
        users={collaboration.users}
        cursors={collaboration.cursors}
        currentUserId={collaboration.currentUser?.id}
        isConnected={collaboration.isConnected}
        canUndo={collaboration.canUndo}
        canRedo={collaboration.canRedo}
        onUndo={collaboration.undo}
        onRedo={collaboration.redo}
        applyHighlights={collaboration.applyHighlights}
      />
    </div>
  );
}

// Helper function to generate user colors
function generateUserColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default App
