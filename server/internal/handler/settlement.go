package handler

import (
	"net/http"

	"github.com/jimixoso/truesplit/internal/settlement"
)

func (s *Server) handleGetSettlements(w http.ResponseWriter, r *http.Request) {
	groupID := r.PathValue("group_id")

	balances, err := s.store.GetBalances(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch balances")
		return
	}

	payments := settlement.Compute(balances)
	if payments == nil {
		payments = []settlement.Payment{}
	}
	writeJSON(w, http.StatusOK, payments)
}
