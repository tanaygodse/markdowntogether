package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"markdown-editor-backend/internal/models"
	"markdown-editor-backend/internal/storage"
	ws "markdown-editor-backend/internal/websocket"
	"markdown-editor-backend/pkg/types"
)

// Handlers contains all HTTP handlers
type Handlers struct {
	documentService *models.DocumentService
	userService     *models.UserService
	hub             *ws.Hub
}

// NewHandlers creates a new handlers instance
func NewHandlers(storage *storage.MemoryStorage, hub *ws.Hub) *Handlers {
	return &Handlers{
		documentService: models.NewDocumentService(storage),
		userService:     models.NewUserService(storage),
		hub:             hub,
	}
}

// CreateDocument handles document creation
func (h *Handlers) CreateDocument(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Title   string `json:"title"`
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	doc, err := h.documentService.CreateDocument(request.Title, request.Content)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

// GetDocument handles document retrieval
func (h *Handlers) GetDocument(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	documentID := r.URL.Query().Get("id")
	if documentID == "" {
		http.Error(w, "Document ID is required", http.StatusBadRequest)
		return
	}

	doc, err := h.documentService.GetDocument(documentID)
	if err != nil {
		if err == storage.ErrDocumentNotFound {
			http.Error(w, "Document not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	users, err := h.userService.GetDocumentUsers(documentID)
	if err != nil {
		log.Printf("Error getting document users: %v", err)
		users = []*types.User{}
	}

	response := types.DocumentSyncPayload{
		Document: *doc,
		Users:    make([]types.User, len(users)),
	}

	for i, user := range users {
		response.Users[i] = *user
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateUser handles user creation
func (h *Handlers) CreateUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	user, err := h.userService.CreateUser(request.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// HandleWebSocket handles WebSocket connections with enhanced message processing
func (h *Handlers) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}

	client := &ws.Client{
		Conn: conn,
		Hub:  h.hub,
		Send: make(chan []byte, 256),
	}

	// Don't register client until JOIN message is received
	go h.handleClientMessages(client)
	go client.WritePump()
}

// handleClientMessages processes messages from a WebSocket client
func (h *Handlers) handleClientMessages(client *ws.Client) {
	defer func() {
		if client.UserID != "" && client.DocumentID != "" {
			h.userService.LeaveDocument(client.UserID, client.DocumentID)
			
			// Broadcast user leave
			leaveMessage := types.WebSocketMessage{
				Type: types.MessageTypeLeave,
				Payload: types.LeavePayload{
					UserID: client.UserID,
				},
			}
			
			if messageBytes, err := json.Marshal(leaveMessage); err == nil {
				h.hub.BroadcastToDocument(client.DocumentID, messageBytes, client)
			}
			
			// Only unregister if client was actually registered (has UserID/DocumentID)
			h.hub.UnregisterClient(client)
		}
		
		client.Conn.Close()
	}()

	for {
		_, messageBytes, err := client.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var message types.WebSocketMessage
		if err := json.Unmarshal(messageBytes, &message); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		h.processMessage(client, &message)
	}
}

// processMessage handles different types of WebSocket messages
func (h *Handlers) processMessage(client *ws.Client, message *types.WebSocketMessage) {
	switch message.Type {
	case types.MessageTypeJoin:
		h.handleJoinMessage(client, message)
	case types.MessageTypeOperation:
		h.handleOperationMessage(client, message)
	case types.MessageTypeTitleUpdate:
		h.handleTitleUpdateMessage(client, message)
	case types.MessageTypeCursor:
		h.handleCursorMessage(client, message)
	case types.MessageTypeCreateRoom:
		h.handleCreateRoomMessage(client, message)
	case types.MessageTypeJoinRoom:
		h.handleJoinRoomMessage(client, message)
	default:
		log.Printf("Unknown message type: %s", message.Type)
	}
}

func (h *Handlers) handleJoinMessage(client *ws.Client, message *types.WebSocketMessage) {
	payloadBytes, _ := json.Marshal(message.Payload)
	var payload types.JoinPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		log.Printf("Error unmarshaling join payload: %v", err)
		return
	}

	client.UserID = payload.User.ID
	client.DocumentID = payload.DocumentID

	// Now register client to hub with proper UserID and DocumentID
	h.hub.RegisterClient(client)

	// Add user to storage first
	err := h.userService.AddUser(&payload.User)
	if err != nil {
		log.Printf("Error adding user to storage: %v", err)
		// Continue anyway, user might already exist
	}

	// Add user to document
	h.userService.JoinDocument(client.UserID, client.DocumentID)

	// Get current document state
	doc, err := h.documentService.GetDocument(client.DocumentID)
	if err != nil {
		// If document doesn't exist, create it with the specific ID
		if err == storage.ErrDocumentNotFound {
			doc, err = h.documentService.CreateDocumentWithID(
				client.DocumentID, 
				"Untitled Document", 
				"# Welcome to collaborative editing!\n\nStart typing to see real-time collaboration in action.",
			)
			if err != nil {
				log.Printf("Error creating document: %v", err)
				return
			}
		} else {
			log.Printf("Error getting document: %v", err)
			return
		}
	}

	// Get all users in the document
	users, err := h.userService.GetDocumentUsers(client.DocumentID)
	if err != nil {
		log.Printf("Error getting document users: %v", err)
		return
	}

	// Send document sync to the joining user
	syncPayload := types.DocumentSyncPayload{
		Document: *doc,
		Users:    make([]types.User, len(users)),
	}

	for i, user := range users {
		syncPayload.Users[i] = *user
	}

	syncMessage := types.WebSocketMessage{
		Type:    types.MessageTypeDocumentSync,
		Payload: syncPayload,
	}

	if syncBytes, err := json.Marshal(syncMessage); err == nil {
		client.Send <- syncBytes
	}

	// Note: No need to broadcast user join separately since DocumentSync already contains all users

	log.Printf("User %s joined document %s", client.UserID, client.DocumentID)
}

func (h *Handlers) handleOperationMessage(client *ws.Client, message *types.WebSocketMessage) {
	log.Printf("Received operation message from user %s for document %s", client.UserID, client.DocumentID)
	
	payloadBytes, _ := json.Marshal(message.Payload)
	var payload types.OperationPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		log.Printf("Error unmarshaling operation payload: %v", err)
		return
	}

	log.Printf("Operation details: %+v", payload.Operation)

	// Apply operation to document
	doc, err := h.documentService.ApplyOperation(payload.DocumentID, &payload.Operation)
	if err != nil {
		log.Printf("Error applying operation: %v", err)
		return
	}

	log.Printf("Operation applied successfully. Document version: %d, content length: %d", doc.Version, len(doc.Content))

	// Get document clients for debugging
	clients := h.hub.GetDocumentClients(client.DocumentID)
	log.Printf("Broadcasting operation to %d clients in document %s", len(clients)-1, client.DocumentID)

	// Broadcast operation to other clients
	broadcastMessage := types.WebSocketMessage{
		Type:    types.MessageTypeOperation,
		Payload: payload,
		UserID:  client.UserID,
	}

	if opBytes, err := json.Marshal(broadcastMessage); err == nil {
		h.hub.BroadcastToDocument(client.DocumentID, opBytes, client)
		log.Printf("Operation broadcast sent to other clients")
	} else {
		log.Printf("Error marshaling operation broadcast: %v", err)
	}

	// Also broadcast document update
	updateMessage := types.WebSocketMessage{
		Type: types.MessageTypeDocumentUpdate,
		Payload: types.DocumentUpdatePayload{
			Document: *doc,
		},
	}

	if updateBytes, err := json.Marshal(updateMessage); err == nil {
		h.hub.BroadcastToDocument(client.DocumentID, updateBytes, nil)
		log.Printf("Document update broadcast sent to all clients")
	} else {
		log.Printf("Error marshaling document update broadcast: %v", err)
	}
}

func (h *Handlers) handleCursorMessage(client *ws.Client, message *types.WebSocketMessage) {
	payloadBytes, _ := json.Marshal(message.Payload)
	var payload types.CursorPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		log.Printf("Error unmarshaling cursor payload: %v", err)
		return
	}

	// Update cursor position
	h.userService.UpdateCursor(payload.DocumentID, &payload.Position)

	// Broadcast cursor update to other clients
	broadcastMessage := types.WebSocketMessage{
		Type:    types.MessageTypeCursor,
		Payload: payload,
		UserID:  client.UserID,
	}

	if cursorBytes, err := json.Marshal(broadcastMessage); err == nil {
		h.hub.BroadcastToDocument(client.DocumentID, cursorBytes, client)
	}
}

func (h *Handlers) handleTitleUpdateMessage(client *ws.Client, message *types.WebSocketMessage) {
	log.Printf("Received title update message from user %s for document %s", client.UserID, client.DocumentID)
	
	payloadBytes, _ := json.Marshal(message.Payload)
	var payload types.TitleUpdatePayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		log.Printf("Error unmarshaling title update payload: %v", err)
		return
	}

	log.Printf("Title update details: %+v", payload)

	// Update document title
	doc, err := h.documentService.UpdateDocumentTitle(payload.DocumentID, payload.NewTitle)
	if err != nil {
		log.Printf("Error updating document title: %v", err)
		return
	}

	log.Printf("Title updated successfully. Document: %s, New title: %s", doc.ID, doc.Title)

	// Broadcast title update to all clients (including sender)
	broadcastMessage := types.WebSocketMessage{
		Type:    types.MessageTypeTitleUpdate,
		Payload: payload,
		UserID:  client.UserID,
	}

	if titleBytes, err := json.Marshal(broadcastMessage); err == nil {
		h.hub.BroadcastToDocument(client.DocumentID, titleBytes, nil) // nil means broadcast to all clients
		log.Printf("Title update broadcast sent to all clients")
	} else {
		log.Printf("Error marshaling title update broadcast: %v", err)
	}
}

func (h *Handlers) handleCreateRoomMessage(client *ws.Client, message *types.WebSocketMessage) {
	log.Printf("Received create room message")
	
	payloadBytes, _ := json.Marshal(message.Payload)
	var payload types.CreateRoomPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		log.Printf("Error unmarshaling create room payload: %v", err)
		h.sendError(client, "Invalid create room payload", "INVALID_PAYLOAD")
		return
	}

	log.Printf("Creating room with title: %s", payload.Title)

	// Create new room/document
	doc, err := h.documentService.CreateRoom(payload.Title, payload.Content)
	if err != nil {
		log.Printf("Error creating room: %v", err)
		h.sendError(client, "Failed to create room", "CREATE_ROOM_ERROR")
		return
	}

	// Set client details
	client.UserID = payload.User.ID
	client.DocumentID = doc.ID

	// Register client and add user to storage
	h.hub.RegisterClient(client)
	h.userService.AddUser(&payload.User)
	h.userService.JoinDocument(client.UserID, client.DocumentID)

	log.Printf("Room created successfully. Room code: %s, Document ID: %s", doc.RoomCode, doc.ID)

	// Send response back to client
	response := types.CreateRoomResponse{
		Document: *doc,
		RoomCode: doc.RoomCode,
	}

	responseMessage := types.WebSocketMessage{
		Type:    types.MessageTypeCreateRoom,
		Payload: response,
	}

	if responseBytes, err := json.Marshal(responseMessage); err == nil {
		client.Send <- responseBytes
		log.Printf("Create room response sent to client")
	} else {
		log.Printf("Error marshaling create room response: %v", err)
	}
}

