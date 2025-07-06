package types

import (
	"time"
)

// Document represents a markdown document
type Document struct {
	ID           string    `json:"id"`
	RoomCode     string    `json:"roomCode"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	LastModified time.Time `json:"lastModified"`
	Version      int       `json:"version"`
}

// User represents a connected user
type User struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Color    string    `json:"color"`
	JoinedAt time.Time `json:"joinedAt"`
}

// CursorPosition represents a user's cursor position
type CursorPosition struct {
	UserID   string `json:"userId"`
	Position int    `json:"position"`
	Line     int    `json:"line"`
	Column   int    `json:"column"`
}

// Operation represents a text operation
type Operation struct {
	Type      string `json:"type"` // "insert", "delete", "retain"
	Position  int    `json:"position"`
	Content   string `json:"content,omitempty"`
	Length    int    `json:"length,omitempty"`
	UserID    string `json:"userId"`
	Timestamp time.Time `json:"timestamp"`
	Version   int    `json:"version"`
}

// WebSocketMessage represents messages sent over WebSocket
type WebSocketMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
	UserID  string      `json:"userId,omitempty"`
}

// Message types
const (
	MessageTypeJoin          = "join"
	MessageTypeLeave         = "leave"
	MessageTypeDocumentUpdate = "document_update"
	MessageTypeTitleUpdate   = "title_update"
	MessageTypeOperation     = "operation"
	MessageTypeCursor        = "cursor"
	MessageTypeUserList      = "user_list"
	MessageTypeDocumentSync  = "document_sync"
	MessageTypeCreateRoom    = "create_room"
	MessageTypeJoinRoom      = "join_room"
	MessageTypeError         = "error"
)

// Payloads for different message types
type JoinPayload struct {
	User       User     `json:"user"`
	DocumentID string   `json:"documentId"`
}

type LeavePayload struct {
	UserID string `json:"userId"`
}

type DocumentUpdatePayload struct {
	Document Document `json:"document"`
}

type OperationPayload struct {
	Operation  Operation `json:"operation"`
	DocumentID string    `json:"documentId"`
}

type CursorPayload struct {
	Position   CursorPosition `json:"position"`
	DocumentID string         `json:"documentId"`
}

type UserListPayload struct {
	Users []User `json:"users"`
}

type DocumentSyncPayload struct {
	Document Document `json:"document"`
	Users    []User   `json:"users"`
}

type TitleUpdatePayload struct {
	DocumentID string `json:"documentId"`
	NewTitle   string `json:"newTitle"`
}

type CreateRoomPayload struct {
	User      User   `json:"user"`
	Title     string `json:"title"`
	Content   string `json:"content"`
}

type CreateRoomResponse struct {
	Document Document `json:"document"`
	RoomCode string   `json:"roomCode"`
}

type JoinRoomPayload struct {
	User     User   `json:"user"`
	RoomCode string `json:"roomCode"`
}

type ErrorPayload struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}