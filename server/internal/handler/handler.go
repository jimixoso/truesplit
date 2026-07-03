package handler

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jimixoso/truesplit/internal/sse"
	"github.com/jimixoso/truesplit/internal/store"
	"github.com/redis/go-redis/v9"
)

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	pool  *pgxpool.Pool
	rdb   *redis.Client
	hub   *sse.Hub
	store *store.Store
}

func NewServer(pool *pgxpool.Pool, rdb *redis.Client, hub *sse.Hub) *Server {
	return &Server{
		pool:  pool,
		rdb:   rdb,
		hub:   hub,
		store: store.New(pool),
	}
}

// Routes registers all API routes on mux and returns it.
func (s *Server) Routes(mux *http.ServeMux) {
	// Group management
	mux.HandleFunc("GET /groups", s.handleListGroups)
	mux.HandleFunc("POST /groups", s.handleCreateGroup)
	// Member management
	mux.HandleFunc("GET /groups/{group_id}/members", s.handleListMembers)
	mux.HandleFunc("POST /groups/{group_id}/members", s.handleAddMember)
	// Expense / ledger
	mux.HandleFunc("POST /groups/{group_id}/transactions", s.handlePostTransaction)
	mux.HandleFunc("GET /groups/{group_id}/balances", s.handleGetBalances)
	mux.HandleFunc("GET /groups/{group_id}/settlements", s.handleGetSettlements)
	mux.HandleFunc("GET /groups/{group_id}/ledger", s.handleGetLedger)
	mux.HandleFunc("GET /groups/{group_id}/stream", s.handleStream)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
