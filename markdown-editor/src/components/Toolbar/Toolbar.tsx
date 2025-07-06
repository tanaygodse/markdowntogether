import React from 'react';
import type { ToolbarAction } from '../../types';
import UndoRedoControls from '../UndoRedoControls/UndoRedoControls';
import './Toolbar.css';

interface ToolbarProps {
  onAction: (action: ToolbarAction) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onAction, 
  canUndo = false, 
  canRedo = false, 
  onUndo = () => {}, 
  onRedo = () => {} 
}) => {
  const toolbarItems = [
    { type: 'bold' as const, icon: 'B', title: 'Bold (Ctrl+B)' },
    { type: 'italic' as const, icon: 'I', title: 'Italic (Ctrl+I)' },
    { type: 'strikethrough' as const, icon: 'S', title: 'Strikethrough' },
    { type: 'code' as const, icon: '</>', title: 'Code' },
    { type: 'heading' as const, icon: 'H1', title: 'Heading' },
    { type: 'list-unordered' as const, icon: '•', title: 'Bullet List' },
    { type: 'list-ordered' as const, icon: '1.', title: 'Numbered List' },
    { type: 'link' as const, icon: '🔗', title: 'Link' },
    { type: 'image' as const, icon: '🖼️', title: 'Image' },
  ];

  return (
    <div className="toolbar">
      <UndoRedoControls
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
      />
      
      {toolbarItems.map((item) => (
        <button
          key={item.type}
          className={`toolbar-btn ${item.type === 'bold' ? 'bold' : ''} ${item.type === 'italic' ? 'italic' : ''}`}
          onClick={() => onAction({ type: item.type })}
          title={item.title}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
};

export default Toolbar;