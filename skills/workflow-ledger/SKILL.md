---
name: workflow-ledger
description: Lightweight, recoverable development workflow for Claude Code. Use when starting, resuming, planning, tracking, reviewing, or closing multi-step code work; when the user wants traceability without heavyweight specs; or when a task may be interrupted and continued later.
when_to_use: Use for development tasks that need phased progress, dependencies, acceptance/review summaries, or cross-session recovery. Skip for pure Q&A and trivial one-step edits unless the user requests tracking. Trigger phrases include "start task", "resume task", "update", "close", "workflow", "ledger", "recover", "continue previous task", "what is left", "review progress".
argument-hint: start|resume|update|close [task]
---

# Workflow Ledger

Use this skill to keep development work recoverable without turning progress notes into a transcript or spec.

## Core rule

Maintain one project overview file at `.claude/WORKFLOW.md` for Level 2/3 work and for any task the user wants tracked. The ledger is resume state: it should answer what is active, how far it got, and the next action to take.

Do not use the ledger for full operation logs, detailed diffs, raw GitNexus output, complete test output, temporary reasoning, or unrelated cleanup notes.

## Project installation contract

Recommended one-command project setup from the target project root:

```bash
curl -fsSL https://raw.githubusercontent.com/MorseWayne/workflow-ledger/main/install.sh | bash
```

For project-local use, the installer configures all three pieces:

1. Copy this skill to `.claude/skills/workflow-ledger`.
2. Add [examples/claude-project/CLAUDE.md.snippet](../../examples/claude-project/CLAUDE.md.snippet) to the project's `CLAUDE.md` if missing.
3. Create `.claude/WORKFLOW.md` from [templates/WORKFLOW.md](templates/WORKFLOW.md) if missing.

## Workflow levels

Classify first. If uncertain, choose the lighter level unless risk appears.

- **Level 0 — Q&A / read-only**: explain, answer, inspect without edits. No ledger required.
- **Level 1 — lightweight edit**: typo, docs tweak, formatting, tiny config, no runtime behavior change. Ledger optional.
- **Level 2 — standard code work**: small bugfix, single-module behavior change, tests, provider logic, repeatable multi-step work. Use ledger.
- **Level 3 — complex work**: new feature, cross-module or cross-repo changes, public API/data model changes, auth/streaming/concurrency/metrics, unclear requirements, high-risk impact. Use ledger and add attachments only when the ledger would otherwise become too long.

Escalate when you discover cross-file behavior changes, public API changes, failed validation, unclear requirements, or HIGH/CRITICAL impact.

## Ledger hygiene rules

- Default to at most one `Active` task.
- If multiple tasks are active, each needs a clear priority, blocker state, and `Resume next`.
- Update at milestone points only: task start, key decision, phase completion, blocker, validation result, interruption handoff, commit, or close.
- Do not rewrite `Completed` history except to fix an obvious error.
- Do not do cross-task cleanup while updating one task.
- Keep each Active task under roughly 80 lines.
- Keep each acceptance summary to five bullets or fewer.
- Move short-lived release, cleanup, and index-refresh tasks to `Completed` as soon as they finish.

## Ledger structure

`.claude/WORKFLOW.md` should contain:

1. `Active` — current task entries.
2. `Backlog / Future` — discovered tasks not needed for the current goal.
3. `Completed` — short milestone summaries and commits.

Each active task should have:

- stable ID: `WF-YYYY-MM-DD-NNN`
- status, level, dates, and current phase
- one user-visible goal
- key decisions only
- a `Phases:` overview
- `Current phase tasks:` for only the active phase
- short `Acceptance:` evidence
- one concrete `Resume next:` action

## Task shape

Use a phases overview instead of expanding every phase:

```markdown
Phases:
- [x] Phase 1 — Stabilize behavior: tests passed in commit abc1234.
- [ ] Phase 2 — Audit propagation: current objective.
- [ ] Phase 3 — Close gaps: expand only when current.

Current phase tasks:
- [ ] Trace usage propagation.
- [ ] Add the smallest missing regression test.
```

Completed phases should be summarized in `Acceptance:`. Future phases should stay coarse until they become current.

## Acceptance

Before marking a task or phase done, record short evidence:

```markdown
Acceptance:
- Review: confirmed behavior or review scope.
- Validation: command/manual check summary.
- GitNexus: impact/query summary or N/A.
- Commit: abc1234 or N/A until committed.
- Gaps: None or specific deferred item.
```

Keep it summary-level. Do not paste full command output, raw tool JSON, or long file lists.

## Backlog and discovered work

When a new prerequisite appears:

1. Add it to the current phase tasks or block the task.
2. Mark the task or phase as `Blocked` if work cannot continue.
3. Make `Resume next` the single unblock action.

When a useful task does not block the current goal:

1. Add it to `Backlog / Future`.
2. Do not insert it into the current phase.
3. Note the decision only if the reason matters for resuming.

## Start a tracked task

1. Locate or create `.claude/WORKFLOW.md` using [templates/WORKFLOW.md](templates/WORKFLOW.md).
2. Create one `Active` task entry.
3. Classify Level 0-3.
4. Define a short `Phases:` overview.
5. Expand only `Current phase tasks:`.
6. Set `Current phase` and one concrete `Resume next` action.

## Resume a task

1. Read `.claude/WORKFLOW.md`.
2. Find the single highest-priority `Active` task.
3. Use `Current phase`, `Current phase tasks`, and `Resume next` to continue.
4. Verify current repo state before trusting stale ledger details.
5. If code state differs from the ledger, update the ledger with the observed state.

## Close a task

1. Ensure required phases are done or explicitly deferred to `Backlog / Future`.
2. Add final `Acceptance:` evidence.
3. Move the task from `Active` to `Completed`.
4. Include commits, validation summary, GitNexus summary, and gaps.
5. Set follow-up work in `Backlog / Future` or write `None`.

## Interaction with other mechanisms

- Use TodoWrite for current-session execution tracking.
- Use `.claude/WORKFLOW.md` for cross-session recovery and milestone history.
- Use CLAUDE.md for short mandatory project rules.
- Use hooks only for advisory reminders or hard guardrails.
- Use heavier design/spec artifacts only for Level 3 work that genuinely needs them.
