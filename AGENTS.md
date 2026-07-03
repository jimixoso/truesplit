# AGENTS.md — TrueSplit (Ledger Engine)

## What this project is
An idempotent, double-entry group expense ledger that proves duplicate clicks, retries, and concurrent requests can never double-charge anyone. Full spec: `prd_ledger_final.md`. Read it before writing code — this file summarizes it for quick reference, the PRD is the source of truth on details.

## Tech stack
- **Go** — backend, for explicit error handling and native concurrency in both the API and the load-test tooling.
- **PostgreSQL** — ACID transactions and real `UNIQUE`/`CHECK` constraints for double-entry correctness.
- **Redis** — fast-path distributed lock (`SETNX`) in front of Postgres, which remains the actual source of truth.
- **Next.js + Tailwind** — dashboard, consumes the backend's SSE stream via `EventSource`.

## Repo structure (target)
```
/server          Go API (transactions, balances, settlements, ledger, SSE)
/web              Next.js dashboard
/migrations       SQL schema + constraints
prd_ledger_final.md
```

## How to build & test
- `go test ./...` for unit + invariant tests in `/server`.
- A dedicated concurrency test (or the documented `curl`/`xargs` blast from the PRD §7) must be runnable against a local instance to prove idempotency under real concurrent load — not just unit-mocked.

## Test-driven development is mandatory
This project is built test-first, no exceptions:
1. **Red** — write a test for the next smallest behavior, run it, confirm it fails for the expected reason.
2. **Green** — write the minimum code to pass it.
3. **Refactor** — clean up with tests green.
Never write more than one failing test's worth of implementation at a time.

This project's entire point is correctness under concurrency and partial failure — so the concurrency and failure-mode tests are not optional extras, they're the actual deliverable. A ledger feature without a test proving its invariant holds under a race is unfinished, not "done pending tests."

## Invariants that must always hold (and must always be tested)
- **Zero-sum law**: for any committed transaction, `sum(debits) == sum(credits)`.
- **Group solvency**: for any group, `sum(member_net_balances) == 0`.
- **Idempotency**: same `(group_id, idempotency_key)` + same request hash → identical cached response. Different hash with the same key → `409`, every time.
- **No partial writes**: a transaction's legs + its idempotency record commit atomically or not at all.

## Definition of done for any feature
- Tests exist and pass, including at least one concurrency/race test where the feature touches money or idempotency.
- The hackathon-cut vs. deep-cut boundary (PRD §7) is respected.
- No invented performance numbers — anything quantitative is measured by a real test/load test in this repo, not assumed (PRD §8).
