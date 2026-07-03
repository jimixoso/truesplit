# PRD: TrueSplit — An Idempotent, Double-Entry Group Ledger

## 1. One-liner

A group expense settlement engine for friends, roommates, and trip groups built on a real double-entry ledger with idempotent APIs, so duplicate clicks, retries, and concurrent requests can never double-charge anyone — proven live, not just claimed.

## 2. Problem & Target User

* The pain: someone pays for dinner, a hotel, an Uber, or tickets, and the group needs to know who owes whom — without trusting a spreadsheet or a group chat doing the math.
* Target user: a group of friends splitting a trip, roommates splitting utilities, club members splitting event costs.
* Concrete failure case this project targets: standing in a bar on flaky 3G, tapping "Submit $90 for dinner," seeing a hung spinner, and tapping it twice more. Most consumer apps (Splitwise, Tricount) treat expenses as simple mutable rows and rely on client-side UI optimism rather than server-side idempotency — a dropped connection mid-request routinely produces duplicate inserts and a balance no one trusts.
* This project is not about the product surface (Splitwise already nailed that). It's about the backend correctness problem underneath it:
  * A duplicated request must not create two expenses.
  * A failed network call must be safely retryable.
  * A balance must always be reconstructable from immutable ledger entries.
  * Concurrent requests must not corrupt group balances.

## 3. Scope

**In scope (MVP):**
* One seeded group (`Austin Weekend Trip`) with seeded members (`Jimi`, `Maya`, `Ayo`, `Chris`).
* Add shared expenses with equal or custom splits.
* Live net balances per member.
* Settlement suggestions ("Jimi pays Maya $30").
* Immutable ledger/audit feed.
* Required `Idempotency-Key` header on expense creation, enforced server-side (not just client-side dedup).
* A way to fire real concurrent duplicate requests at the live API and observe the result (see §7 — this must be genuine external concurrency, not an internal simulation endpoint).

**Explicitly out of scope:**
* Real money movement (Venmo/Stripe/Plaid/ACH) — this project proves ledger correctness, not payment rails.
* Full auth — seeded demo users are enough; auth is a deep-cut add-on, not the point of the project.
* Multi-currency / FX — locked to USD stored as integer cents; floating-point FX drift breaks the zero-sum invariant.
* Receipt OCR — separate CV problem, distracts from the concurrency story.
* Mobile app — a web dashboard demos faster and is sufficient.
* Itemized restaurant-receipt splitting — equal/custom split is enough to prove the engine.

## 4. Core Entities & Data Model

**User** — `id`, `name`, `email`, `created_at`. A user can belong to many groups.

**Group** — `id`, `name`, `created_at`. Has many members, expenses, ledger entries.

**GroupMember** — `id`, `group_id`, `user_id`, `display_name`, `created_at`.
Invariant: a user appears at most once per group → `UNIQUE (group_id, user_id)`.

**Expense** — `id`, `group_id`, `payer_member_id`, `amount_cents`, `currency`, `description`, `status` (`posted` | `voided`), `idempotency_key`, `created_at`.
Invariants: `amount_cents > 0`; `currency = 'USD'` for MVP.
Constraint: `UNIQUE (group_id, idempotency_key)`.

**ExpenseSplit** — `id`, `expense_id`, `member_id`, `amount_cents`.
Invariant: `sum(splits.amount_cents) = expense.amount_cents`.

**LedgerEntry** (the double-entry legs) — `id`, `group_id`, `expense_id`, `account_id`/`member_id`, `amount_cents` (non-negative), `entry_type` (`DEBIT` | `CREDIT`), `created_at`.
Invariants (the two that matter most — both must be enforced, not just asserted in docs):
* **Zero-sum law:** for any committed transaction, `sum(debits) == sum(credits)`. If not, the DB transaction rolls back.
* **Group solvency:** for any group, `sum(member_net_balances) == 0`.

