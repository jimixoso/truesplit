# PRD 1: Ledger Engine — Splitwise That Can’t Be Double-Spent

## 1. One-liner

A group expense settlement app for friends, roommates, and trip groups that uses a real double-entry ledger plus idempotent APIs so duplicate clicks, retries, and concurrent requests cannot double-charge anyone.

## 2. Problem & Target User

* This solves the pain of group expense tracking where one person pays for dinner, hotels, Ubers, groceries, or tickets and everyone needs to know who owes whom.
* Target user: a group of friends splitting a trip, roommates splitting utilities, or club members splitting event costs.
* Existing tools like Splitwise solve the product problem, but this project focuses on the backend correctness problem:

  * A duplicated request should not create two expenses.
  * A failed network call should be retryable safely.
  * A balance should always be explainable from immutable ledger entries.
  * Concurrent requests should not corrupt group balances.

## 3. Scope

**In scope (MVP):**

* Create one seeded group, e.g. `Austin Weekend Trip`.
* Add seeded members: `Jimi`, `Maya`, `Ayo`, `Chris`.
* Add shared expenses.
* Support equal and custom splits.
* Show live net balances.
* Show settlement suggestions: “Jimi pays Maya $30.”
* Show a ledger/audit feed.
* Require an `Idempotency-Key` for expense creation.
* Include a demo button that fires 100 duplicate concurrent expense requests.
* Prove that only one expense is created.

**Explicitly out of scope:**

* Real money movement through Venmo, Stripe, Plaid, ACH, or bank APIs.

  * Reason: the project is about ledger correctness, not payment rails.
* Full authentication.

  * Reason: seeded demo users are enough for the hackathon cut.
* Multi-currency support.

  * Reason: FX introduces rate-source complexity unrelated to the core idempotency demo.
* Receipt OCR.

  * Reason: it is a separate computer vision/product feature.
* Mobile app.

  * Reason: a web dashboard is faster to build and easier to demo.
* Complex itemized restaurant splitting.

  * Reason: equal/custom split is enough to prove the ledger engine.

## 4. Core Entities & Data Model

### `User`

Fields:

* `id`
* `name`
* `email`
* `created_at`

Relationships:

* A user can belong to many groups.

### `Group`

Fields:

* `id`
* `name`
* `created_at`

Relationships:

* A group has many members.
* A group has many expenses.
* A group has many ledger entries.

### `GroupMember`

Fields:

* `id`
* `group_id`
* `user_id`
* `display_name`
* `created_at`

Invariant:

```text
A user can only appear once in a group.
```

Database constraint:

```sql
UNIQUE (group_id, user_id)
```

### `Expense`

Fields:

* `id`
* `group_id`
* `payer_member_id`
* `amount_cents`
* `currency`
* `description`
* `status`
* `idempotency_key`
* `created_at`

Invariants:

```text
amount_cents > 0
currency = "USD" for MVP
status IN ("posted", "voided")
```

Database constraint:

```sql
UNIQUE (group_id, idempotency_key)
```

### `ExpenseSplit`

Fields:

* `id`
* `expense_id`
* `member_id`
* `amount_cents`

Invariant:

```text
sum(expense_splits.amount_cents) = expense.amount_cents
```

### `LedgerEntry`

Fields:

* `id`
* `group_id`
* `expense_id`
* `member_id`
* `direction`
* `amount_cents`
* `created_at`

Directions:

* `debit`
* `credit`

Core invariants:

```text
For every expense: sum(debits) = sum(credits)
For every group: sum(member_net_balances) = 0
```

Example:

Maya pays `$90` for dinner split between Maya, Jimi, and Ayo.

Result:

| Member | Net Balance |
| ------ | ----------: |
| Maya   |        +$60 |
| Jimi   |        -$30 |
| Ayo    |        -$30 |

### `IdempotencyRecord`

Fields:

* `id`
* `scope`
* `idempotency_key`
* `request_hash`
* `response_body`
* `status_code`
* `created_at`
* `expires_at`

Invariant:

```text
Same idempotency key + same request body returns the same response.
Same idempotency key + different request body returns 409 Conflict.
```

