package handler

import (
	"net/http"

	"github.com/jimixoso/truesplit/internal/store"
)

func (s *Server) handleGetBalances(w http.ResponseWriter, r *http.Request) {
	groupID := r.PathValue("group_id")

	balances, err := s.store.GetBalances(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch balances")
		return
	}
	if balances == nil {
		balances = []store.BalanceRow{}
	}
	writeJSON(w, http.StatusOK, balances)
}
