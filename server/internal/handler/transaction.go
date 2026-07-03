package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jimixoso/truesplit/internal/idempotency"
	"github.com/jimixoso/truesplit/internal/ledger"
	"github.com/jimixoso/truesplit/internal/store"
)

type splitRequest struct {
	MemberID    string `json:"member_id"`
	AmountCents int64  `json:"amount_cents"`
}

type transactionRequest struct {
	PayerMemberID string         `json:"payer_member_id"`
	AmountCents   int64          `json:"amount_cents"`
	Description   string         `json:"description"`
	Splits        []splitRequest `json:"splits"`
}

func (s *Server) handlePostTransaction(w http.ResponseWriter, r *http.Request) {
	groupID := r.PathValue("group_id")

	idempKey := r.Header.Get("Idempotency-Key")
	if idempKey == "" {
		writeError(w, http.StatusBadRequest, "Idempotency-Key header is required")
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "cannot read request body")
		return
	}

	var req transactionRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.PayerMemberID == "" || req.AmountCents <= 0 || len(req.Splits) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "payer_member_id, amount_cents > 0, and splits are required")
		return
	}

	// Validate split totals against the ledger invariant before touching the DB.
	ledgerSplits := make([]ledger.Split, len(req.Splits))
	for i, sp := range req.Splits {
		ledgerSplits[i] = ledger.Split{MemberID: sp.MemberID, AmountCents: sp.AmountCents}
	}
	if err := ledger.ValidateSplits(req.AmountCents, ledgerSplits); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	hash := idempotency.HashBody(body)

	responseBody, statusCode, err := idempotency.Resolve(
		r.Context(), s.pool, s.rdb, groupID, idempKey, hash,
		func(ctx context.Context, tx pgx.Tx) ([]byte, int, error) {
			splits := make([]store.SplitParam, len(req.Splits))
			for i, sp := range req.Splits {
				splits[i] = store.SplitParam{MemberID: sp.MemberID, AmountCents: sp.AmountCents}
			}
			expense, err := s.store.InsertExpenseWithLedger(ctx, tx, store.InsertExpenseParams{
				GroupID:        groupID,
				PayerMemberID:  req.PayerMemberID,
				AmountCents:    req.AmountCents,
				Description:    req.Description,
				IdempotencyKey: idempKey,
				Splits:         splits,
			})
			if err != nil {
				return nil, http.StatusInternalServerError, err
			}
			b, _ := json.Marshal(expense)
			return b, http.StatusCreated, nil
		},
	)

	if err != nil {
		switch {
		case errors.Is(err, idempotency.ErrHashMismatch):
			writeError(w, http.StatusConflict, "idempotency key reused with a different request payload")
		case errors.Is(err, idempotency.ErrInFlight):
			writeError(w, http.StatusConflict, "duplicate request in flight — retry shortly")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	// Notify SSE subscribers that the ledger has changed.
	event, _ := json.Marshal(map[string]string{
		"type":     "LEDGER_MUTATED",
		"group_id": groupID,
	})
	s.hub.Publish(groupID, event)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(responseBody) //nolint:errcheck
}
