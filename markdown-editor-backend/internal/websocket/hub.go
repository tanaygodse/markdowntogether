package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"markdown-editor-backend/pkg/types"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin (adjust for production)
		return true
	},
}

// Client represents a WebSocket client
type Client struct {
	ID         string
	Conn       *websocket.Conn
	Hub        *Hub
	Send       chan []byte
	DocumentID string
	UserID     string
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	documents  map[string]map[*Client]bool // documentID -> clients
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		documents:  make(map[string]map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message)
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	h.clients[client] = true
	
	if _, exists := h.documents[client.DocumentID]; !exists {
		h.documents[client.DocumentID] = make(map[*Client]bool)
	}
	h.documents[client.DocumentID][client] = true

	log.Printf("Client %s registered for document %s", client.UserID, client.DocumentID)
}

func (h *Hub) unregisterClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.Send)

		if docClients, exists := h.documents[client.DocumentID]; exists {
			delete(docClients, client)
			if len(docClients) == 0 {
				delete(h.documents, client.DocumentID)
			}
		}

		log.Printf("Client %s unregistered from document %s", client.UserID, client.DocumentID)
	}
}

func (h *Hub) broadcastMessage(message []byte) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	for client := range h.clients {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
			delete(h.clients, client)
		}
	}
}

// BroadcastToDocument sends a message to all clients in a specific document
func (h *Hub) BroadcastToDocument(documentID string, message []byte, excludeClient *Client) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	if docClients, exists := h.documents[documentID]; exists {
		for client := range docClients {
			if client != excludeClient {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client)
					delete(docClients, client)
				}
			}
		}
	}
}

// GetDocumentClients returns all clients connected to a specific document
func (h *Hub) GetDocumentClients(documentID string) []*Client {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	var clients []*Client
	if docClients, exists := h.documents[documentID]; exists {
		for client := range docClients {
			clients = append(clients, client)
		}
	}
	return clients
}

// RegisterClient registers a new client
func (h *Hub) RegisterClient(client *Client) {
	h.register <- client
}

// UnregisterClient unregisters a client
func (h *Hub) UnregisterClient(client *Client) {
	h.unregister <- client
}

// WritePump handles outgoing messages to the client
func (c *Client) WritePump() {
	defer c.Conn.Close()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.Conn.WriteMessage(websocket.TextMessage, message)
		}
	}
}

// readPump handles incoming messages from the client
func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	for {
		_, messageBytes, err := c.Conn.ReadMessage()
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

		// Handle the message based on its type
		c.handleMessage(&message)
	}
}

// writePump handles outgoing messages to the client
func (c *Client) writePump() {
	defer c.Conn.Close()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			c.Conn.WriteMessage(websocket.TextMessage, message)
		}
	}
}

// handleMessage processes incoming WebSocket messages
func (c *Client) handleMessage(message *types.WebSocketMessage) {
	switch message.Type {
	case types.MessageTypeJoin:
		c.handleJoin(message)
	case types.MessageTypeOperation:
		c.handleOperation(message)
	case types.MessageTypeCursor:
		c.handleCursor(message)
	default:
		log.Printf("Unknown message type: %s", message.Type)
	}
}

func (c *Client) handleJoin(message *types.WebSocketMessage) {
	payloadBytes, _ := json.Marshal(message.Payload)
	var payload types.JoinPayload
	json.Unmarshal(payloadBytes, &payload)

	c.UserID = payload.User.ID
	c.DocumentID = payload.DocumentID

	log.Printf("User %s joined document %s", c.UserID, c.DocumentID)
}

func (c *Client) handleOperation(message *types.WebSocketMessage) {
	// Broadcast operation to other clients in the same document
	messageBytes, _ := json.Marshal(message)
	c.Hub.BroadcastToDocument(c.DocumentID, messageBytes, c)
}

func (c *Client) handleCursor(message *types.WebSocketMessage) {
	// Broadcast cursor position to other clients in the same document
	messageBytes, _ := json.Marshal(message)
	c.Hub.BroadcastToDocument(c.DocumentID, messageBytes, c)
}