---
name: workflow-ledger
description: Lightweight OpenSpec-style change ledger for Claude Code. Use when starting, resuming, updating, closing, or reviewing multi-step code work; when todos may change during implementation; when the user wants traceability without heavyweight specs; or when a task may be interrupted and continued later.
when_to_use: Use for development tasks that need mutable todo tracking, prerequisites, blockers, deferred follow-ups, or cross-session recovery. Skip for pure Q&A and trivial one-step edits unless the user requests tracking. Trigger phrases include "start task", "resume task", "update", "close", "workflow", "ledger", "recover", "continue previous task", "what is left", "review progress".
argument-hint: start|resume|update|close [task]
---

# Workflow Ledger

Use this skill to keep development work recoverable without turning progress notes into a transcript, full spec, or project-management system.

## Core rule

Maintain one project overview file at `.claude/WORKFLOW.md` for Level 2/3 work and for any task the user wants tracked. The ledger is compressed resume state: it should answer what the active change is, what changed during execution, what is blocking or required next, and the one next action to take.

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

- **Level 0 — Q&A / read-only / release bookkeeping**: explain, answer, inspect without edits, create tags, or publish release versions. No ledger required.
- **Level 1 — lightweight edit**: typo, docs tweak, formatting, tiny config, no runtime behavior change. Ledger optional.
- **Level 2 — standard code work**: small bugfix, single-module behavior change, tests, provider logic, repeatable multi-step work. Use ledger.
- **Level 3 — complex work**: new feature, cross-module or cross-repo changes, public API/data model changes, auth/streaming/concurrency/metrics, unclear requirements, high-risk impact. Use ledger and add attachments only when the ledger would otherwise become too long.

Escalate when you discover cross-file behavior changes, public API changes, failed validation, unclear requirements, or HIGH/CRITICAL impact.

## Ledger hygiene rules

- Default to at most one `Active` task.
- If multiple tasks are active, each needs a clear priority, blocker state, and `Resume next`.
- Update at milestone points only: task start, material scope/todo change, new prerequisite, blocker, validation result, interruption handoff, or close.
- Do not rewrite `Completed` history except to fix an obvious error.
- Do not do cross-task cleanup while updating one task.
- Keep each Active task under roughly 80 lines.
- If a short-lived release, cleanup, or index-refresh task is already tracked, move it to `Completed` as soon as it finishes.

## Ledger structure

`.claude/WORKFLOW.md` should contain:

1. `Active` — current change entries.
2. `Backlog / Future` — discovered tasks not needed for the current intent.
3. `Completed` — short close summaries.

Each active task should have:

- stable ID: `WF-YYYY-MM-DD-NNN`
- status, level, dates, and `Current phase` as the current focus
- `Intent:` as the smallest user-visible goal or change intent
- `Current todo:` as mutable next work, not a fixed plan
- `Changes:` for scope, todo, prerequisite, or blocker changes that matter for resume
- `Prerequisites:` for what must be true before continuing, or `None`
- optional `Blocked by:` when work cannot continue
- one concrete `Resume next:` action

## Task shape

Use one lightweight change entry instead of proposal/design/tasks/spec files:

```markdown
### WF-YYYY-MM-DD-001 — Task title
Status: In Progress
Level: 2
Started: YYYY-MM-DD
Last updated: YYYY-MM-DD
Current phase: Current focus name

Intent:
- One user-visible goal or change intent.

Current todo:
- [ ] Mutable next item.

Changes:
- Scope, todo, prerequisite, or blocker changes that matter for resume.

Prerequisites:
- Required before current work can proceed, or None.

Resume next:
- One concrete next action.
```

If blocked, set `Status: Blocked`, add `Blocked by:`, and make `Resume next` the single unblock action.

## Handling changing todos

When implementation reveals new work, choose the smallest durable update:

- Same intent and small todo/scope change: update `Current todo:` and add one `Changes:` bullet if it matters for resuming.
- New prerequisite for the current intent: add it to `Prerequisites:`; if it blocks progress, set `Status: Blocked` and add `Blocked by:`.
- Useful work that does not block the current intent: add it to `Backlog / Future` with a short deferred reason.
- Different intent or scope explosion: start a new task or use a heavier planning/spec process.

## Backlog and discovered work

Backlog is for non-blocking follow-up only. Each backlog item should include why it is deferred, but it does not need a strict schema.

Do not move non-blocking discoveries into `Current todo:` just because they were noticed during the task.

## Start a tracked task

1. Locate or create `.claude/WORKFLOW.md` using [templates/WORKFLOW.md](templates/WORKFLOW.md).
2. Create one `Active` task entry.
3. Classify Level 0-3.
4. Write the smallest `Intent:`.
5. Set mutable `Current todo:`.
6. Record `Prerequisites:` or `None`.
7. Set `Current phase` as the current focus and write one concrete `Resume next` action.

## Resume a task

1. Read `.claude/WORKFLOW.md`.
2. Find the single highest-priority `Active` task.
3. Use `Intent`, `Current phase`, `Current todo`, `Prerequisites`, `Blocked by`, and `Resume next` to continue.
4. Verify current repo state before trusting stale ledger details.
5. If code state differs from the ledger, update the ledger with the observed resume-relevant state.

## Update a task

1. Update only resume-relevant fields.
2. Prefer changing `Current todo:` over appending a history log.
3. Add one `Changes:` bullet only when the change explains why the next action or scope differs.
4. Keep raw command output, transcripts, and implementation details out of the ledger.

## Close a task

1. Ensure required work is done or explicitly deferred to `Backlog / Future`.
2. Move the task from `Active` to `Completed`.
3. Replace active-only fields with `Close summary:`.
4. Include only outcome, validation, and gaps.

Use this completed shape:

```markdown
### WF-YYYY-MM-DD-001 — Task title
Completed: YYYY-MM-DD
Level: 2

Close summary:
- Outcome: What changed.
- Validation: What passed.
- Gaps: None or deferred follow-up.
```

## Interaction with other mechanisms

- Use TodoWrite for current-session execution tracking.
- Use `.claude/WORKFLOW.md` for cross-session recovery and milestone history.
- Use CLAUDE.md for short mandatory project rules.
- Use hooks only for advisory reminders or hard guardrails.
- Use heavier design/spec artifacts only for Level 3 work that genuinely needs them.
