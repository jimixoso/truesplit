# GOVERNANCE.md — rules and boundaries for TrueSplit

## Scope control
`prd_ledger_final.md` §3 ("Explicitly out of scope") is binding — real bank/ACH integration, multi-currency, receipt OCR, and full auth are deliberately excluded. Building any of these is scope drift, not "extra effort": it dilutes the specific claim this project makes about ledger correctness. To change scope, amend the PRD explicitly and note why, rather than quietly expanding it.

## Data and security boundaries
- No real money movement, real bank credentials, or real user PII — seeded/mock users and synthetic data only.
- Secrets (Redis/Postgres credentials, even for local dev) never get committed; use `.env` + `.gitignore`.

## Test gating (non-negotiable)
- No merge to main without passing tests.
- TDD is the development method, not a formality — a PR with implementation but no corresponding new/updated test is incomplete.
- Every invariant in `AGENTS.md` (zero-sum, group solvency, idempotency, no-partial-writes) must be backed by a test that fails if the invariant breaks.

## What requires explicit approval (don't decide alone)
- Adding a new dependency or service not already in the PRD's tech stack.
- Any migration that changes or drops existing ledger data.
- Standing up real payment rails or real auth.
- Changing the idempotency contract or either core invariant.
- Deploying to a new public environment.

## Commit cadence
Daily commits are the goal for an active project — this is part of the portfolio story, not just hygiene. A commit should represent a real, tested increment, not a no-op padding the streak. If there's genuinely nothing to commit on a given day, that's a signal to re-plan the work, not to fake a commit.

## Quantitative claims
Never state a latency/throughput number as fact unless a real test or load test in this repo measured it. PRD §8 lists the numbers this project actually needs to verify (e.g. zero double-spend under duplicate-key load) — treat those as test targets, not pre-existing facts.
