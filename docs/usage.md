# Usage

## Install into a project

```bash
mkdir -p .claude/skills .claude
cp -R /path/to/workflow-ledger/skills/workflow-ledger .claude/skills/workflow-ledger
cp /path/to/workflow-ledger/skills/workflow-ledger/templates/WORKFLOW.md .claude/WORKFLOW.md
```

Add the CLAUDE.md snippet:

```bash
cat /path/to/workflow-ledger/examples/claude-project/CLAUDE.md.snippet >> CLAUDE.md
```

## Start tracking work

In Claude Code:

```text
/workflow-ledger start "add streaming usage accounting"
```

Claude should:

1. classify the task level
2. create or update `.claude/WORKFLOW.md`
3. define phases
4. expand only the current phase into concrete subtasks
5. use TodoWrite for the current session

## Resume work

```text
/workflow-ledger resume
```

Claude should read `.claude/WORKFLOW.md`, verify repo state, and continue from `Current phase` and `Resume next`.

## Close work

```text
/workflow-ledger close
```

Claude should move the task from `Active` to `Completed`, record acceptance summary, commits, gaps, and follow-up tasks.

## Keep it lightweight

Do not create attachments unless a Level 3 task needs long research, design details, or large validation output.
