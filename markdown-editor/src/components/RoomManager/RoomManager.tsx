import React, { useState } from 'react';
import './RoomManager.css';
import type { User } from '../../types';

interface RoomManagerProps {
  user: User;
  onCreateRoom: (title: string, content: string) => void;
  onJoinRoom: (roomCode: string) => void;
  isConnecting: boolean;
  error: string | null;
}

const RoomManager: React.FC<RoomManagerProps> = ({
  user,
  onCreateRoom,
  onJoinRoom,
  isConnecting,
  error
}) => {
  const [mode, setMode] = useState<'selection' | 'create' | 'join'>('selection');
  const [roomCode, setRoomCode] = useState('');
  const [title, setTitle] = useState('Untitled Document');
  const [content, setContent] = useState('# Welcome to collaborative editing!\n\nStart typing to see real-time collaboration in action.');

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateRoom(title, content);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase());
    }
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().slice(0, 6);
    setRoomCode(value);
  };

  if (mode === 'selection') {
    return (
      <div className="room-manager">
        <div className="room-manager-container">
          <header className="room-manager-header">
            <h1>Collaborative Markdown Editor</h1>
            <p>Welcome, {user.name}!</p>
          </header>

          <div className="room-options">
            <button
              className="room-option-btn create-btn"
              onClick={() => setMode('create')}
              disabled={isConnecting}
            >
              <div className="btn-icon">+</div>
              <div className="btn-content">
                <h3>Create New Room</h3>
                <p>Start a new collaborative document</p>
              </div>
            </button>

            <button
              className="room-option-btn join-btn"
              onClick={() => setMode('join')}
              disabled={isConnecting}
            >
              <div className="btn-icon">→</div>
              <div className="btn-content">
                <h3>Join Existing Room</h3>
                <p>Enter a room code to join</p>
              </div>
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="room-manager">
        <div className="room-manager-container">
          <header className="room-manager-header">
            <button 
              className="back-btn"
              onClick={() => setMode('selection')}
              disabled={isConnecting}
            >
              ← Back
            </button>
            <h1>Create New Room</h1>
          </header>

          <form onSubmit={handleCreateRoom} className="room-form">
            <div className="form-group">
              <label htmlFor="title">Document Title</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
                disabled={isConnecting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">Initial Content</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter initial document content"
                rows={10}
                disabled={isConnecting}
              />
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={isConnecting}
            >
              {isConnecting ? 'Creating...' : 'Create Room'}
            </button>
          </form>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="room-manager">
        <div className="room-manager-container">
          <header className="room-manager-header">
            <button 
              className="back-btn"
              onClick={() => setMode('selection')}
              disabled={isConnecting}
            >
              ← Back
            </button>
            <h1>Join Room</h1>
          </header>

          <form onSubmit={handleJoinRoom} className="room-form">
            <div className="form-group">
              <label htmlFor="roomCode">Room Code</label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={handleRoomCodeChange}
                placeholder="Enter 6-character room code"
                maxLength={6}
                disabled={isConnecting}
                required
                className="room-code-input"
              />
              <small>Enter the 6-character room code provided by the room creator</small>
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={isConnecting || roomCode.length !== 6}
            >
              {isConnecting ? 'Joining...' : 'Join Room'}
            </button>
          </form>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default RoomManager;