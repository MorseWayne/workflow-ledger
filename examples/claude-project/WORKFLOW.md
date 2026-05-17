# Example Workflow Ledger

## Active

### WF-2026-05-16-001 — Add reusable workflow tracking
Status: In Progress
Level: 2
Started: 2026-05-16
Last updated: 2026-05-16
Current phase: Phase 2 — Implement skill toolkit

Goal:
- Add a reusable Claude Code workflow ledger skill without turning the ledger into a transcript.

Decisions:
- 2026-05-16 — Use one `.claude/WORKFLOW.md` overview instead of one file per task.
- 2026-05-16 — Use optional attachments only when Level 3 detail is too long for the ledger.

Phases:
- [x] Phase 1 — Research and design: choose the ledger shape and responsibilities.
- [ ] Phase 2 — Implement skill toolkit: finish docs and validate installation.

Current phase tasks:
- [x] Create skill directory.
- [x] Write SKILL.md.
- [ ] Add README usage instructions.
- [ ] Validate install instructions.

Acceptance:
- Review: Phase 1 design confirmed by the user.
- Validation: No code validation needed for design-only phase.
- GitNexus: N/A; no project code symbol changes.
- Commit: N/A until implementation is committed.
- Gaps: README and install validation remain.

Resume next:
- Validate the README install flow and close Phase 2 if it works.

## Backlog / Future

- [ ] Add an optional hook recipe if commit-time checks become necessary.
- [ ] Add a CLI wrapper if the skill-only workflow becomes insufficient.

## Completed
