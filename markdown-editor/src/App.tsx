import { useState, useEffect } from 'react'
import Header from './components/Header/Header'
import Editor from './components/Editor/Editor'
import { useCollaboration } from './hooks/useCollaboration'
import './App.css'

function App() {
  const [documentId] = useState(() => {
    // In a real app, this would come from URL params or be created
    const params = new URLSearchParams(window.location.search);
    return params.get('doc') || 'default-document';
  });
  
  const [userName] = useState(() => {
    // Get user name from localStorage or prompt
    const saved = localStorage.getItem('markdown-editor-username');
    return saved || `User ${Math.floor(Math.random() * 1000)}`;
  });

  const {
    document,
    users,
    cursors,
    currentUser,
    isLoading,
    error,
    isConnected,
    updateContent,
    updateCursor,
    updateTitle,
  } = useCollaboration(documentId, userName);

  // Save username to localStorage
  useEffect(() => {
    localStorage.setItem('markdown-editor-username', userName);
  }, [userName]);

  const handleSave = () => {
    if (document) {
      console.log('Saving document:', document);
      // TODO: Implement actual save functionality
    }
  }

  const handleExport = () => {
    if (document) {
      const blob = new Blob([document.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.title}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  const handleTitleChange = (newTitle: string) => {
    updateTitle(newTitle);
  }

  if (isLoading) {
    return (
      <div className="app loading">
        <div className="loading-message">
          Connecting to collaborative editor...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <div className="error-message">
          <h2>Connection Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header 
        title={document?.title || 'Untitled Document'}
        onTitleChange={handleTitleChange}
        onSave={handleSave}
        onExport={handleExport}
      />
      <Editor 
        content={document?.content || ''}
        onContentChange={updateContent}
        onCursorChange={updateCursor}
        users={users}
        cursors={cursors}
        currentUserId={currentUser?.id}
        isConnected={isConnected}
      />
    </div>
  )
}

export default App
