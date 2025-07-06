package models

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"markdown-editor-backend/internal/storage"
	"markdown-editor-backend/pkg/types"
)

// DocumentService handles document-related operations
type DocumentService struct {
	storage *storage.MemoryStorage
}

// NewDocumentService creates a new document service
func NewDocumentService(storage *storage.MemoryStorage) *DocumentService {
	return &DocumentService{
		storage: storage,
	}
}

// CreateDocument creates a new document
func (ds *DocumentService) CreateDocument(title, content string) (*types.Document, error) {
	doc := &types.Document{
		ID:           uuid.New().String(),
		Title:        title,
		Content:      content,
		LastModified: time.Now(),
		Version:      1,
	}

	err := ds.storage.CreateDocument(doc)
	if err != nil {
		return nil, err
	}

	return doc, nil
}

// CreateDocumentWithID creates a new document with a specific ID
func (ds *DocumentService) CreateDocumentWithID(id, title, content string) (*types.Document, error) {
	doc := &types.Document{
		ID:           id,
		Title:        title,
		Content:      content,
		LastModified: time.Now(),
		Version:      1,
	}

	err := ds.storage.CreateDocument(doc)
	if err != nil {
		return nil, err
	}

	return doc, nil
}

// GetDocument retrieves a document by ID
func (ds *DocumentService) GetDocument(id string) (*types.Document, error) {
	return ds.storage.GetDocument(id)
}

// UpdateDocument updates an existing document
func (ds *DocumentService) UpdateDocument(doc *types.Document) error {
	return ds.storage.UpdateDocument(doc)
}

// UpdateDocumentTitle updates only the title of a document
func (ds *DocumentService) UpdateDocumentTitle(documentID, newTitle string) (*types.Document, error) {
	doc, err := ds.storage.GetDocument(documentID)
	if err != nil {
		return nil, err
	}

	doc.Title = newTitle
	doc.LastModified = time.Now()

	err = ds.storage.UpdateDocument(doc)
	if err != nil {
		return nil, err
	}

	return doc, nil
}

// ApplyOperation applies a text operation to a document
func (ds *DocumentService) ApplyOperation(documentID string, operation *types.Operation) (*types.Document, error) {
	doc, err := ds.storage.GetDocument(documentID)
	if err != nil {
		return nil, err
	}

	// Apply the operation to the document content
	newContent, err := ds.applyOperationToText(doc.Content, operation)
	if err != nil {
		return nil, err
	}

	doc.Content = newContent
	doc.Version++
	doc.LastModified = time.Now()

	err = ds.storage.UpdateDocument(doc)
	if err != nil {
		return nil, err
	}

	return doc, nil
}

// applyOperationToText applies a single operation to text content
func (ds *DocumentService) applyOperationToText(content string, op *types.Operation) (string, error) {
	runes := []rune(content)
	
	switch op.Type {
	case "insert":
		if op.Position < 0 || op.Position > len(runes) {
			return content, fmt.Errorf("invalid insert position: %d", op.Position)
		}
		
		insertRunes := []rune(op.Content)
		result := make([]rune, 0, len(runes)+len(insertRunes))
		result = append(result, runes[:op.Position]...)
		result = append(result, insertRunes...)
		result = append(result, runes[op.Position:]...)
		
		return string(result), nil
		
	case "delete":
		if op.Position < 0 || op.Position >= len(runes) {
			return content, fmt.Errorf("invalid delete position: %d", op.Position)
		}
		
		endPos := op.Position + op.Length
		if endPos > len(runes) {
			endPos = len(runes)
		}
		
		result := make([]rune, 0, len(runes)-op.Length)
		result = append(result, runes[:op.Position]...)
		result = append(result, runes[endPos:]...)
		
		return string(result), nil
		
	default:
		return content, fmt.Errorf("unknown operation type: %s", op.Type)
	}
}

// UserService handles user-related operations
type UserService struct {
	storage *storage.MemoryStorage
}

// NewUserService creates a new user service
func NewUserService(storage *storage.MemoryStorage) *UserService {
	return &UserService{
		storage: storage,
	}
}

// CreateUser creates a new user with a random color
func (us *UserService) CreateUser(name string) (*types.User, error) {
	colors := []string{
		"#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
		"#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
	}

	user := &types.User{
		ID:       uuid.New().String(),
		Name:     name,
		Color:    colors[rand.Intn(len(colors))],
		JoinedAt: time.Now(),
	}

	err := us.storage.AddUser(user)
	if err != nil {
		return nil, err
	}

	return user, nil
}

// AddUser adds an existing user to storage
func (us *UserService) AddUser(user *types.User) error {
	return us.storage.AddUser(user)
}

// GetUser retrieves a user by ID
func (us *UserService) GetUser(id string) (*types.User, error) {
	return us.storage.GetUser(id)
}

// JoinDocument adds a user to a document
func (us *UserService) JoinDocument(userID, documentID string) error {
	return us.storage.AddUserToDocument(documentID, userID)
}

// LeaveDocument removes a user from a document
func (us *UserService) LeaveDocument(userID, documentID string) error {
	return us.storage.RemoveUserFromDocument(documentID, userID)
}

// GetDocumentUsers retrieves all users in a document
func (us *UserService) GetDocumentUsers(documentID string) ([]*types.User, error) {
	return us.storage.GetDocumentUsers(documentID)
}

// UpdateCursor updates a user's cursor position
func (us *UserService) UpdateCursor(documentID string, position *types.CursorPosition) error {
	return us.storage.UpdateCursor(documentID, position)
}

// GetCursors retrieves all cursor positions in a document
func (us *UserService) GetCursors(documentID string) ([]*types.CursorPosition, error) {
	return us.storage.GetCursors(documentID)
}

// RemoveUser removes a user completely
func (us *UserService) RemoveUser(userID string) error {
	return us.storage.RemoveUser(userID)
}