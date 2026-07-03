# HOWTOAI.md — how an AI agent should work on TrueSplit

## The loop
1. Read the relevant section of `prd_ledger_final.md` before touching code. If a task isn't covered by the PRD or contradicts it, stop and flag it — don't silently improvise scope.
2. Write a failing test first. State in the commit message what behavior the test proves.
3. Implement the minimum to pass it.
4. Refactor only with tests green.
5. Commit. Daily commits are the cadence (see `GOVERNANCE.md`) — a day with no commit on an active project is a signal to flag, not ignore.

## Ambiguity policy
`prd_ledger_final.md` §10 ("Open Questions / Assumptions") is the registry of known unknowns.
- If an ambiguity is already listed there, follow the stated assumption.
- If it's new, add it to that section rather than silently picking an answer and moving on.

## Hackathon cut vs. deep cut
Don't build deep-cut complexity (Redlock clustering, the outbox pattern, property-based testing) while the hackathon cut isn't done and demoable. But don't shortcut the hackathon cut's centerpiece mechanic either: the real `Idempotency-Key` enforcement (including the hash-mismatch → `409` check) must work for real in the MVP — it is the thing being demoed, not a stub.

## Demo-readiness check
Before calling a milestone done, the live demo moment from PRD §7 must work end-to-end against a running instance: fire genuinely concurrent duplicate requests (the `xargs -P` curl blast) and confirm exactly one committed expense. Run it for real — don't infer it from passing unit tests alone.

## When to ask Jimi instead of deciding alone
- Schema changes that would affect already-written ledger data.
- Adding a dependency not already named in the PRD's tech stack.
- Anything that would change the zero-sum/solvency invariants or the idempotency contract.
- Anything in `GOVERNANCE.md`'s approval list.
