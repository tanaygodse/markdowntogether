import React from 'react';
import './UndoRedoControls.css';

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const UndoRedoControls: React.FC<UndoRedoControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  return (
    <div className="undo-redo-controls">
      <button
        className={`undo-redo-btn ${!canUndo ? 'disabled' : ''}`}
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Cmd+Z)"
        aria-label="Undo"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
          <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
        </svg>
      </button>
      
      <button
        className={`undo-redo-btn ${!canRedo ? 'disabled' : ''}`}
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Cmd+Shift+Z)"
        aria-label="Redo"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
          <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966a.25.25 0 0 1 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
        </svg>
      </button>
    </div>
  );
};

export default UndoRedoControls;