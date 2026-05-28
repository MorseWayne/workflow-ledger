---
name: workflow-ledger
description: Lightweight OpenSpec-style change ledger for Claude Code. Active only in projects initialized with workflow-ledger init, or when the user explicitly asks to initialize/setup/install Workflow Ledger.
when_to_use: Use for development tasks that need mutable todo tracking, prerequisites, blockers, deferred follow-ups, or cross-session recovery only when `.claude/WORKFLOW.md` already exists. If the project is not initialized, do not manage work with this skill; only explain how to run `npx workflow-ledger init`. Skip for pure Q&A and trivial one-step edits unless the user requests tracking. Trigger phrases include "start task", "resume task", "update", "close", "workflow", "ledger", "recover", "continue previous task", "what is left", "review progress", "init workflow-ledger", "setup workflow-ledger".
argument-hint: start|plan|resume|update|close [task or design text]
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
- `Plan:` for Level 2/3 long-running work; use stable item ids such as `P1`, `P2`
- mutable `Current todo:` that references the active Plan item when a Plan exists
- resume-relevant `Changes:` only; use `- None` if there are no resume-relevant changes
- `Prerequisites:` or `None`
- optional `Blocked by:` when blocked
- one concrete `Resume next:` action

If blocked, set `Status: Blocked`, add `Blocked by:`, and make `Resume next` the single unblock action.

For existing Active Level 2/3 tasks that predate the history-preserving close workflow, add or refresh a compact `History so far:` section on the first workflow-ledger interaction after adoption. Keep `Current phase`, `Current todo`, and `Resume next` untouched while the task remains Active. `History so far` should preserve the original intent if clear, current Plan statuses, completed milestones, key Changes or decisions, validation already performed, and known deferred or gap items.

## Plan long-running work

Use `/workflow-ledger plan` when the user wants to turn an existing design document, pasted design text, issue description, or implementation outline into a durable Workflow Ledger task plan before coding starts.

1. Locate `.claude/WORKFLOW.md`. If it is missing, stop and ask the user to run `npx workflow-ledger init`; do not create it implicitly.
2. Read the design text from the command arguments, the user's selected text, an explicitly provided file path, or the user's pasted content. If no source is available, ask for the design text.
3. Extract a compact long-term `Plan:` with stable ids: `P1`, `P2`, `P3`, etc. Prefer phase-sized tasks that are independently reviewable and testable.
4. Use Plan statuses exactly as needed: `todo`, `doing`, `done`, `blocked`, `deferred`, `removed`, `merged`.
5. Preserve history by changing Plan item statuses instead of deleting old items. For `blocked`, `deferred`, `removed`, and `merged`, include a short reason in the same line.
6. Create a new Active task or update the current matching Active task. Keep `Intent:` user-visible and small.
7. Set `Current todo:` to the first actionable Plan item and include that Plan id, for example `- [ ] P1 — Review existing API boundaries`.
8. Set `Current phase` and `Resume next` from the same first actionable Plan item.
9. Record prerequisites found in the design text under `Prerequisites:`; non-blocking discoveries go to `Backlog / Future`.

Use this Plan item shape:

```markdown
Plan:
- [todo] P1 — Review existing API boundaries.
- [todo] P2 — Implement parser changes.
- [blocked] P3 — Validate migration. Blocked: staging dataset is not available yet.
- [deferred] P4 — Add dashboard polish. Deferred: outside the first implementation slice.
```

## Iteration checkpoint

Run an iteration checkpoint after completing any Plan item or `Current todo` item. This is mandatory for tracked Level 2/3 work.

1. Update `.claude/WORKFLOW.md` before reporting the item as complete.
2. Change the completed Plan item from `doing` to `done`; if it is blocked or deferred, use `blocked` or `deferred` with a short reason.
3. Select the next actionable Plan item and change it from `todo` to `doing`. If no actionable Plan item remains, prepare to close the task or ask what should happen next.
4. Update `Current todo:` so it references only the active `doing` Plan item.
5. Update `Current phase` and `Resume next` to match the active Plan item or close/unblock action.
6. Add one resume-relevant `Changes:` bullet when the checkpoint changes scope, sequence, blocker state, or validation status.
7. Run relevant validation for the completed item and note gaps or deferred work.
8. If files changed, commit the code, tests, docs, and ledger update together unless the user explicitly said not to commit.
9. Present a concise step summary with outcome, validation, gaps, commit status, and next Plan item.
10. Ask whether to continue to the next Plan item instead of automatically running through the rest of the Plan.

Checkpoint summary shape:

