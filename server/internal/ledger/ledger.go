// Package ledger implements TrueSplit's double-entry accounting rules.
// See prd_ledger_final.md §4 for the invariants this package must uphold.
package ledger

import "fmt"

type EntryType string

const (
	Debit  EntryType = "DEBIT"
	Credit EntryType = "CREDIT"
)

type Split struct {
	MemberID    string
	AmountCents int64
}

type LedgerEntry struct {
	ExpenseID   string
	MemberID    string
	AmountCents int64
	EntryType   EntryType
}

// ValidateSplits enforces sum(splits) == amount, per PRD §6 Risk 3.
func ValidateSplits(amountCents int64, splits []Split) error {
	var total int64
	for _, s := range splits {
		total += s.AmountCents
	}
	if total != amountCents {
		return fmt.Errorf("split_total_mismatch: expected %d, got %d", amountCents, total)
	}
	return nil
}

// BuildLedgerEntries produces the double-entry legs for an expense: the payer is
// credited the full amount, and each split member is debited their share. The
// caller must persist these inside a single transaction (PRD §6 Risk 3) and
// must have already validated splits via ValidateSplits.
func BuildLedgerEntries(expenseID, payerMemberID string, amountCents int64, splits []Split) []LedgerEntry {
	entries := make([]LedgerEntry, 0, len(splits)+1)
	entries = append(entries, LedgerEntry{
		ExpenseID:   expenseID,
		MemberID:    payerMemberID,
		AmountCents: amountCents,
		EntryType:   Credit,
	})
	for _, s := range splits {
		entries = append(entries, LedgerEntry{
			ExpenseID:   expenseID,
			MemberID:    s.MemberID,
			AmountCents: s.AmountCents,
			EntryType:   Debit,
		})
	}
	return entries
}
