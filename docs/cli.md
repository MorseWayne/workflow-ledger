# CLI

`workflow-ledger` includes a small zero-dependency Bash CLI for project-local guardrails.

The installer copies it to:

```bash
.claude/bin/workflow-ledger
```

It does not modify your shell `PATH`.

## Commands

```bash
.claude/bin/workflow-ledger help
.claude/bin/workflow-ledger init
.claude/bin/workflow-ledger doctor
.claude/bin/workflow-ledger list
.claude/bin/workflow-ledger hooks status
.claude/bin/workflow-ledger hooks install
```

## `init`

Creates `.claude/WORKFLOW.md` from the installed template when the ledger is missing.

- Never overwrites an existing ledger.
- Prints guidance if the skill is not installed.
- Does not download remote content.

## `doctor`

Runs read-only health checks against `.claude/WORKFLOW.md`.

Errors return exit code `1`:

- Missing `.claude/WORKFLOW.md`.
- Missing core sections: `Active`, `Backlog / Future`, or `Completed`.
- In Progress task without `Current phase`.
- `Current phase` that does not exactly match a phase heading after trimming whitespace.
- Done phase without `Acceptance / Review`.
- Done phase missing `- Review:`, `- Validation:`, `- GitNexus:`, `- Tests:`, or `- Gaps:`.

Warnings do not fail the command:

- Level 2/3 task without `Resume next`.
- Ledger older than the latest git commit.
- Task with more than seven phases.
- Blocked phase without a literal `Blocked by` line.
- Backlog with more than 10 items.

## `list`

Prints a compact summary of active tasks, backlog count, and completed count.

If `.claude/WORKFLOW.md` is missing, `list` prints a message and exits `0`.

## Hooks

Hooks are optional and advisory.

```bash
.claude/bin/workflow-ledger hooks status
.claude/bin/workflow-ledger hooks install
```

`hooks install` writes these project-local hook files:

```text
.claude/hooks/hooks.json
.claude/hooks/session-start
```

It does not overwrite existing hook files and does not modify global Claude Code settings.
