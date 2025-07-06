package storage

import (
	"errors"
	"sync"
	"time"

	"markdown-editor-backend/pkg/types"
)

var (
	ErrDocumentNotFound = errors.New("document not found")
	ErrUserNotFound     = errors.New("user not found")
)

// MemoryStorage provides in-memory storage for documents and users
type MemoryStorage struct {
	documents map[string]*types.Document
	users     map[string]*types.User
	docUsers  map[string][]string // documentID -> userIDs
	cursors   map[string]map[string]*types.CursorPosition // documentID -> userID -> position
	mutex     sync.RWMutex
}

// NewMemoryStorage creates a new in-memory storage instance
func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{
		documents: make(map[string]*types.Document),
		users:     make(map[string]*types.User),
		docUsers:  make(map[string][]string),
		cursors:   make(map[string]map[string]*types.CursorPosition),
	}
}

// Document operations
func (ms *MemoryStorage) CreateDocument(doc *types.Document) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()
	
	doc.LastModified = time.Now()
	doc.Version = 1
	ms.documents[doc.ID] = doc
	ms.docUsers[doc.ID] = make([]string, 0)
	ms.cursors[doc.ID] = make(map[string]*types.CursorPosition)
	
	return nil
}

func (ms *MemoryStorage) GetDocument(id string) (*types.Document, error) {
	ms.mutex.RLock()
	defer ms.mutex.RUnlock()
	
	doc, exists := ms.documents[id]
	if !exists {
		return nil, ErrDocumentNotFound
	}
	
	return doc, nil
}

func (ms *MemoryStorage) UpdateDocument(doc *types.Document) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()
	
	existing, exists := ms.documents[doc.ID]
	if !exists {
		return ErrDocumentNotFound
	}
	
	doc.LastModified = time.Now()
	doc.Version = existing.Version + 1
	ms.documents[doc.ID] = doc
	
	return nil
}

func (ms *MemoryStorage) DeleteDocument(id string) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()
	
	delete(ms.documents, id)
	delete(ms.docUsers, id)
	delete(ms.cursors, id)
	
	return nil
}

// User operations
func (ms *MemoryStorage) AddUser(user *types.User) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()
	
	user.JoinedAt = time.Now()
	ms.users[user.ID] = user
	
	return nil
}

func (ms *MemoryStorage) GetUser(id string) (*types.User, error) {
	ms.mutex.RLock()
	defer ms.mutex.RUnlock()
	
	user, exists := ms.users[id]
	if !exists {
		return nil, ErrUserNotFound
	}
	
	return user, nil
}

func (ms *MemoryStorage) RemoveUser(id string) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()
	
	delete(ms.users, id)
	
	// Remove user from all documents
	for docID, userIDs := range ms.docUsers {
		for i, userID := range userIDs {
			if userID == id {
				ms.docUsers[docID] = append(userIDs[:i], userIDs[i+1:]...)
				break
			}
		}
		// Remove user's cursor position
		if cursors, exists := ms.cursors[docID]; exists {
			delete(cursors, id)
		}
	}
	
	return nil
}

// Document-User associations
func (ms *MemoryStorage) AddUserToDocument(documentID, userID string) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()
	
	// Check if user is already in the document
	for _, existingUserID := range ms.docUsers[documentID] {
		if existingUserID == userID {
			return nil // User already in document
		}
	}
	
	ms.docUsers[documentID] = append(ms.docUsers[documentID], userID)
	return nil
}

func (ms *MemoryStorage) RemoveUserFromDocument(documentID, userID string) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()
	
	userIDs := ms.docUsers[documentID]
	for i, id := range userIDs {
		if id == userID {
			ms.docUsers[documentID] = append(userIDs[:i], userIDs[i+1:]...)
			break
		}
	}
	
	// Remove user's cursor position
	if cursors, exists := ms.cursors[documentID]; exists {
		delete(cursors, userID)
	}
	
	return nil
}

func (ms *MemoryStorage) GetDocumentUsers(documentID string) ([]*types.User, error) {
	ms.mutex.RLock()
	defer ms.mutex.RUnlock()
	
	userIDs, exists := ms.docUsers[documentID]
	if !exists {
		return []*types.User{}, nil
	}
	
	users := make([]*types.User, 0, len(userIDs))
	for _, userID := range userIDs {
		if user, exists := ms.users[userID]; exists {
			users = append(users, user)
		}
	}
	
	return users, nil
}

// Cursor operations
func (ms *MemoryStorage) UpdateCursor(documentID string, position *types.CursorPosition) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()
	
	if _, exists := ms.cursors[documentID]; !exists {
		ms.cursors[documentID] = make(map[string]*types.CursorPosition)
	}
	
	ms.cursors[documentID][position.UserID] = position
	return nil
}

func (ms *MemoryStorage) GetCursors(documentID string) ([]*types.CursorPosition, error) {
	ms.mutex.RLock()
	defer ms.mutex.RUnlock()
	
	cursors, exists := ms.cursors[documentID]
	if !exists {
		return []*types.CursorPosition{}, nil
	}
	
	positions := make([]*types.CursorPosition, 0, len(cursors))
	for _, position := range cursors {
		positions = append(positions, position)
	}
	
	return positions, nil
}

func (ms *MemoryStorage) RemoveCursor(documentID, userID string) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()
	
	if cursors, exists := ms.cursors[documentID]; exists {
		delete(cursors, userID)
	}
	
	return nil
}