package main

import (
	"log"
	"net/http"

	"github.com/rs/cors"
	"markdown-editor-backend/internal/handlers"
	"markdown-editor-backend/internal/storage"
	"markdown-editor-backend/internal/websocket"
)

func main() {
	// Initialize storage
	storage := storage.NewMemoryStorage()

	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	// Initialize handlers
	h := handlers.NewHandlers(storage, hub)

	// Create router
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/documents", h.CreateDocument)
	mux.HandleFunc("/api/documents/get", h.GetDocument)
	mux.HandleFunc("/api/users", h.CreateUser)
	
	// WebSocket route
	mux.HandleFunc("/ws", h.HandleWebSocket)

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000"}, // Frontend URLs
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(mux)

	// Start server
	port := ":8080"
	log.Printf("Server starting on port %s", port)
	log.Printf("WebSocket endpoint: ws://localhost%s/ws", port)
	log.Printf("API endpoint: http://localhost%s/api", port)
	
	if err := http.ListenAndServe(port, handler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}