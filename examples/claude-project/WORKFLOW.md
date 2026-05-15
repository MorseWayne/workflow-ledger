# Example Workflow Ledger

## Active

### WF-2026-05-16-001 — Add reusable workflow tracking
Status: In Progress
Level: 2
Started: 2026-05-16
Last updated: 2026-05-16
Current phase: Phase 2 — Implement skill toolkit

Goal:
- Add a reusable Claude Code workflow ledger skill.
- Keep the process lightweight while preserving recovery and review history.

Decisions:
- 2026-05-16 — Use a single `.claude/WORKFLOW.md` overview instead of one file per task.
- 2026-05-16 — Use optional attachments only for long Level 3 details.

Phases:

#### Phase 1 — Research and design
Status: Done
Depends on:
- None
Tasks:
- [x] Compare skill, CLAUDE.md, and hook responsibilities
- [x] Decide on milestone ledger structure
- [x] Decide on phase/subtask organization

Acceptance / Review:
- Review: Design confirmed by the user.
- Validation: No code validation needed for design-only phase.
- GitNexus: N/A; no project code symbol changes.
- Tests: N/A.
- Gaps: Implementation still pending.

#### Phase 2 — Implement skill toolkit
Status: In Progress
Depends on:
- Phase 1
Tasks:
- [x] Create skill directory
- [x] Write SKILL.md
- [ ] Add README usage instructions
- [ ] Validate install instructions

Resume next:
- Finish README validation and close the task.

Discovered tasks:
- [ ] Future: add an optional hook recipe for commit-time checks.

## Backlog / Future

- [ ] Add CLI wrapper if the skill-only workflow becomes insufficient.

## Completed
