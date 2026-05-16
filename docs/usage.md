# Usage

## Install into a project

From the root of the project you want to configure, run:

```bash
curl -fsSL https://raw.githubusercontent.com/MorseWayne/workflow-ledger/main/install.sh | bash
```

The installer is idempotent:

- copies the skill to `.claude/skills/workflow-ledger`
- appends the `CLAUDE.md` snippet only if the Workflow Ledger section is missing
- creates `.claude/WORKFLOW.md` only if it does not already exist

If you already have a local checkout:

```bash
/path/to/workflow-ledger/install.sh /path/to/your/project
```

Manual install has three required project-local steps: copy the skill, add the `CLAUDE.md` snippet, and create the ledger file.

```bash
mkdir -p .claude/skills .claude
cp -R /path/to/workflow-ledger/skills/workflow-ledger .claude/skills/workflow-ledger
cp /path/to/workflow-ledger/skills/workflow-ledger/templates/WORKFLOW.md .claude/WORKFLOW.md
```

Add the `CLAUDE.md` snippet so Claude has an always-loaded reminder to use the skill for Level 2/3 work:

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