## 5. API / Interface Surface

### `POST /groups`

Purpose: create an expense group.

Request:

```json
{
  "name": "Austin Weekend Trip"
}
```

Response:

```json
{
  "group_id": "grp_123",
  "name": "Austin Weekend Trip"
}
```

Idempotent: optional.

---

### `POST /groups/{group_id}/members`

Purpose: add a member to a group.

Request:

```json
{
  "user_id": "usr_jimi",
  "display_name": "Jimi"
}
```

Idempotent: yes.

Enforced by:

```sql
UNIQUE (group_id, user_id)
```

---

### `POST /groups/{group_id}/expenses`

Purpose: create a shared expense.

Required header:

```http
Idempotency-Key: dinner-austin-001
```

Request:

```json
{
  "payer_member_id": "mem_maya",
  "amount_cents": 9000,
  "currency": "USD",
  "description": "Dinner at Torchy's",
  "splits": [
    { "member_id": "mem_maya", "amount_cents": 3000 },
    { "member_id": "mem_jimi", "amount_cents": 3000 },
    { "member_id": "mem_ayo", "amount_cents": 3000 }
  ]
}
```

Response:

```json
{
  "expense_id": "exp_456",
  "status": "posted",
  "balance_delta": {
    "mem_maya": 6000,
    "mem_jimi": -3000,
    "mem_ayo": -3000
  }
}
```

Idempotent: required.

How idempotency is enforced:

* Hash the request body with SHA-256.
* Start a Postgres transaction.
* Insert into `idempotency_records`.
* If key already exists:

  * same hash: return cached response
  * different hash: return `409 Conflict`
* Insert expense, splits, and ledger entries in the same transaction.
* Commit only if ledger entries balance.

---

### `GET /groups/{group_id}/balances`

Purpose: show current group balances.

Response:

```json
{
  "group_id": "grp_123",
  "balances": [
    { "member_id": "mem_maya", "display_name": "Maya", "balance_cents": 6000 },
    { "member_id": "mem_jimi", "display_name": "Jimi", "balance_cents": -3000 },
    { "member_id": "mem_ayo", "display_name": "Ayo", "balance_cents": -3000 }
  ]
}
```

---

### `GET /groups/{group_id}/settlements`

Purpose: suggest simplified settlement payments.

Response:

```json
{
  "settlements": [
    {
      "from_member_id": "mem_jimi",
      "to_member_id": "mem_maya",
      "amount_cents": 3000
    },
    {
      "from_member_id": "mem_ayo",
      "to_member_id": "mem_maya",
      "amount_cents": 3000
    }
  ]
}
```

---

### `GET /groups/{group_id}/ledger`

Purpose: show immutable audit trail.

Response:

```json
{
  "entries": [
    {
      "expense_id": "exp_456",
      "member_id": "mem_maya",
      "amount_cents": 6000,
      "direction": "credit",
      "description": "Dinner at Torchy's"
    },
    {
      "expense_id": "exp_456",
      "member_id": "mem_jimi",
      "amount_cents": 3000,
      "direction": "debit",
      "description": "Dinner at Torchy's"
    },
    {
      "expense_id": "exp_456",
      "member_id": "mem_ayo",
      "amount_cents": 3000,
      "direction": "debit",
      "description": "Dinner at Torchy's"
    }
  ]
}
```

---

### `POST /demo/concurrent-expense-test`

Purpose: demo duplicate request protection.

Request:

```json
{
  "group_id": "grp_123",
  "duplicate_count": 100,
  "idempotency_key": "demo-race-condition-001"
}
```

Response:

```json
{
  "requests_sent": 100,
  "expenses_created": 1,
  "duplicate_requests_replayed": 99,
  "final_group_balance_sum_cents": 0
}
```

## 6. Key Technical Risks & Failure Modes

### Risk 1: Duplicate expense creation

Failure mode:

* User double-clicks “Add Expense.”
* Frontend retries after timeout.
* Demo script fires 100 duplicate requests.

Handling:

* Require `Idempotency-Key`.
* Store request hash.
* Use database unique constraint.
* Replay cached response for exact duplicates.
* Return `409 Conflict` for key reuse with different body.

