package settlement_test

import (
	"testing"

	"github.com/jimixoso/truesplit/internal/settlement"
	"github.com/jimixoso/truesplit/internal/store"
)

// balances builds a []store.BalanceRow from name→net pairs (cents).
func balances(pairs ...any) []store.BalanceRow {
	var rows []store.BalanceRow
	for i := 0; i < len(pairs); i += 2 {
		rows = append(rows, store.BalanceRow{
			MemberID:    pairs[i].(string),
			DisplayName: pairs[i].(string),
			NetCents:    int64(pairs[i+1].(int)),
		})
	}
	return rows
}

func totalFlow(payments []settlement.Payment) int64 {
	var total int64
	for _, p := range payments {
		total += p.AmountCents
	}
	return total
}

// After all payments are applied the net change to each member must be zero.
func netAfterPayments(initial []store.BalanceRow, payments []settlement.Payment) map[string]int64 {
	net := make(map[string]int64)
	for _, b := range initial {
		net[b.MemberID] = b.NetCents
	}
	for _, p := range payments {
		// From member (debtor) pays → their negative balance rises toward 0.
		net[p.FromMemberID] += p.AmountCents
		// To member (creditor) receives → their positive balance falls toward 0.
		net[p.ToMemberID] -= p.AmountCents
	}
	return net
}

func TestCompute_SimpleThreeWay(t *testing.T) {
	// Maya paid $90, split equally ($30 each).
	// Maya: +$60 net (paid $90, owes $30)
	// Jimi: -$30 (owes $30)
	// Ayo:  -$30 (owes $30)
	bs := balances("Maya", 6000, "Jimi", -3000, "Ayo", -3000)
	payments := settlement.Compute(bs)

	if len(payments) != 2 {
		t.Fatalf("expected 2 payments, got %d: %+v", len(payments), payments)
	}
	net := netAfterPayments(bs, payments)
	for id, v := range net {
		if v != 0 {
			t.Errorf("member %s has non-zero balance %d after settlements", id, v)
		}
	}
}

func TestCompute_ZeroBalances(t *testing.T) {
	bs := balances("Jimi", 0, "Maya", 0)
	payments := settlement.Compute(bs)
	if len(payments) != 0 {
		t.Fatalf("expected no payments when all balances are zero, got %d", len(payments))
	}
}

func TestCompute_Settled(t *testing.T) {
	// Net sum is zero, all payments set net to zero.
	bs := balances("A", 9000, "B", -4000, "C", -3000, "D", -2000)
	payments := settlement.Compute(bs)

	net := netAfterPayments(bs, payments)
	for id, v := range net {
		if v != 0 {
			t.Errorf("member %s has non-zero balance %d after settlements", id, v)
		}
	}

	// Greedy produces at most len(debtors)+len(creditors)-1 payments.
	if len(payments) > 3 {
		t.Errorf("too many payments: expected ≤3, got %d", len(payments))
	}
}

func TestCompute_SingleDebtorCreditor(t *testing.T) {
	bs := balances("Alice", 5000, "Bob", -5000)
	payments := settlement.Compute(bs)

	if len(payments) != 1 {
		t.Fatalf("expected 1 payment, got %d", len(payments))
	}
	if payments[0].AmountCents != 5000 {
		t.Errorf("expected 5000 cents, got %d", payments[0].AmountCents)
	}
	if payments[0].FromMemberID != "Bob" || payments[0].ToMemberID != "Alice" {
		t.Errorf("payment direction wrong: %+v", payments[0])
	}
}
