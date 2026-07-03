// Package settlement computes the minimum set of transfers that settles all
// debts within a group — the greedy pairwise debt-minimisation algorithm.
package settlement

import (
	"sort"

	"github.com/jimixoso/truesplit/internal/store"
)

// Payment is a suggested transfer that settles part or all of a debt.
type Payment struct {
	FromMemberID   string `json:"from_member_id"`
	FromMemberName string `json:"from_member_name"`
	ToMemberID     string `json:"to_member_id"`
	ToMemberName   string `json:"to_member_name"`
	AmountCents    int64  `json:"amount_cents"`
}

// Compute returns the minimum set of payments that brings every member's
// balance to zero. Invariant: sum(member net balances) == 0 (group solvency),
// so the algorithm always terminates with empty creditor and debtor lists.
func Compute(balances []store.BalanceRow) []Payment {
	type entry struct {
		id   string
		name string
		net  int64
	}

	var creditors, debtors []entry
	for _, b := range balances {
		switch {
		case b.NetCents > 0:
			creditors = append(creditors, entry{b.MemberID, b.DisplayName, b.NetCents})
		case b.NetCents < 0:
			debtors = append(debtors, entry{b.MemberID, b.DisplayName, -b.NetCents}) // store as positive
		}
	}

	// Largest first for both sides — produces fewer, larger transfers.
	sort.Slice(creditors, func(i, j int) bool { return creditors[i].net > creditors[j].net })
	sort.Slice(debtors, func(i, j int) bool { return debtors[i].net > debtors[j].net })

	var payments []Payment
	ci, di := 0, 0
	for ci < len(creditors) && di < len(debtors) {
		amount := min(creditors[ci].net, debtors[di].net)
		payments = append(payments, Payment{
			FromMemberID:   debtors[di].id,
			FromMemberName: debtors[di].name,
			ToMemberID:     creditors[ci].id,
			ToMemberName:   creditors[ci].name,
			AmountCents:    amount,
		})
		creditors[ci].net -= amount
		debtors[di].net -= amount
		if creditors[ci].net == 0 {
			ci++
		}
		if debtors[di].net == 0 {
			di++
		}
	}
	return payments
}

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