**IdempotencyRecord** — `id`, `scope` (e.g. `group_id`), `idempotency_key`, `request_hash` (SHA-256 of payload), `response_body`, `status_code`, `created_at`, `expires_at`.
Invariant: same key + same request hash → return cached response. Same key + different hash → `409 Conflict`. (This must hold in the MVP, not be deferred — it's the actual mechanism being demoed.)

## 5. API / Interface Surface

**`POST /groups`** — create a group. Not idempotency-critical.

**`POST /groups/{group_id}/members`** — add a member. Idempotent via `UNIQUE (group_id, user_id)`.

**`POST /groups/{group_id}/transactions`**
Required header: `Idempotency-Key: <key>`
```json
{
  "payer_member_id": "mem_maya",
  "amount_cents": 9000,
  "description": "Dinner at Torchy's",
  "splits": [
    { "member_id": "mem_maya", "amount_cents": 3000 },
    { "member_id": "mem_jimi", "amount_cents": 3000 },
    { "member_id": "mem_ayo",  "amount_cents": 3000 }
  ]
}
```
Idempotency enforcement flow:
1. Hash the request body (SHA-256).
2. Check Redis for `idemp:<group_id>:<key>`. If `IN_FLIGHT`, return `409` ("retry shortly"). If a cached response exists, return it verbatim.
3. If missing, set `IN_FLIGHT` (short TTL), open a Postgres transaction, insert `IdempotencyRecord` with `UNIQUE (group_id, idempotency_key)` as the real source of truth, insert expense + splits + ledger entries, commit only if debits == credits.
4. On unique-constraint violation (two requests raced past the Redis check), the loser reads the winner's committed record and returns its cached response — Postgres is the tiebreaker, Redis is just a fast-path optimization.
5. Cache the finalized response in Redis with a 24h TTL.
6. If the same key arrives with a *different* request hash, return `409 Conflict` immediately — do not silently process it.

**`GET /groups/{group_id}/balances`** — net balance per member.

**`GET /groups/{group_id}/settlements`** — simplified pairwise settlement suggestions (greedy debt-minimization).

**`GET /groups/{group_id}/ledger`** — immutable audit feed.

**`GET /groups/{group_id}/stream`** — SSE pipe emitting `{ type: "LEDGER_MUTATED", payload }` so anyone viewing the group sees updates live, without polling.

## 6. Key Technical Risks & Failure Modes

| Risk | Why it's hard | Handling |
|---|---|---|
| Double-tap / duplicate-request race | Two identical requests can both pass the Redis fast-path check before either commits | Postgres `UNIQUE (group_id, idempotency_key)` is the real guard; the losing request catches the constraint violation and returns the winner's cached response instead of erroring |
| Payload mutation under a reused key | Client (or attacker) reuses a key with a different body | Store a SHA-256 hash with the idempotency record; mismatched hash → `409`, enforced in the MVP, not deferred |
| Partial ledger writes | Process dies after writing one leg of a transaction but before the other | All legs + the idempotency record write inside one DB transaction; a dropped connection mid-transaction leaves nothing committed |
| Ledger imbalance | Splits don't sum to the expense total (e.g. rounding) | Validate `sum(splits) == amount_cents` before writing; reject with a specific error otherwise |
| Stale balance reads | Balance view drifts from the ledger | MVP computes balances directly from ledger entries on read (no cached snapshot to go stale); snapshotting is a deep-cut optimization, added only once correctness is proven |

## 7. Two Cuts of the Project

**Hackathon cut (24–48 hrs):**
* Built: seeded group/members, add-expense form, live balances dashboard, settlement suggestions, ledger feed, SSE live updates.
* Faked/hardcoded: no real auth (dropdown to switch active seeded user), DB pre-seeded with one trip so the screen isn't empty on boot.
* **The live demo moment** (must be real, not a canned internal endpoint): project the browser next to a terminal. Balances show Bob at -$15. In the terminal:
  ```bash
  seq 1 20 | xargs -n1 -P20 -I{} curl -s -X POST https://.../groups/g1/transactions \
    -H "Idempotency-Key: demo-key-999" -d '{...}'
  ```
  20 genuinely concurrent requests hit the live, deployed API at once — not a simulated fan-out route. The feed ticks once, the balance moves by exactly one expense's worth, and the terminal shows one `201 Created` plus nineteen replayed responses. This is more convincing than an internal "fire duplicates" button because it's externally verifiable: anyone can run that curl command themselves against the live URL.
* Why deploy during the hackathon cut, not after: a public URL is what makes the demo moment falsifiable by a skeptical judge or interviewer later, and it's the seed of the "real users" framing for project 4.

**Deep / resume cut (multi-week, ongoing commits):**
* Distributed locking: move from a single Redis instance to Redlock across a small Redis cluster, with Postgres still as the final tiebreaker.
* Outbox pattern: instead of the API directly emitting SSE events, write to a Postgres `outbox_events` table and have a separate worker tail it (or the WAL) to publish — decouples ledger writes from notification delivery.
* Property-based tests (e.g. Go's `testing/quick` or Python's `hypothesis`): generate thousands of randomized split arrays and concurrent request sequences, assert the zero-sum and group-solvency invariants never break.
* Load testing with a real tool (k6, vegeta, or a hand-rolled Go load generator) to *measure* actual throughput and P99 latency under duplicate-key injection — replacing any guessed numbers with measured ones.
* Structured logging with `request_id` + `idempotency_key`, plus metrics for replay count and conflict count.
* Real auth (e.g. OAuth), and a deployed, link-shareable instance (Fly.io/Render + Neon Postgres or equivalent).
* A short technical writeup explaining the idempotency design and double-entry invariants — this is the artifact that does the talking in an interview.

## 8. Success Metrics

**Hackathon cut:**
* A non-technical judge understands the pitch ("it's Venmo for roommates that can't double-charge you") in under 15 seconds.
* The live curl-blast demo runs against the deployed URL with zero unhandled 5xxs, and produces exactly one committed expense regardless of how many duplicates were fired.

**Deep cut** (targets to actually measure, not assume):
* Under concurrent duplicate-key load, the system has zero double-spend ledger anomalies — verified by an automated test, not just the demo.
* Reusing a key with a mismatched payload returns `409` 100% of the time.
* A killed connection mid-transaction never leaves a partial ledger entry (verified by a fault-injection test).
* Replace the placeholder throughput/latency numbers with whatever the load test actually measures, and report both.

## 9. Tech Stack & Rationale

* **Backend: Go** — explicit error handling forces acknowledging every DB failure path; goroutines make writing the concurrent load-test tooling native to the same repo instead of a bolted-on script. Also a stronger signal than Python for backend-systems-focused recruiters (Stripe/Block/Plaid-style roles).
* **Database: PostgreSQL** — ACID transactions and real `UNIQUE`/`CHECK` constraints are non-negotiable for double-entry bookkeeping; this is not a fit for a document store.
* **Cache/lock: Redis** — atomic `SETNX` as a fast-path distributed lock in front of Postgres, which remains the actual source of truth.
* **Frontend: Next.js + Tailwind** — fast to assemble; consumes the backend's SSE stream directly via `EventSource`, no WebSocket gateway needed.
* **Deploy: Fly.io/Render + Neon Postgres** — public URL from day one of the hackathon cut, so the demo is independently verifiable.

## 10. Open Questions / Assumptions

* Assumption: ledger is append-only; correcting a mistaken expense means posting a compensating transaction, not editing history.
* Assumption: all ledger entries are timestamped at the DB server's UTC clock, ignoring client-local time/timezone travel.
* Open question: should deleting/voiding an expense generate reversing ledger entries, or just flip `status`?
* Open question: should settlement payments (someone actually paying someone back) themselves become ledger entries, closing the loop?
* Open question: should idempotency keys be scoped per-group (current plan) or globally per-app — per-group is simpler but assumes keys are never reused across groups by the same client.
* Open question: how long should idempotency records be retained before expiry, and what happens if a retried request arrives after expiry?
