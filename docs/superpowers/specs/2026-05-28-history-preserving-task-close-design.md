# Workflow Ledger History-Preserving Close Design

## Goal

Workflow Ledger should keep completed work auditable. Closing a task must not replace the task process with only a final `Close summary`. Instead, completion should produce a short summary for scanning plus a compact archived execution record for later回溯.

## Scope

This change is limited to instruction policy, templates, and user documentation:

1. Update the workflow-ledger skill guidance for task close behavior.
2. Update the default WORKFLOW templates so completed task examples include archived execution history.
3. Update usage documentation in English and Chinese.
4. Define how already-active tasks should adopt the new workflow without losing resume state.

Out of scope:

- CLI auto-close behavior.
- New doctor warnings.
- Changes to `src/workflow-ledger.ts` parsing or validation.
- Automatic migration logic outside Claude's normal workflow-ledger edits.
- Retrofitting old Completed entries automatically.

The required behavior is implemented by changing the instructions and examples Claude follows when editing `.claude/WORKFLOW.md`; it is not a runtime behavior change in the CLI.

## Current problem

The current Completed example contains only:

- completion date;
- level;
- `Close summary` with outcome, validation, and gaps.

That is useful for quick scanning, but it can erase the process that made Workflow Ledger valuable: original intent, phase progression, todo evolution, validation checkpoints, and deferred work. Once the task is closed, a future reader cannot reconstruct what happened or why certain work was deferred.

## Design

### Close as archival transition

Closing a task is an archival transition, not a summary replacement.

A completed task should have two layers:

1. `Close summary` — short, user-visible completion result.
2. `Archived execution` — compact process record for回溯.

Recommended completed-task shape:

```markdown
### WF-YYYY-MM-DD-000 — Completed task title
Completed: YYYY-MM-DD
Level: 2

Close summary:
- Outcome: User-visible result.
- Validation: Checks performed.
- Gaps: Remaining follow-up or none.

Archived execution:
- Intent: Original goal or user-visible change intent.
- Plan:
  - [done] P1 — Completed milestone.
  - [done] P2 — Completed milestone.
  - [deferred] P3 — Deferred milestone. Deferred: reason.
- Key changes:
  - Scope, todo, prerequisite, or blocker changes that mattered.
- Validation:
  - Checks, tests, reviews, or manual verification performed.
- Deferred / gaps:
  - Follow-up work, known omissions, or `None`.
```

### Compression rules

When moving an Active task to Completed:

- Preserve the original intent if it is still clear.
- Preserve Plan item terminal states: `done`, `deferred`, `blocked`, `removed`, or `merged`.
- Preserve only Changes that matter for understanding scope, decisions, blockers, or resume history.
- Preserve validation results and known gaps.
- Remove Active-only recovery fields: `Current phase`, `Current todo`, `Resume next`, and `Blocked by`, unless a blocker became a final gap.
- Do not copy transcript-like detail, command output, or large implementation notes.
- Keep the archived record compact enough that Completed remains browsable.

Acceptance checks for a Level 2/3 completed task:

- Required headings: `Close summary:` and `Archived execution:`.
- `Close summary` contains `Outcome`, `Validation`, and `Gaps` bullets.
- `Archived execution` contains `Intent`, `Plan`, `Validation`, and `Deferred / gaps` bullets.
- `Archived execution` may contain `Key changes` when the Active task had material `Changes` entries.
- `Archived execution` must not contain `Current phase`, `Current todo`, or `Resume next` headings.
- Any copied Plan item keeps its final status marker and any explicit deferred/blocker reason.
- If a detail is unknown, use `Unknown` only for the missing sub-bullet; do not invent history.
- Prefer at most 1-3 bullets per archive subsection unless the original Plan has more items.

### Existing active task upgrade

When this instruction update is adopted in a project that already has Active tasks, Claude should proactively preserve process history before those tasks close. This proactive step happens through normal workflow-ledger file edits, not a background migration.

For existing Active Level 2/3 tasks:

