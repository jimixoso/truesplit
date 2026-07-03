const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const GROUP_ID = "00000000-0000-0000-0000-000000000001";

export const MEMBERS = [
  { id: "00000000-0000-0000-0001-000000000011", name: "Jimi" },
  { id: "00000000-0000-0000-0001-000000000012", name: "Maya" },
  { id: "00000000-0000-0000-0001-000000000013", name: "Ayo" },
  { id: "00000000-0000-0000-0001-000000000014", name: "Chris" },
];

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

export async function getBalances(): Promise<Balance[]> {
  const res = await fetch(`${API}/groups/${GROUP_ID}/balances`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch balances");
  return res.json();
}

export async function getSettlements(): Promise<Settlement[]> {
  const res = await fetch(`${API}/groups/${GROUP_ID}/settlements`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch settlements");
  return res.json();
}

export async function getLedger(): Promise<LedgerEntry[]> {
  const res = await fetch(`${API}/groups/${GROUP_ID}/ledger`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch ledger");
  return res.json();
}

export interface AddExpenseInput {
  payerMemberId: string;
  amountCents: number;
  description: string;
  splits: { member_id: string; amount_cents: number }[];
}

export async function addExpense(input: AddExpenseInput): Promise<ExpenseResponse> {
  const idempotencyKey = crypto.randomUUID();
  const res = await fetch(`${API}/groups/${GROUP_ID}/transactions`, {
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

export function streamUrl(): string {
  return `${API}/groups/${GROUP_ID}/stream`;
}