### Risk 2: Race condition under concurrent requests

Failure mode:

* Two backend workers process the same idempotency key at the same time.

Handling:

* Use Postgres transaction.
* Use unique constraint on `(group_id, idempotency_key)`.
* Only one request wins the insert.
* Other requests read the existing idempotency record.

### Risk 3: Ledger imbalance

Failure mode:

* Expense amount is `$100`, but splits total `$99.99`.

Handling:

* Store money as integer cents.
* Validate split total before writing.
* Reject request if split total does not match expense total.

Error:

```json
{
  "error": "split_total_mismatch",
  "expected_amount_cents": 10000,
  "actual_split_total_cents": 9999
}
```

### Risk 4: Partial database write

Failure mode:

* Expense row is inserted, server crashes before ledger entries are inserted.

Handling:

* Expense, splits, ledger entries, and idempotency response are written in one transaction.
* Failed transaction rolls back completely.

### Risk 5: Stale balance data

Failure mode:

* Cached balance does not reflect newest ledger entry.

Handling:

* MVP calculates balances directly from ledger entries.
* Deep cut can add transactional balance snapshots.

## 7. Two Cuts of the Project

**Hackathon cut (24-48 hrs):**

Build:

* Seeded group and users.
* Add expense form.
* Live balances dashboard.
* Settlement suggestions.
* Ledger feed.
* Duplicate request demo button.
* FastAPI backend.
* Postgres database.
* Next.js dashboard.

Mocked/hardcoded:

* Auth.
* Group creation.
* User creation.
* Real payments.

Live demo moment:

1. Add `$90` dinner paid by Maya.
2. Show balances update.
3. Click “Fire 100 Duplicate Requests.”
4. Show:

   * `100 requests sent`
   * `1 expense created`
   * `99 duplicates replayed`
   * `group balance sum = 0`
5. Ledger feed shows only one expense.

**Deep/resume cut (multi-week, ongoing commits):**

Add:

* Full idempotency middleware.
* 1,000-concurrent-request test.
* Property-based tests for ledger invariants.
* Failure injection: kill server mid-request.
* Structured logs with `request_id` and `idempotency_key`.
* Metrics for duplicate replay count and conflict count.
* Balance snapshot table.
* Real auth with Google login.
* Deployment on Vercel, Render/Fly.io, and Neon Postgres.
* Technical writeup explaining idempotency and double-entry accounting.

## 8. Success Metrics

* Judges understand the project in under 60 seconds.
* Live demo fires at least 50 duplicate concurrent requests.
* Only one expense is created.
* Ledger remains balanced.
* Group balances sum to zero.
* Deep cut handles 1,000 duplicate concurrent requests without double-posting.
* Reusing idempotency key with a different payload always returns `409 Conflict`.
* Server crash during expense creation leaves no partial ledger state.

## 9. Tech Stack & Rationale

### Frontend: Next.js + TypeScript

* Fast dashboard development.
* Easy deployment on Vercel.
* Type-safe API calls.

### Backend: FastAPI + Python

* Fast to build.
* Clean API validation with Pydantic.
* Easy async concurrency testing.

### Database: Postgres

* ACID transactions.
* Unique constraints for idempotency.
* Strong fit for ledger data.

### Testing: Pytest + pytest-asyncio + httpx

* Can simulate concurrent duplicate requests.
* Lets the repo prove the main technical claim.

### Deployment: Vercel + Render/Fly.io + Neon Postgres

* Simple public demo.
* Real hosted Postgres.
* Recruiter-friendly deployment.

## 10. Open Questions / Assumptions

* Assumption: MVP uses fake users.
* Assumption: MVP uses only USD.
* Assumption: no real money moves.
* Assumption: ledger entries are append-only.
* Open question: should deleting an expense create reversing ledger entries?
* Open question: should settlement payments also be ledger entries?
* Open question: should idempotency be scoped by group, user, or global app?
* Open question: how long should idempotency records be stored?
* Open question: should the demo include a “broken mode” that disables idempotency first, then shows the fix?
