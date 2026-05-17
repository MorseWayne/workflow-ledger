# CLI

`workflow-ledger` includes a small zero-dependency Bash CLI for project-local guardrails.

The installer copies it to:

```bash
.claude/bin/workflow-ledger
```

It does not modify your shell `PATH`.

## Commands

```bash
workflow-ledger setup --tool claude-code
workflow-ledger setup --tool codex
workflow-ledger setup --tool all
workflow-ledger init --tool claude-code
workflow-ledger init --tool codex
workflow-ledger init --tool all
workflow-ledger doctor
workflow-ledger list
workflow-ledger hooks status
workflow-ledger hooks install
```

## `setup`

Installs global Workflow Ledger integrations for supported AI coding tools.

- `--tool claude-code` installs the global Claude Code skill to `~/.claude/skills/workflow-ledger` and copies the local CLI to `~/.claude/bin/workflow-ledger`.
- `--tool codex` installs the Codex skill to `~/.agents/skills/workflow-ledger` when `~/.codex` exists.
- `--tool all` configures all detected adapters.

`setup` is environment-level and may skip tools that are not installed.

## `init`

Creates project-local Workflow Ledger files for selected tools.

- `--tool claude-code` creates `.claude/WORKFLOW.md` and updates `CLAUDE.md`.
- `--tool codex` creates `.workflow-ledger/WORKFLOW.md` and updates `AGENTS.md`.
- `--tool all` initializes both project adapters.
- `--root PATH` targets a project root other than the current directory.

`init` preserves existing ledger files and instruction sections.

## `doctor`

Runs read-only health checks against `.claude/WORKFLOW.md`.

Errors return exit code `1`:

- Missing `.claude/WORKFLOW.md`.
- Missing core sections: `Active`, `Backlog / Future`, or `Completed`.
- In Progress task without `Current phase`.
- `Current phase` that does not exactly match a phase heading or `Phases:` overview item.
- Done phase without `Acceptance` / `Acceptance / Review`.
- Done phase missing `- Review:`, `- Validation:`, `- GitNexus:`, `- Commit:` or `- Tests:`, or `- Gaps:`.
- New-style task with completed `Phases:` items but no task-level `Acceptance` evidence.

Warnings do not fail the command:

- More than one Active task.
- Level 2/3 task without `Resume next`.
- Ledger older than the latest git commit.
- Task with more than seven phases.
- Active task with more than 80 lines.
- Acceptance with more than five bullets.
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
