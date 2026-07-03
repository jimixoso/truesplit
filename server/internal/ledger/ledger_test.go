package ledger

import "testing"

func TestValidateSplits_RejectsMismatchedTotal(t *testing.T) {
	err := ValidateSplits(10000, []Split{
		{MemberID: "alice", AmountCents: 3000},
		{MemberID: "bob", AmountCents: 3000},
	})
	if err == nil {
		t.Fatal("expected an error when splits do not sum to the expense amount, got nil")
	}
}

func TestValidateSplits_AcceptsMatchingTotal(t *testing.T) {
	err := ValidateSplits(9000, []Split{
		{MemberID: "alice", AmountCents: 3000},
		{MemberID: "bob", AmountCents: 3000},
		{MemberID: "charlie", AmountCents: 3000},
	})
	if err != nil {
		t.Fatalf("expected no error when splits sum to the expense amount, got %v", err)
	}
}

func TestBuildLedgerEntries_IsZeroSum(t *testing.T) {
	entries := BuildLedgerEntries("exp_1", "maya", 9000, []Split{
		{MemberID: "maya", AmountCents: 3000},
		{MemberID: "jimi", AmountCents: 3000},
		{MemberID: "ayo", AmountCents: 3000},
	})

	var debits, credits int64
	for _, e := range entries {
		switch e.EntryType {
		case Debit:
			debits += e.AmountCents
		case Credit:
			credits += e.AmountCents
		}
	}

	if debits != credits {
		t.Fatalf("zero-sum law violated: debits=%d credits=%d", debits, credits)
	}
}