```markdown
本步完成：
验证：
Gaps：
提交：
下一步：
要继续吗？
```

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
6. For Level 2/3 work, create an upfront `Plan:` before coding. If the user provided design text, use `Plan long-running work` to convert it into stable Plan items.
7. Set mutable `Current todo:` to the first actionable item; reference the Plan id when a Plan exists.
8. Record `Prerequisites:` or `None`.
9. Set `Current phase` as the current focus and write one concrete `Resume next` action.

## Resume a task

1. Read `.claude/WORKFLOW.md`.
2. Find the single highest-priority `Active` task.
3. Use `Intent`, `Plan`, `Current phase`, `Current todo`, `Prerequisites`, `Blocked by`, and `Resume next` to continue.
4. Verify current repo state before trusting stale ledger details.
5. If code state differs from the ledger, update the ledger with the observed resume-relevant state.

## Update a task

1. Update only resume-relevant fields.
2. Preserve Plan history by changing item statuses rather than deleting old items.
3. When rewriting `Current todo:`, first check whether sibling items can be suggested as one merged task-family item.
4. Prefer changing `Current todo:` over appending a history log.
5. Add one `Changes:` bullet only when the change explains why the next action or scope differs.
6. Keep raw command output, transcripts, and implementation details out of the ledger.

## Preserve history for existing Active tasks

When a project already has Active Level 2/3 tasks and this workflow is adopted, proactively preserve their process history before they close.

1. On the first workflow-ledger interaction after adoption, inspect every Active Level 2/3 task.
2. If one lacks `History so far:`, add it before or alongside the requested update.
3. If one already has `History so far:`, refresh it only when the requested update changes Plan status, material Changes, validation, deferred work, or gaps.
4. If the requested interaction is `close` and `History so far:` is missing, create `Archived execution:` directly from the current Active task body; do not block the close just to add an intermediate section.
5. If multiple Active Level 2/3 tasks exist, apply the check to each one without reordering, merging, or otherwise disrupting task priority.

Use this compact shape:

```markdown
History so far:
- Intent: Original goal or current best summary.
- Completed milestones:
  - [done] P1 — Completed milestone.
- Key changes:
  - Important scope or decision changes so far.
- Validation:
  - Checks already performed.
- Deferred / gaps:
  - Known follow-up or None.
```

Level 1 tasks do not need `History so far:` unless the user asks for traceability or the task already has meaningful phase history.

## Task merge suggestions

Suggest merging only when related items share a task family, can be completed in one iteration, can be validated together, and still form a clear user-visible todo.

Ask before changing `.claude/WORKFLOW.md`; never merge automatically. Keep the question short and show the proposed compact todo item, for example:

```markdown
- [ ] 6.T3-T5 Write status query state-branch unit tests: offline, unknown, not_deployed.
```

If the user approves, replace the sibling `Current todo:` items with the compact item and keep a `Changes:` field with at most one resume-relevant bullet. If there is no resume-relevant change, write `- None`. If the user declines, keep the items separate.

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
3. Treat close as an archival transition, not a summary replacement.
4. Add `Close summary:` with outcome, validation, and gaps for quick scanning.
5. For Level 2/3 tasks, add `Archived execution:` after `Close summary:` so the task remains auditable.
6. Build `Archived execution:` from `History so far:` if present, reconciled with the final Plan state. If `History so far:` is missing, derive it directly from the Active task body.
7. Remove active-only recovery fields from the Completed entry: `Current phase`, `Current todo`, `Resume next`, and `Blocked by`, unless a blocker became a final gap.
8. Preserve Plan terminal statuses and short reasons for `blocked`, `deferred`, `removed`, and `merged` items.
9. Keep archive sections compact: 1-3 bullets per subsection unless the original Plan has more items.

Use this completed shape for Level 2/3 tasks:

```markdown
### WF-YYYY-MM-DD-001 — Task title
Completed: YYYY-MM-DD
Level: 2

Close summary:
- Outcome: What changed.
- Validation: What passed.
- Gaps: None or deferred follow-up.

Archived execution:
- Intent: Original goal or user-visible change intent.
- Plan:
  - [done] P1 — Completed milestone.
  - [deferred] P2 — Deferred milestone. Deferred: reason.
- Key changes:
  - Scope, todo, prerequisite, or blocker changes that mattered.
- Validation:
  - Checks, tests, reviews, or manual verification performed.
- Deferred / gaps:
  - Follow-up work, known omissions, or None.
```

Level 1 tasks may use only `Close summary:` unless they have meaningful process history or the user asks for traceability.

## Interaction with other mechanisms

- Use TodoWrite for current-session execution tracking.
- Use `.claude/WORKFLOW.md` for cross-session recovery and milestone history.
- Use CLAUDE.md for short mandatory project rules.
- Use hooks only for advisory reminders or hard guardrails.
- Use heavier design/spec artifacts only for Level 3 work that genuinely needs them.
