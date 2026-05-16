# Design

`workflow-ledger` is a lightweight workflow layer for Claude Code projects.

## Problem

Long-running Claude Code tasks can be interrupted, resumed in a new session, or continued by another agent. Plain chat history and current-session todos are not enough for reliable recovery. Heavy spec systems solve this with many files and formal stages, but that is too much for everyday development.

## Approach

Use one milestone overview file, `.claude/WORKFLOW.md`, plus a reusable Claude Code skill.

The skill teaches Claude how to:

- classify task weight
- create or update a phased task entry
- track dependencies and discovered future work
- record acceptance/review results after each completed phase
- close completed work into a concise history section

## Non-goals

- No per-task file by default.
- No mandatory proposal/design/tasks documents.
- No mandatory hook automation.
- No heavyweight CLI runtime or package manager; the optional CLI stays zero-dependency and project-local.

## File model

- `.claude/WORKFLOW.md`: project-local milestone ledger.
- `.claude/skills/workflow-ledger/SKILL.md`: reusable workflow instructions.
- Optional attachments: only for long Level 3 details.

## Task levels

- Level 0: Q&A/read-only, no ledger.
- Level 1: lightweight edit, ledger optional.
- Level 2: standard code work, ledger required.
- Level 3: complex work, ledger required and optional attachments allowed.

## Recovery model

To resume work, read `.claude/WORKFLOW.md`, find `Active`, follow `Current phase`, unchecked subtasks, dependencies, and `Resume next`. Verify the current repository state before trusting stale ledger entries.