func (h *Handlers) handleJoinRoomMessage(client *ws.Client, message *types.WebSocketMessage) {
	log.Printf("Received join room message")
	
	payloadBytes, _ := json.Marshal(message.Payload)
	var payload types.JoinRoomPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		log.Printf("Error unmarshaling join room payload: %v", err)
		h.sendError(client, "Invalid join room payload", "INVALID_PAYLOAD")
		return
	}

	log.Printf("Joining room with code: %s", payload.RoomCode)

	// Find document by room code
	doc, err := h.documentService.GetDocumentByRoomCode(payload.RoomCode)
	if err != nil {
		log.Printf("Error finding room: %v", err)
		h.sendError(client, "Room not found", "ROOM_NOT_FOUND")
		return
	}

	// Set client details
	client.UserID = payload.User.ID
	client.DocumentID = doc.ID

	// Register client and add user to storage
	h.hub.RegisterClient(client)
	h.userService.AddUser(&payload.User)
	h.userService.JoinDocument(client.UserID, client.DocumentID)

	// Get all users in the document
	users, err := h.userService.GetDocumentUsers(client.DocumentID)
	if err != nil {
		log.Printf("Error getting document users: %v", err)
		users = []*types.User{}
	}

	// Send document sync to the joining user
	syncPayload := types.DocumentSyncPayload{
		Document: *doc,
		Users:    make([]types.User, len(users)),
	}

	for i, user := range users {
		syncPayload.Users[i] = *user
	}

	syncMessage := types.WebSocketMessage{
		Type:    types.MessageTypeDocumentSync,
		Payload: syncPayload,
	}

	if syncBytes, err := json.Marshal(syncMessage); err == nil {
		client.Send <- syncBytes
		log.Printf("Document sync sent to joining user")
	}

	// Note: No need to broadcast user join separately since DocumentSync already contains all users

	log.Printf("User %s joined room %s successfully", client.UserID, payload.RoomCode)
}

func (h *Handlers) sendError(client *ws.Client, message, code string) {
	errorMessage := types.WebSocketMessage{
		Type: types.MessageTypeError,
		Payload: types.ErrorPayload{
			Message: message,
			Code:    code,
		},
	}

	if errorBytes, err := json.Marshal(errorMessage); err == nil {
		client.Send <- errorBytes
	}
}