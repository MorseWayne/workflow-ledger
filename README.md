# workflow-ledger

A lightweight Claude Code workflow toolkit for tracking development work without turning every task into a heavyweight spec process.

`workflow-ledger` provides a reusable Claude Code skill that helps teams keep one milestone-style overview file per project:

- classify tasks by workflow level
- track active work by phases and subtasks
- record dependencies and discovered future work
- summarize acceptance and review results next to completed phases
- preserve resume points for interrupted work
- avoid creating many files unless a task truly needs attachments

## Install

Copy or symlink the skill into your Claude Code skills directory.

Project-local install:

```bash
mkdir -p .claude/skills
cp -R skills/workflow-ledger .claude/skills/workflow-ledger
```

Personal install:

```bash
mkdir -p ~/.claude/skills
cp -R skills/workflow-ledger ~/.claude/skills/workflow-ledger
```

Then invoke it in Claude Code:

```text
/workflow-ledger start "implement auth flow"
/workflow-ledger resume
/workflow-ledger close
```

## Project setup

Add the snippet from [examples/claude-project/CLAUDE.md.snippet](examples/claude-project/CLAUDE.md.snippet) to your project's `CLAUDE.md`.

Create a project ledger from [skills/workflow-ledger/templates/WORKFLOW.md](skills/workflow-ledger/templates/WORKFLOW.md):

```bash
mkdir -p .claude
cp skills/workflow-ledger/templates/WORKFLOW.md .claude/WORKFLOW.md
```

## Design principles

- One overview file first: `.claude/WORKFLOW.md` is the source of truth.
- Phased task tree, not flat checklist.
- Acceptance/review summary lives next to each completed phase.
- Attachments are optional and rare.
- Hooks are optional guardrails, not the workflow engine.
- Skills explain how to work; project instructions and hooks decide what must happen.

## When to use

Use `workflow-ledger` for multi-step development work, code changes that may span sessions, or any task where recovery matters.

Skip it for pure Q&A, trivial typos, or one-step changes unless the user asks for traceability.
