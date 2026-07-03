# CLAUDE.md

This is Claude Code's entry point for the **TrueSplit ledger** project. The canonical spec lives in [AGENTS.md](./AGENTS.md), process rules in [HOWTOAI.md](./HOWTOAI.md), and boundaries in [GOVERNANCE.md](./GOVERNANCE.md) — read all three before writing code. This file only adds Claude-specific notes; don't duplicate content here that belongs in those files.

## Source of truth
- Product/technical spec: `prd_ledger_final.md`
- Agent working agreement: `AGENTS.md`
- Workflow loop: `HOWTOAI.md`
- Rules and approval boundaries: `GOVERNANCE.md`

## Non-negotiable: test-driven development
Every behavior change starts with a failing test. If you're about to write application code with no corresponding test in the same change, stop and write the test first. See `HOWTOAI.md` for the exact red-green-refactor loop.

## Claude-specific notes
- Track the red → green → refactor steps explicitly (e.g. via TaskCreate/TodoWrite) so progress on a feature is visible, especially for concurrency-heavy work where it's easy to lose track of what's actually been proven vs. assumed.
- Don't mark a task complete until tests pass *and* the relevant invariant (see `AGENTS.md` → Invariants) has a dedicated test asserting it — a comment describing an invariant is not a test of it.
- Daily commits are expected (see `GOVERNANCE.md`) — prefer small, working, tested commits over large batched ones.
