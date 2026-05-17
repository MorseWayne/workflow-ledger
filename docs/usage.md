# Usage

## Install into a project

Recommended global setup:

```bash
npx workflow-ledger setup
```

Configure a specific AI coding tool:

```bash
npx workflow-ledger setup --tool claude-code
npx workflow-ledger setup --tool codex
npx workflow-ledger setup --tool all
```

Then initialize the project ledger from the project root. Bare `init` prompts for a language in an interactive terminal; automation can pass `--lang en` or `--lang zh-CN`:

```bash
npx workflow-ledger init
npx workflow-ledger init --lang en
npx workflow-ledger init --tool claude-code --lang en
npx workflow-ledger init --tool codex --lang en
npx workflow-ledger init --tool all --lang en
```

The `claude-code` project adapter creates `.claude/WORKFLOW.md` and updates `CLAUDE.md`. The `codex` project adapter creates `.workflow-ledger/WORKFLOW.md` and updates `AGENTS.md`. The language option controls newly created templates and instruction snippets.

The Bash installer remains available. It uses the Node.js CLI internally, so Node.js 18 or newer is required:

```bash
curl -fsSL https://raw.githubusercontent.com/MorseWayne/workflow-ledger/main/install.sh | bash
```

The init flow is idempotent:

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

After `setup --tool claude-code`, the same executable is also available at:

```bash
~/.claude/bin/workflow-ledger doctor
```

Install optional advisory hooks only when you want SessionStart reminders:

```bash
workflow-ledger hooks install
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
3. write the smallest `Intent`
4. set mutable `Current todo`, `Prerequisites`, and `Resume next`
5. use TodoWrite for the current session

## Resume work

```text
/workflow-ledger resume
```

Claude should read `.claude/WORKFLOW.md`, verify repo state, and continue from `Intent`, `Current phase`, `Current todo`, `Prerequisites`, `Blocked by`, and `Resume next`.

## Close work

```text
/workflow-ledger close
```

Claude should move the task from `Active` to `Completed` and record a short `Close summary` with outcome, validation, and gaps.

## Keep it lightweight

Do not create attachments unless a Level 3 task needs long research, design details, or large validation output.
