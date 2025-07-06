import React, { useState } from 'react';
import './Header.css';

interface HeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onExport: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onTitleChange, onSave, onExport }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);

  const handleTitleSubmit = () => {
    onTitleChange(editTitle);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    }
    if (e.key === 'Escape') {
      setEditTitle(title);
      setIsEditing(false);
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="title-section">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleKeyPress}
              className="title-input"
              autoFocus
            />
          ) : (
            <h1 
              className="document-title"
              onClick={() => setIsEditing(true)}
            >
              {title}
            </h1>
          )}
        </div>
      </div>
      
      <div className="header-right">
        <button className="header-btn" onClick={onSave}>
          Save
        </button>
        <button className="header-btn" onClick={onExport}>
          Export
        </button>
      </div>
    </header>
  );
};

export default Header;