# TrueSplit

Group expense splitting on a real double-entry ledger with idempotent APIs — duplicate clicks, retries, and concurrent requests can never double-charge anyone.

**Live demo:** [truesplit-wheat.vercel.app](https://truesplit-wheat.vercel.app)

## The problem

Most expense apps (Splitwise, Tricount) treat expenses as simple mutable rows. On a flaky connection, tapping "Submit $90 for dinner" twice creates two expenses. This project solves the backend correctness problem underneath: a duplicated request must never create two expenses, and a balance must always be reconstructable from immutable ledger entries.

## Demo

Open the app and add an expense. Then fire 20 concurrent duplicate requests against the live API:

```bash
seq 1 20 | xargs -n1 -P20 -I{} curl -s -X POST \
  https://truesplit.onrender.com/groups/00000000-0000-0000-0000-000000000001/transactions \
  -H "Idempotency-Key: demo-key-999" \
  -H "Content-Type: application/json" \
  -d '{"payer_member_id":"00000000-0000-0000-0001-000000000012","amount_cents":9000,"description":"Dinner","splits":[{"member_id":"00000000-0000-0000-0001-000000000011","amount_cents":3000},{"member_id":"00000000-0000-0000-0001-000000000012","amount_cents":3000},{"member_id":"00000000-0000-0000-0001-000000000013","amount_cents":3000}]}'
```

One `201 Created`. Nineteen replayed responses. One expense in the ledger. Balances move by exactly one expense's worth.

## How idempotency works

Every `POST /groups/{id}/transactions` requires an `Idempotency-Key` header.

1. Redis `SETNX` sets an `IN_FLIGHT` sentinel — fast-path guard for concurrent requests.
2. A Postgres transaction opens and attempts `INSERT INTO idempotency_records` with a `UNIQUE(scope, idempotency_key)` constraint — the real tiebreaker.
3. The winning request inserts the expense, splits, and double-entry ledger legs atomically, then updates the record with the response and caches it in Redis (24h TTL).
4. Any loser that races past Redis hits the unique constraint, reads the winner's committed response, and returns it verbatim.
5. Same key + different request hash → `409 Conflict`.

## Double-entry invariants

Every committed transaction satisfies:
- **Zero-sum law:** `sum(DEBITs) == sum(CREDITs)`
- **Group solvency:** `sum(member net balances) == 0`

Both are enforced at the DB level (not just asserted in tests) and verified by the test suite.

## Stack

| Layer | Tech |
|---|---|
| Backend | Go, `net/http` (stdlib router) |
| Database | PostgreSQL (Neon) — ACID + `UNIQUE`/`CHECK` constraints |
| Cache / lock | Redis (Upstash) — `SETNX` fast-path |
| Frontend | Next.js + Tailwind CSS |
| Real-time | Server-Sent Events (`EventSource`) |
| Deploy | Render (API) + Vercel (frontend) |

## Running locally

```bash
# 1. Start infra (or point at Neon + Upstash)
docker compose up -d

# 2. Copy env
cp .env.example .env  # fill in DATABASE_URL and REDIS_URL

# 3. Run backend (migrations apply automatically on startup)
cd server && go run ./cmd/api/main.go

# 4. Run frontend
cd web && npm install && npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Project structure

```
/server       Go API — transactions, balances, settlements, ledger, SSE
/web          Next.js dashboard
/migrations   SQL schema + seed data
```
