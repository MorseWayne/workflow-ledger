---
name: workflow-ledger
description: Lightweight OpenSpec-style change ledger for Claude Code. Active only in projects initialized with workflow-ledger init, or when the user explicitly asks to initialize/setup/install Workflow Ledger.
when_to_use: Use for development tasks that need mutable todo tracking, prerequisites, blockers, deferred follow-ups, or cross-session recovery only when `.claude/WORKFLOW.md` already exists. If the project is not initialized, do not manage work with this skill; only explain how to run `npx workflow-ledger init`. Skip for pure Q&A and trivial one-step edits unless the user requests tracking. Trigger phrases include "start task", "resume task", "update", "close", "workflow", "ledger", "recover", "continue previous task", "what is left", "review progress", "init workflow-ledger", "setup workflow-ledger".
argument-hint: start|resume|update|close [task]
---

# Workflow Ledger

Use this skill to keep development work recoverable without turning progress notes into a transcript, full spec, or project-management system.

## Core rule

Activation is explicit. This skill must not manage ordinary development work until the current project has been initialized with Workflow Ledger. Before starting, resuming, updating, or closing tracked work, check for `.claude/WORKFLOW.md`.

- If `.claude/WORKFLOW.md` exists, the project is initialized; follow this skill normally.
- If `.claude/WORKFLOW.md` is missing and the user asked to initialize, install, or set up Workflow Ledger, guide them to run `npx workflow-ledger init` or the installer.
- If `.claude/WORKFLOW.md` is missing and the user asked for unrelated development work, do not create a ledger, do not classify the task with this workflow, and do not apply this skill beyond saying the project is not initialized.

Maintain one project overview file at `.claude/WORKFLOW.md` for Level 2/3 work and for any task the user wants tracked. The ledger is compressed resume state: it should answer what the active change is, what changed during execution, what is blocking or required next, and the one next action to take.

Do not use the ledger for full operation logs, detailed diffs, raw GitNexus output, complete test output, temporary reasoning, or unrelated cleanup notes.

## Project installation contract

Recommended project setup from the target project root:

```bash
npx workflow-ledger init
```

`init` installs the project-local skill, adds the Claude project reminder if missing, and creates `.claude/WORKFLOW.md` if missing.

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

`.claude/WORKFLOW.md` contains `Active`, `Backlog / Future`, and `Completed`.

Active entries should stay small and resumable:

- stable ID: `WF-YYYY-MM-DD-NNN`
- status, level, started/updated dates, and `Current phase`
- `Intent:` as the smallest user-visible goal
- mutable `Current todo:`
- resume-relevant `Changes:` only
- `Prerequisites:` or `None`
- optional `Blocked by:` when blocked
- one concrete `Resume next:` action

If blocked, set `Status: Blocked`, add `Blocked by:`, and make `Resume next` the single unblock action.

## Handling changing todos

When implementation reveals new work, first check whether related items belong to the same task family and can be completed and validated in the same iteration. If so, follow `Task merge suggestions` before writing separate ledger or TodoWrite items.

Then choose the smallest durable update:

- Same task family and same validation batch: ask whether to merge before updating `Current todo:`.
- Same intent and small todo/scope change: update `Current todo:` and add one `Changes:` bullet if it matters for resuming.
- New prerequisite for the current intent: add it to `Prerequisites:`; if it blocks progress, set `Status: Blocked` and add `Blocked by:`.
- Useful work that does not block the current intent: add it to `Backlog / Future` with a short deferred reason.
- Different intent or scope explosion: start a new task or use a heavier planning/spec process.

## Backlog and discovered work

Backlog is for non-blocking follow-up only. Each backlog item should include why it is deferred, but it does not need a strict schema.

Do not move non-blocking discoveries into `Current todo:` just because they were noticed during the task.

## Start a tracked task

1. Locate `.claude/WORKFLOW.md`. If it is missing, stop and ask the user to run `npx workflow-ledger init`; do not create it implicitly.
2. Before creating a new `Active` entry, compare the requested task with existing `Active` and `Backlog / Future` items. If they form the same task family and validation batch, follow `Task merge suggestions`.
3. Create one `Active` task entry unless the user approved merging into an existing task.
4. Classify Level 0-3.
5. Write the smallest `Intent:`.
6. Set mutable `Current todo:`.
7. Record `Prerequisites:` or `None`.
8. Set `Current phase` as the current focus and write one concrete `Resume next` action.

## Resume a task

1. Read `.claude/WORKFLOW.md`.
2. Find the single highest-priority `Active` task.
3. Use `Intent`, `Current phase`, `Current todo`, `Prerequisites`, `Blocked by`, and `Resume next` to continue.
4. Verify current repo state before trusting stale ledger details.
5. If code state differs from the ledger, update the ledger with the observed resume-relevant state.

## Update a task

1. Update only resume-relevant fields.
2. When rewriting `Current todo:`, first check whether sibling items can be suggested as one merged task-family item.
3. Prefer changing `Current todo:` over appending a history log.
4. Add one `Changes:` bullet only when the change explains why the next action or scope differs.
5. Keep raw command output, transcripts, and implementation details out of the ledger.

## Task merge suggestions

Suggest merging only when related items share a task family, can be completed in one iteration, can be validated together, and still form a clear user-visible todo.

Ask before changing `.claude/WORKFLOW.md`; never merge automatically. Keep the question short and show the proposed compact todo item, for example:

```markdown
- [ ] 6.T3-T5 Write status query state-branch unit tests: offline, unknown, not_deployed.
```

If the user approves, replace the sibling `Current todo:` items with the compact item and add at most one resume-relevant `Changes:` bullet. If the user declines, keep the items separate.

TodoWrite stays session-local. Ask about the merge before creating noisy separate TodoWrite items; after the user answers, update TodoWrite and the ledger to match the chosen execution shape.

## User-facing iteration summaries

Scale the summary to the work. For simple executions such as creating a commit, running one command, confirming status, or making a tiny edit, use a lightweight result: one short sentence or 2-4 compact bullets with only the outcome, validation if relevant, and next action. Do not force the full iteration template onto simple execution results.

When finishing a substantive iteration, closing a tracked task, or asking whether to continue multi-step work, report the result in a concise reader-oriented summary. Do not start with changed files or commands; lead with what this round did and why it mattered.

Use this order for substantive iteration summaries: `本轮任务` → `本轮目标` → `本轮结论` → `验证` → `Review 发现` → `变更` → `风险` → `提交状态` → `下一步`.

Required headings:

```markdown
本轮任务：
本轮目标：
本轮结论：
验证：
Review 发现：
变更：
风险：
提交状态：
下一步：
```

Keep the summary compact. Prefer short unordered bullets for `本轮任务` and `本轮目标`; those sections should let the user see the round's work and goal at a glance.

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
