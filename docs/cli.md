# CLI

`workflow-ledger` includes a Node.js CLI for setup, initialization, ledger checks, task summaries, and optional hook installation.

The npm package exposes it as `workflow-ledger`. `setup --tool claude-code` also copies the same executable to:

```bash
~/.claude/bin/workflow-ledger
```

It does not modify your shell `PATH`; use `npx workflow-ledger ...` when you do not have the package installed globally.

## Commands

```bash
workflow-ledger setup --tool claude-code
workflow-ledger setup --tool codex
workflow-ledger setup --tool all
workflow-ledger init
workflow-ledger init --lang en
workflow-ledger init --lang zh-CN
workflow-ledger init --tool claude-code --lang en
workflow-ledger init --tool codex --lang en
workflow-ledger init --tool all --lang en
workflow-ledger doctor
workflow-ledger list
workflow-ledger hooks status
workflow-ledger hooks install
```

## `setup`

Installs global Workflow Ledger integrations for supported AI coding tools.

- `--tool claude-code` installs the global Claude Code skill to `~/.claude/skills/workflow-ledger` and copies the Node CLI to `~/.claude/bin/workflow-ledger`.
- `--tool codex` installs the Codex skill to `~/.agents/skills/workflow-ledger` when `~/.codex` exists.
- `--tool all` configures all detected adapters.

`setup` is environment-level and may skip tools that are not installed. It only makes Workflow Ledger available; it does not activate the workflow in every project.

## `init`

Creates project-local Workflow Ledger files for selected tools. This is the activation step for a repository. Bare `init` asks for a language when run in a terminal; pass `--lang en` or `--lang zh-CN` for non-interactive use.

- `--tool claude-code` creates `.claude/WORKFLOW.md` and updates `CLAUDE.md`.
- `--tool codex` creates `.workflow-ledger/WORKFLOW.md` and updates `AGENTS.md`.
- `--tool all` initializes both project adapters.
- `--lang en` creates English ledger templates and instruction snippets.
- `--lang zh-CN` creates Simplified Chinese ledger templates and instruction snippets.
- `--root PATH` targets a project root other than the current directory.

`init` preserves existing ledger files and instruction sections. Without `init`, installed skills stay dormant for ordinary development work.

## `doctor`

Runs read-only health checks against `.claude/WORKFLOW.md`.

Errors return exit code `1`:

- Missing `.claude/WORKFLOW.md`.
- Missing core sections: `Active`, `Backlog / Future`, or `Completed`.
- In Progress task without `Current phase`.
- In Progress task without `Intent`.
- In Progress task without `Current todo`.
- In Progress task without `Resume next`.
- Blocked task without `Blocked by` or `Resume next`.

Warnings do not fail the command:

- More than one Active task.
- Level 2/3 task without `Changes` or `Prerequisites`.
- Ledger older than the latest git commit.
- Active task with more than 80 lines.
- Completed task still under `Active` without `Close summary`.
- Backlog with more than 10 items.

## `list`

Prints a compact summary of active tasks, current focus, resume next action, backlog count, and completed count.

If `.claude/WORKFLOW.md` is missing, `list` prints a message and exits `0`.

## Hooks

Hooks are optional and advisory.

```bash
workflow-ledger hooks status
workflow-ledger hooks install
```

`hooks install` writes these project-local hook files:

```text
.claude/hooks/hooks.json
.claude/hooks/session-start
```

It does not overwrite existing hook files and does not modify global Claude Code settings.
