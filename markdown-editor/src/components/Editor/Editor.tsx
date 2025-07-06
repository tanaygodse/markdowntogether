import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ToolbarAction, User, CursorPosition } from '../../types';
import Toolbar from '../Toolbar/Toolbar';
import UserPresence from '../UserPresence/UserPresence';
import './Editor.css';

interface EditorProps {
  content: string;
  onContentChange: (content: string, selectionStart: number) => void;
  onCursorChange?: (position: number, line: number, column: number) => void;
  users?: User[];
  cursors?: CursorPosition[];
  currentUserId?: string;
  isConnected?: boolean;
}

const Editor: React.FC<EditorProps> = ({ 
  content, 
  onContentChange, 
  onCursorChange,
  users = [],
  cursors = [],
  currentUserId,
  isConnected = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localContent, setLocalContent] = useState(content);
  const isRemoteUpdate = useRef(false);

  const handleToolbarAction = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let newContent = content;
    let newCursorPos = start;

    switch (action.type) {
      case 'bold':
        newContent = content.substring(0, start) + `**${selectedText}**` + content.substring(end);
        newCursorPos = selectedText ? end + 4 : start + 2;
        break;
      case 'italic':
        newContent = content.substring(0, start) + `*${selectedText}*` + content.substring(end);
        newCursorPos = selectedText ? end + 2 : start + 1;
        break;
      case 'strikethrough':
        newContent = content.substring(0, start) + `~~${selectedText}~~` + content.substring(end);
        newCursorPos = selectedText ? end + 4 : start + 2;
        break;
      case 'code':
        newContent = content.substring(0, start) + `\`${selectedText}\`` + content.substring(end);
        newCursorPos = selectedText ? end + 2 : start + 1;
        break;
      case 'heading':
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        newContent = content.substring(0, lineStart) + `# ${content.substring(lineStart)}`;
        newCursorPos = start + 2;
        break;
      case 'list-unordered':
        const ulLineStart = content.lastIndexOf('\n', start - 1) + 1;
        newContent = content.substring(0, ulLineStart) + `- ${content.substring(ulLineStart)}`;
        newCursorPos = start + 2;
        break;
      case 'list-ordered':
        const olLineStart = content.lastIndexOf('\n', start - 1) + 1;
        newContent = content.substring(0, olLineStart) + `1. ${content.substring(olLineStart)}`;
        newCursorPos = start + 3;
        break;
      case 'link':
        newContent = content.substring(0, start) + `[${selectedText || 'link text'}](url)` + content.substring(end);
        newCursorPos = selectedText ? start + selectedText.length + 3 : start + 1;
        break;
      case 'image':
        newContent = content.substring(0, start) + `![${selectedText || 'alt text'}](url)` + content.substring(end);
        newCursorPos = selectedText ? start + selectedText.length + 4 : start + 2;
        break;
    }

    onContentChange(newContent, textarea.selectionStart);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    
    // Don't trigger change if this is from a remote update
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    
    setLocalContent(newContent);
    onContentChange(newContent, e.target.selectionStart);
  };

  const handleCursorMove = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.target as HTMLTextAreaElement;
    const position = textarea.selectionStart;
    const content = textarea.value;
    
    // Calculate line and column
    const beforeCursor = content.substring(0, position);
    const lines = beforeCursor.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    onCursorChange?.(position, line, column);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          handleToolbarAction({ type: 'bold' });
          break;
        case 'i':
          e.preventDefault();
          handleToolbarAction({ type: 'italic' });
          break;
        case 'k':
          e.preventDefault();
          handleToolbarAction({ type: 'link' });
          break;
        case '`':
          e.preventDefault();
          handleToolbarAction({ type: 'code' });
          break;
        case 's':
          e.preventDefault();
          // Could trigger save functionality here
          break;
      }
    }
  };

  // Update local content when remote content changes
  useEffect(() => {
    console.log('Content prop changed:', { content, localContent });
    if (content !== localContent) {
      console.log('Setting remote content update');
      isRemoteUpdate.current = true;
      setLocalContent(content);
      
      // Also update the textarea value directly to ensure it reflects the change
      if (textareaRef.current) {
        textareaRef.current.value = content;
      }
    }
  }, [content]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const container = e.currentTarget.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    setSplitPosition(Math.max(20, Math.min(80, newPosition)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="editor-container">
      <UserPresence 
        users={users}
        cursors={cursors}
        currentUserId={currentUserId}
        isConnected={isConnected}
      />
      <Toolbar onAction={handleToolbarAction} />
      
      <div 
        className="editor-content"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="editor-pane" style={{ width: `${splitPosition}%` }}>
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            onSelect={handleCursorMove}
            onClick={handleCursorMove}
            onKeyUp={handleCursorMove}
            className="editor-textarea"
            placeholder="Start writing your markdown here..."
            spellCheck={false}
          />
        </div>
        
        <div 
          className="divider"
          onMouseDown={handleMouseDown}
          style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }}
        />
        
        <div className="preview-pane" style={{ width: `${100 - splitPosition}%` }}>
          <div className="preview-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <SyntaxHighlighter
                      style={oneDark as any}
                      language={match[1]}
                      PreTag="div"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {localContent || '*Start typing to see preview...*'}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;