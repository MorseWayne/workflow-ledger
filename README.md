# workflow-ledger

A lightweight workflow memory layer for Claude Code.

`workflow-ledger` helps Claude Code projects stay **traceable, resumable, and reviewable** without forcing every change through a heavyweight spec process.

It is designed for one common failure mode of AI-assisted development:

> The conversation is interrupted, context is compacted, or a new session starts — and nobody can immediately tell what was done, what was accepted, what is blocked, and what should happen next.

`workflow-ledger` solves this with a single project overview file: `.claude/WORKFLOW.md`.

[中文文档](README.zh-CN.md)

## Why this workflow exists

Many workflow systems solve recoverability by creating a lot of structure:

- proposal files
- design files
- task files
- per-feature folders
- phase-specific artifacts
- command-specific state

That is valuable for large feature work, but too heavy for everyday Claude Code development. Most tasks need something smaller:

- one place to see active work
- phased tasks instead of a flat checklist
- clear acceptance and review notes
- visible dependencies and deferred work
- a resume point for the next session
- optional deep attachments only when needed

`workflow-ledger` keeps the parts that matter and removes the parts that slow small tasks down.

## What it gives you

- **One milestone overview**: `.claude/WORKFLOW.md` is the source of truth.
- **Task levels**: Level 0-3 classification keeps simple work light and complex work safer.
- **Phase tree**: tasks are organized as phases with subtasks, not one long flat list.
- **Acceptance next to work**: each completed phase records review, validation, tests, gaps, and tool findings.
- **Recoverability**: every active task has `Current phase` and `Resume next`.
- **Dependency discipline**: blockers become dependencies; non-blocking discoveries go to Backlog/Future.
- **Low file count**: no per-task files by default.
- **Claude Code native**: shipped as a reusable skill, no runtime dependency required.

## How it compares

| Approach | Strength | Tradeoff | workflow-ledger stance |
|---|---|---|---|
| Chat history only | Zero setup | Hard to recover after interruption or compaction | Not enough for multi-step work |
| Todo list only | Great for current session | Not durable across sessions | Use TodoWrite for in-session execution only |
| Heavy spec workflows | Strong governance and traceability | Many files and stage overhead | Use only when Level 3 work truly needs it |
| Hooks-first automation | Deterministic enforcement | Can become noisy and rigid | Use hooks as optional guardrails, not the workflow engine |
| `workflow-ledger` | Durable, lightweight, reviewable | Requires updating one ledger file at milestones | Default for recoverable Claude Code work |

## Inspired by existing workflows

`workflow-ledger` borrows ideas from spec-driven and skill-driven workflows, but intentionally stays smaller.

- From spec-driven systems such as OpenSpec: phased work, explicit acceptance, resumable state.
- From Claude Code skills and Superpowers-style workflows: reusable procedural guidance that loads when needed.
- From hooks: the idea that some actions may need hard guardrails, while keeping those guardrails optional.

The key design decision is simple:

> Mandatory project rules stay short. Detailed workflow guidance lives in a skill. Durable progress lives in one ledger file.

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

## The ledger shape

A tracked task is organized like this:

```markdown
### WF-2026-05-16-001 — Add streaming usage accounting
Status: In Progress
Level: 2
Current phase: Phase 2 — Implement conversion fix

Phases:

#### Phase 1 — Research current flow
Status: Done
Tasks:
- [x] Trace request flow
- [x] Identify affected symbols

Acceptance / Review:
- Review: Confirmed affected provider path.
- Validation: Read current tests and conversion code.
- GitNexus: Impact analysis showed medium risk.
- Tests: Not run in research phase.
- Gaps: Implementation pending.

#### Phase 2 — Implement conversion fix
Status: In Progress
Tasks:
- [ ] Update converter
- [ ] Add regression test

Resume next:
- Continue with converter update.
```

## Workflow levels

| Level | Use for | Ledger? |
|---|---|---|
| Level 0 | Q&A, read-only explanation | No |
| Level 1 | typo, docs tweak, tiny config, no behavior change | Optional |
| Level 2 | standard code work, tests, single-module behavior changes | Yes |
| Level 3 | new features, cross-module work, public APIs, unclear or high-risk changes | Yes, attachments optional |

## Design principles

- Keep the overview file useful at a glance.
- Expand only the current phase; keep future phases coarse until needed.
- Put acceptance and review results next to completed work.
- Record why dependencies or future tasks were added.
- Avoid process for process's sake.
- Prefer one durable ledger over many scattered notes.

## When to use

Use `workflow-ledger` for:

- multi-step implementation work
- tasks likely to span sessions
- work where review history matters
- debugging or refactoring with dependencies
- any task where you need to know what is done and what is left

Skip it for:

- pure Q&A
- trivial one-step changes
- throwaway exploration
- tasks where the user explicitly says not to track

## Repository status

This is an early, skill-first version. Future versions may add an optional CLI, but the first goal is to keep the tool easy to copy into any Claude Code project.