1. On the first workflow-ledger interaction after adoption, inspect every Active Level 2/3 task.
2. If an Active Level 2/3 task lacks `History so far`, add it before or alongside the requested workflow update.
3. If an Active Level 2/3 task already has `History so far`, refresh it only when the requested workflow update changes Plan status, material Changes, validation, deferred work, or gaps.
4. If the requested interaction is `close` and `History so far` is absent, create `Archived execution` directly from the current Active task body; do not block the close just to add an intermediate section.
5. If multiple Active Level 2/3 tasks exist, apply the check to each one, but only modify tasks whose missing or stale history would affect traceability. Do not reorder or merge them as part of this upgrade.
6. Keep normal resume fields untouched while the task remains Active: `Current phase`, `Current todo`, and `Resume next`.
7. On final close, convert `History so far` into `Archived execution`, reconcile it with the final Plan state, then add `Close summary`.

`History so far` captures:

- original intent if clear;
- current Plan statuses;
- completed milestones so far;
- key Changes / decisions;
- validation already performed;
- known deferred or gap items.

Recommended active-task addition:

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
  - Known follow-up or `None`.
```

For Level 1 tasks, `History so far` is optional unless the user asks for traceability or the task already contains meaningful phase history.

### Skill behavior

The workflow-ledger skill should instruct Claude to:

- treat `/workflow-ledger close` and close-like requests as archival transitions;
- write both `Close summary` and `Archived execution` for Level 2/3 completed tasks;
- avoid replacing the task body with only a close summary;
- proactively add or refresh `History so far` for existing Active Level 2/3 tasks on the first workflow-ledger interaction after adoption;
- on close, create `Archived execution` directly from the Active task if `History so far` is missing;
- avoid rewriting old Completed entries unless the user explicitly asks or an obvious error needs correction.

### Templates

Both WORKFLOW templates should show the new completed-task structure. The example should remain short so new ledgers do not look heavy, but it must demonstrate that completed tasks keep a compact process record.

Templates to update:

- `templates/WORKFLOW.md`
- `skills/workflow-ledger/templates/WORKFLOW.md`

### Documentation

Usage docs should explain:

- Completed entries are for both scanning and回溯.
- `Close summary` is not a replacement for process history.
- Existing Active tasks can be upgraded by adding `History so far` without changing resume fields.

Docs to update:

- `docs/usage.md`
- `docs/usage.zh-CN.md`

## Data and file flow

1. User works on a tracked task in `.claude/WORKFLOW.md`.
2. On the first workflow-ledger interaction after this instruction update, Claude checks existing Active Level 2/3 tasks for `History so far`.
3. If the current interaction is not close, Claude adds or refreshes `History so far` for qualifying Active tasks without changing `Current phase`, `Current todo`, or `Resume next`.
4. If the current interaction is close and `History so far` is missing, Claude derives `Archived execution` directly from the Active task body and final Plan state.
5. On close, Claude creates `Close summary` from the final outcome and validation.
6. The task moves to Completed with `Close summary` and `Archived execution` together.

## Error handling

- Missing process details: write `Unknown` or omit that sub-bullet rather than inventing history.
- Excessive detail: compress to decision-level bullets; do not paste transcript or raw command output.
- Ambiguous deferred work: record it under `Deferred / gaps` with a short reason.
- Existing Completed task lacks archive: do not rewrite it by default; ask before changing historical entries.
- Active task has no meaningful history yet: add a minimal `History so far` only when it improves future回溯.

## Testing

This is a documentation and template behavior change, so validation focuses on consistency:

1. Check both WORKFLOW templates use the same Completed example structure.
2. Check skill guidance and usage docs agree on `Close summary`, `Archived execution`, and `History so far` semantics.
3. Check Level 2/3 examples meet the acceptance checks: required headings exist, Active-only recovery headings are absent from `Archived execution`, and `History so far` does not replace resume fields while Active.
4. Run `git diff --check`.
5. Run the relevant existing test command if available and lightweight; otherwise document why it was skipped.

## Success criteria

- New completed-task examples include `Close summary` and `Archived execution`.
- The workflow-ledger skill explicitly forbids replacing process history with only a close summary.
- Existing Active Level 2/3 tasks have a documented first-interaction upgrade path through `History so far`, plus a close-time fallback that derives `Archived execution` directly if needed.
- No CLI runtime behavior changes are introduced.
