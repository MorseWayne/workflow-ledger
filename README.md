# workflow-ledger

A lightweight OpenSpec-style change ledger for Claude Code.

`workflow-ledger` helps Claude Code projects stay **traceable, resumable, and adaptable** without forcing every change through proposal/design/task/spec files.

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

- one place to see the active change intent
- a mutable current todo instead of a frozen plan
- visible prerequisites, blockers, and deferred work
- a resume point for the next session
- a short close summary when work finishes

`workflow-ledger` keeps the parts that matter and removes the parts that slow small tasks down.

## What it gives you

- **One change ledger**: `.claude/WORKFLOW.md` is the source of truth.
- **Task levels**: Level 0-3 classification keeps simple work light and complex work safer.
- **Intent-first entries**: each active task records one small user-visible intent.
- **Mutable todo**: `Current todo` can change as requirements, prerequisites, or blockers appear.
- **Recoverability**: every active task has `Current phase` as current focus and `Resume next`.
- **Dependency discipline**: blocking prerequisites stay in the active entry; non-blocking discoveries go to Backlog/Future.
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

## Compared with specific tools

| Tool / workflow | Best at | Typical shape | Where `workflow-ledger` differs |
|---|---|---|---|
| Superpowers-style skills | Teaching Claude repeatable behaviors through reusable skills and checklists | Skill packs with detailed procedures, design/planning loops, and explicit human approval gates | Uses the same skill-native delivery model, but narrows the scope to task memory: one ledger, change intent, mutable todo, prerequisites, and resume points |
| GSD-style planning workflows | Breaking large work into researched phases with verification, security, UI, or evaluation reviews | Multi-agent planning and execution, phase documents, review reports, and stronger process gates | Keeps the recoverability pattern but removes most ceremony for day-to-day work; heavyweight review artifacts stay outside the default ledger |
| OpenSpec-style spec workflows | Governing product or API changes with proposals, specs, tasks, and archival history | Formal proposal/design/task files with a spec lifecycle | Borrows intent/change discipline, but avoids making every change start with proposal/design/tasks/spec files |
| Claude Code hooks | Deterministically enforcing a rule at tool or lifecycle boundaries | Event handlers for commands such as pre-tool, post-tool, stop, or compact | Treats hooks as optional guardrails; the workflow state remains human-readable in `.claude/WORKFLOW.md` |
| TodoWrite / session todos | Managing what Claude is doing right now | In-session checklist that is easy to update frequently | Uses TodoWrite for live execution only; the ledger stores durable milestones and handoff context |

In short: Superpowers teaches behaviors, GSD coordinates heavier execution, OpenSpec governs formal changes, hooks enforce events, and TodoWrite tracks the current session. `workflow-ledger` is the smaller missing layer between them: a single-file, OpenSpec-lite memory for everyday Claude Code development.

## Inspired by existing workflows

`workflow-ledger` borrows ideas from spec-driven and skill-driven workflows, but intentionally stays smaller.

- From spec-driven systems such as OpenSpec: explicit change intent, dependency awareness, and archive-style close summaries.
- From Claude Code skills and Superpowers-style workflows: reusable procedural guidance that loads when needed.
- From hooks: the idea that some actions may need hard guardrails, while keeping those guardrails optional.

The key design decision is simple:

> Mandatory project rules stay short. Detailed workflow guidance lives in a skill. Durable change state lives in one ledger file.

## Install

Recommended global tool setup:

```bash
npx workflow-ledger setup
```

Configure specific AI coding tools:

```bash
npx workflow-ledger setup --tool claude-code
npx workflow-ledger setup --tool codex
npx workflow-ledger setup --tool all
```

`setup` only installs the integration so supported agents can find it. It does not activate Workflow Ledger in every project.

Then initialize a project ledger from the target project root. Bare `init` asks you to choose a language first; automation can pass `--lang en` or `--lang zh-CN` to skip the prompt:

```bash
npx workflow-ledger init
npx workflow-ledger init --lang en
npx workflow-ledger init --tool claude-code --lang en
npx workflow-ledger init --tool codex --lang en
npx workflow-ledger init --tool all --lang en
```

`init` is the activation step. It creates project-local ledger files and short instruction snippets. Without `init`, the skill stays dormant for ordinary development work. `claude-code` uses `.claude/WORKFLOW.md`; `codex` uses `.workflow-ledger/WORKFLOW.md` plus `AGENTS.md`. The language choice controls newly created ledger templates and tool instruction snippets; existing files are not overwritten.

If you used the previous Bash installer, migrate to the `npx workflow-ledger init` flow above.

Manual project-local install for Claude Code:

```bash
mkdir -p .claude/skills
cp -R skills/workflow-ledger .claude/skills/workflow-ledger
```

Personal install only installs the skill; project setup still needs the `CLAUDE.md` snippet and `.claude/WORKFLOW.md`:

```bash
mkdir -p ~/.claude/skills
cp -R skills/workflow-ledger ~/.claude/skills/workflow-ledger
```

The CLI can check and summarize the ledger:

```bash
npx workflow-ledger doctor
npx workflow-ledger list
```

See [docs/cli.md](docs/cli.md) for command details. The CLI is an optional guardrail; it does not replace the skill workflow.

Then invoke it in Claude Code:

```text
/workflow-ledger start "implement auth flow"
/workflow-ledger resume
/workflow-ledger close
```

## Project setup

A project needs two layers:

1. Global tool setup with `workflow-ledger setup` so supported agents can find the workflow instructions.
2. Project initialization with `workflow-ledger init` so the repository has a ledger file and a short tool-specific reminder. This is what makes Workflow Ledger active for that project.

For Claude Code, `init` adds the snippet from [examples/claude-project/CLAUDE.md.snippet](examples/claude-project/CLAUDE.md.snippet) to your project's `CLAUDE.md` and creates [skills/workflow-ledger/templates/WORKFLOW.md](skills/workflow-ledger/templates/WORKFLOW.md) at `.claude/WORKFLOW.md`.

For Codex, `init --tool codex` adds [examples/codex-project/AGENTS.md.snippet](examples/codex-project/AGENTS.md.snippet) to `AGENTS.md` and creates [templates/WORKFLOW.md](templates/WORKFLOW.md) at `.workflow-ledger/WORKFLOW.md`.

## The ledger shape

A tracked task is organized like this:

```markdown
### WF-2026-05-16-001 — Add streaming usage accounting
Status: In Progress
Level: 2
Current phase: Implement conversion fix

Intent:
- Stabilize streaming usage accounting without expanding the ledger into a transcript.

Current todo:
- [ ] Update converter.
- [ ] Add regression test.

Changes:
- 2026-05-16 — Current implementation path narrowed to the provider conversion code.

Prerequisites:
- Existing streaming usage tests must be checked before editing.

Resume next:
- Update the converter and add the smallest regression test.
```

## Workflow levels

| Level | Use for | Ledger? |
|---|---|---|
| Level 0 | Q&A, read-only explanation, tagging or release-version publishing | No |
| Level 1 | typo, docs tweak, tiny config, no behavior change | Optional |
| Level 2 | standard code work, tests, single-module behavior changes | Yes |
| Level 3 | new features, cross-module work, public APIs, unclear or high-risk changes | Yes, attachments optional |

## Design principles

- Keep the overview file useful at a glance.
- Keep the active intent small and current.
- Treat `Current todo` as mutable when implementation reveals new work.
- Record why prerequisites or future tasks were added.
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

This version uses the Node.js CLI as the single implementation for setup, init, doctor, list, and hooks. The Bash installer remains as a small bootstrap wrapper for Claude Code project initialization.
