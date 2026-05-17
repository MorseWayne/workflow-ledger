# Usage

## Install into a project

Recommended npm setup from the root of the project you want to configure:

```bash
npx workflow-ledger setup
```

Install for a specific AI coding tool:

```bash
npx workflow-ledger setup --tool claude-code
npx workflow-ledger setup --tool codex
npx workflow-ledger setup --tool all
```

The `claude-code` adapter installs `.claude/skills/workflow-ledger`, the `CLAUDE.md` rules snippet, `.claude/bin/workflow-ledger`, and `.claude/WORKFLOW.md`. The `codex` adapter installs the `AGENTS.md` rules snippet and `.workflow-ledger/WORKFLOW.md`.

The Bash installer remains available:

```bash
curl -fsSL https://raw.githubusercontent.com/MorseWayne/workflow-ledger/main/install.sh | bash
```

The setup flow is idempotent:

- installs the selected tool instructions
- creates the relevant Workflow Ledger file only if missing
- preserves existing instruction sections and ledgers

If you already have a local checkout:

```bash
/path/to/workflow-ledger/install.sh /path/to/your/project
```

Manual Claude Code install has three required project-local steps: copy the skill, add the `CLAUDE.md` snippet, and create the ledger file.

```bash
mkdir -p .claude/skills .claude
cp -R /path/to/workflow-ledger/skills/workflow-ledger .claude/skills/workflow-ledger
cp /path/to/workflow-ledger/skills/workflow-ledger/templates/WORKFLOW.md .claude/WORKFLOW.md
```

Add the `CLAUDE.md` snippet so Claude has an always-loaded reminder to use the skill for Level 2/3 work:

```bash
cat /path/to/workflow-ledger/examples/claude-project/CLAUDE.md.snippet >> CLAUDE.md
```

## CLI guardrails

After installation, you can run the CLI:

```bash
workflow-ledger doctor
workflow-ledger list
workflow-ledger hooks status
```

For Claude Code project-local installs, the copied CLI is also available:

```bash
.claude/bin/workflow-ledger doctor
```

Install optional advisory hooks only when you want SessionStart reminders:

```bash
.claude/bin/workflow-ledger hooks install
```

The CLI is a guardrail and summary tool. Claude still uses the `workflow-ledger` skill for the actual workflow.

## Start tracking work

In Claude Code:

```text
/workflow-ledger start "add streaming usage accounting"
```

Claude should:

1. classify the task level
2. create or update `.claude/WORKFLOW.md`
3. define a short `Phases:` overview
4. expand only `Current phase tasks`
5. use TodoWrite for the current session

## Resume work

```text
/workflow-ledger resume
```

Claude should read `.claude/WORKFLOW.md`, verify repo state, and continue from `Current phase`, `Current phase tasks`, and `Resume next`.

## Close work

```text
/workflow-ledger close
```

Claude should move the task from `Active` to `Completed`, record acceptance summary, commits, gaps, and follow-up tasks.

## Keep it lightweight

Do not create attachments unless a Level 3 task needs long research, design details, or large validation output.
