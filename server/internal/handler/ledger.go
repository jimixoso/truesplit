package handler

import (
	"net/http"

	"github.com/jimixoso/truesplit/internal/store"
)

func (s *Server) handleGetLedger(w http.ResponseWriter, r *http.Request) {
	groupID := r.PathValue("group_id")

	entries, err := s.store.GetLedger(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch ledger")
		return
	}
	if entries == nil {
		entries = []store.LedgerEntryRow{}
	}
	writeJSON(w, http.StatusOK, entries)
}
