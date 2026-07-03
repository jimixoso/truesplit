package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// ---- types ----------------------------------------------------------------

type InsertExpenseParams struct {
	GroupID        string
	PayerMemberID  string
	AmountCents    int64
	Description    string
	IdempotencyKey string
	Splits         []SplitParam
}

type SplitParam struct {
	MemberID    string
	AmountCents int64
}

type ExpenseResponse struct {
	ID             string    `json:"expense_id"`
	GroupID        string    `json:"group_id"`
	PayerMemberID  string    `json:"payer_member_id"`
	AmountCents    int64     `json:"amount_cents"`
	Description    string    `json:"description"`
	IdempotencyKey string    `json:"idempotency_key"`
	CreatedAt      time.Time `json:"created_at"`
}

type Group struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Member struct {
	ID          string    `json:"id"`
	GroupID     string    `json:"group_id"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
}

type BalanceRow struct {
	MemberID    string `json:"member_id"`
	DisplayName string `json:"display_name"`
	NetCents    int64  `json:"net_cents"`
}

type LedgerEntryRow struct {
	ID          string    `json:"id"`
	MemberName  string    `json:"member_name"`
	AmountCents int64     `json:"amount_cents"`
	EntryType   string    `json:"entry_type"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// ---- mutations -------------------------------------------------------------

// InsertExpenseWithLedger inserts an expense, its splits, and double-entry ledger
// legs inside an already-open transaction. The caller owns commit/rollback.
func (s *Store) InsertExpenseWithLedger(ctx context.Context, tx pgx.Tx, p InsertExpenseParams) (ExpenseResponse, error) {
	var res ExpenseResponse
	err := tx.QueryRow(ctx, `
		INSERT INTO expenses
			(group_id, payer_member_id, amount_cents, description, idempotency_key)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, group_id, payer_member_id, amount_cents, description, idempotency_key, created_at
	`, p.GroupID, p.PayerMemberID, p.AmountCents, p.Description, p.IdempotencyKey).
		Scan(&res.ID, &res.GroupID, &res.PayerMemberID, &res.AmountCents,
			&res.Description, &res.IdempotencyKey, &res.CreatedAt)
	if err != nil {
		return res, fmt.Errorf("insert expense: %w", err)
	}

	// expense_splits
	for _, sp := range p.Splits {
		if _, err := tx.Exec(ctx, `
			INSERT INTO expense_splits (expense_id, member_id, amount_cents)
			VALUES ($1, $2, $3)
		`, res.ID, sp.MemberID, sp.AmountCents); err != nil {
			return res, fmt.Errorf("insert split for member %s: %w", sp.MemberID, err)
		}
	}

	// double-entry ledger: payer is CREDITed, each split member is DEBITed
	if _, err := tx.Exec(ctx, `
		INSERT INTO ledger_entries (group_id, expense_id, member_id, amount_cents, entry_type)
		VALUES ($1, $2, $3, $4, 'CREDIT')
	`, p.GroupID, res.ID, p.PayerMemberID, p.AmountCents); err != nil {
		return res, fmt.Errorf("insert credit entry: %w", err)
	}
	for _, sp := range p.Splits {
		if _, err := tx.Exec(ctx, `
			INSERT INTO ledger_entries (group_id, expense_id, member_id, amount_cents, entry_type)
			VALUES ($1, $2, $3, $4, 'DEBIT')
		`, p.GroupID, res.ID, sp.MemberID, sp.AmountCents); err != nil {
			return res, fmt.Errorf("insert debit entry for member %s: %w", sp.MemberID, err)
		}
	}

	return res, nil
}

// ---- group / member mutations -----------------------------------------------

func (s *Store) ListGroups(ctx context.Context) ([]Group, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, created_at FROM groups ORDER BY created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}
	defer rows.Close()
	var out []Group
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.Name, &g.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (s *Store) CreateGroup(ctx context.Context, name string) (Group, error) {
	var g Group
	err := s.pool.QueryRow(ctx,
		`INSERT INTO groups (name) VALUES ($1) RETURNING id, name, created_at`,
		name).Scan(&g.ID, &g.Name, &g.CreatedAt)
	return g, err
}

func (s *Store) ListMembers(ctx context.Context, groupID string) ([]Member, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, group_id, display_name, created_at FROM group_members
		 WHERE group_id = $1 ORDER BY created_at ASC`, groupID)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	defer rows.Close()
	var out []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.GroupID, &m.DisplayName, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// AddMember creates a new user and adds them to the group in one transaction.
func (s *Store) AddMember(ctx context.Context, groupID, displayName string) (Member, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Member{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var userID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO users (name) VALUES ($1) RETURNING id`, displayName).
		Scan(&userID); err != nil {
		return Member{}, fmt.Errorf("insert user: %w", err)
	}

	var m Member
	if err := tx.QueryRow(ctx,
		`INSERT INTO group_members (group_id, user_id, display_name)
		 VALUES ($1, $2, $3)
		 RETURNING id, group_id, display_name, created_at`,
		groupID, userID, displayName).
		Scan(&m.ID, &m.GroupID, &m.DisplayName, &m.CreatedAt); err != nil {
		return Member{}, fmt.Errorf("insert group_member: %w", err)
	}

	return m, tx.Commit(ctx)
}

// ---- queries ---------------------------------------------------------------

// GetBalances returns net balance per member (CREDIT minus DEBIT).
// Members with no transactions are included at zero.
func (s *Store) GetBalances(ctx context.Context, groupID string) ([]BalanceRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			gm.id,
			gm.display_name,
			COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_cents
			                  ELSE -le.amount_cents END), 0) AS net_cents
		FROM group_members gm
		LEFT JOIN ledger_entries le
			ON le.member_id = gm.id AND le.group_id = gm.group_id
		WHERE gm.group_id = $1
		GROUP BY gm.id, gm.display_name
		ORDER BY gm.display_name
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("query balances: %w", err)
	}
	defer rows.Close()

	var out []BalanceRow
	for rows.Next() {
		var r BalanceRow
		if err := rows.Scan(&r.MemberID, &r.DisplayName, &r.NetCents); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// GetLedger returns up to 100 recent ledger entries for a group, newest first.
func (s *Store) GetLedger(ctx context.Context, groupID string) ([]LedgerEntryRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			le.id,
			gm.display_name,
			le.amount_cents,
			le.entry_type,
			e.description,
			le.created_at
		FROM ledger_entries le
		JOIN group_members gm ON gm.id = le.member_id
		JOIN expenses e ON e.id = le.expense_id
		WHERE le.group_id = $1
		ORDER BY le.created_at DESC
		LIMIT 100
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("query ledger: %w", err)
	}
	defer rows.Close()

	var out []LedgerEntryRow
	for rows.Next() {
		var r LedgerEntryRow
		if err := rows.Scan(&r.ID, &r.MemberName, &r.AmountCents,
			&r.EntryType, &r.Description, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
