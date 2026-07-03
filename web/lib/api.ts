const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ---- types -----------------------------------------------------------------

export interface Group {
  id: string;
  name: string;
  created_at: string;
}

export interface Member {
  id: string;
  group_id: string;
  display_name: string;
  created_at: string;
}

export interface Balance {
  member_id: string;
  display_name: string;
  net_cents: number;
}

export interface Settlement {
  from_member_id: string;
  from_member_name: string;
  to_member_id: string;
  to_member_name: string;
  amount_cents: number;
}

export interface LedgerEntry {
  id: string;
  member_name: string;
  amount_cents: number;
  entry_type: "DEBIT" | "CREDIT";
  description: string;
  created_at: string;
}

export interface ExpenseResponse {
  expense_id: string;
  group_id: string;
  payer_member_id: string;
  amount_cents: number;
  description: string;
  idempotency_key: string;
  created_at: string;
}

export interface AddExpenseInput {
  payerMemberId: string;
  amountCents: number;
  description: string;
  splits: { member_id: string; amount_cents: number }[];
}

// ---- groups ----------------------------------------------------------------

export async function listGroups(): Promise<Group[]> {
  const res = await fetch(`${API}/groups`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to list groups");
  return res.json();
}

export async function createGroup(name: string): Promise<Group> {
  const res = await fetch(`${API}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("failed to create group");
  return res.json();
}

// ---- members ---------------------------------------------------------------

export async function listMembers(groupId: string): Promise<Member[]> {
  const res = await fetch(`${API}/groups/${groupId}/members`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to list members");
  return res.json();
}

export async function addMember(groupId: string, displayName: string): Promise<Member> {
  const res = await fetch(`${API}/groups/${groupId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  });
  if (!res.ok) throw new Error("failed to add member");
  return res.json();
}

// ---- ledger / expenses -----------------------------------------------------

export async function getBalances(groupId: string): Promise<Balance[]> {
  const res = await fetch(`${API}/groups/${groupId}/balances`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch balances");
  return res.json();
}

export async function getSettlements(groupId: string): Promise<Settlement[]> {
  const res = await fetch(`${API}/groups/${groupId}/settlements`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch settlements");
  return res.json();
}

export async function getLedger(groupId: string): Promise<LedgerEntry[]> {
  const res = await fetch(`${API}/groups/${groupId}/ledger`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch ledger");
  return res.json();
}

export async function addExpense(
  groupId: string,
  input: AddExpenseInput
): Promise<ExpenseResponse> {
  const idempotencyKey = crypto.randomUUID();
  const res = await fetch(`${API}/groups/${groupId}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      payer_member_id: input.payerMemberId,
      amount_cents: input.amountCents,
      description: input.description,
      splits: input.splits,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "failed to add expense");
  }
  return res.json();
}

export function streamUrl(groupId: string): string {
  return `${API}/groups/${groupId}/stream`;
}
