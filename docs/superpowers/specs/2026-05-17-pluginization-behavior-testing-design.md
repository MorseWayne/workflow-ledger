# Workflow Ledger Pluginization and Behavior Testing Design

## Goal

Make workflow-ledger more productized as a Claude Code workflow tool by adding a Claude plugin manifest, standardizing SessionStart hook output for plugin use, and adding a real Claude Code behavior test to the default test suite.

## Scope

This change covers three pieces only:

1. Claude Code plugin metadata for local or marketplace-style installation.
2. A SessionStart hook that supports both plugin JSON output and existing project-local text output.
3. A headless Claude Code behavior test wired into `npm test`.

It does not add full multi-platform plugin directories for Cursor, OpenCode, Gemini, or Codex beyond the current Codex setup support.

## Architecture

### Plugin metadata

Add `.claude-plugin/plugin.json` with this exact shape:

```json
{
  "name": "workflow-ledger",
  "description": "Lightweight, recoverable workflow ledger for Claude Code projects",
  "version": "0.3.5",
  "author": {
    "name": "MorseWayne"
  },
  "homepage": "https://github.com/MorseWayne/workflow-ledger",
  "repository": "https://github.com/MorseWayne/workflow-ledger",
  "license": "MIT",
  "keywords": [
    "claude-code",
    "skills",
    "workflow",
    "ledger",
    "recoverability"
  ]
}
```

Add `.claude-plugin/marketplace.json` for local development marketplace testing:

```json
{
  "name": "workflow-ledger-dev",
  "description": "Development marketplace for workflow-ledger",
  "owner": {
    "name": "MorseWayne"
  },
  "plugins": [
    {
      "name": "workflow-ledger",
      "description": "Lightweight, recoverable workflow ledger for Claude Code projects",
      "version": "0.3.5",
      "source": "./",
      "author": {
        "name": "MorseWayne"
      }
    }
  ]
}
```

The plugin manifest does not replace `hooks/hooks.json`. The plugin root continues to ship `hooks/hooks.json`, which points SessionStart at `hooks/session-start`; `.claude-plugin/plugin.json` provides marketplace metadata only.

Version synchronization remains manual in this phase, but tests must assert that both plugin manifest versions match `package.json`. Automated release tooling can be added later if multi-platform manifests grow.

### SessionStart hook

Keep `hooks/session-start` as the single hook script.

The script builds one short reminder only when `.claude/WORKFLOW.md` exists:

- read `.claude/WORKFLOW.md` before resuming tracked work
- check Active tasks, Current phase, and Resume next
- run doctor if state may be stale

Output behavior:

- If `CLAUDE_PLUGIN_ROOT` is set, emit this exact Claude Code hook JSON shape:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Workflow Ledger detected.\n- Read .claude/WORKFLOW.md before resuming tracked work.\n- Check Active tasks, Current phase, and Resume next.\n- Run workflow-ledger doctor if state may be stale."
  }
}
```

- If `CLAUDE_PLUGIN_ROOT` is not set, emit the existing plain text reminder for project-local hooks.
- If no ledger exists, exit quietly.

The doctor suggestion should prefer `.claude/bin/workflow-ledger doctor` only when that project-local CLI exists and is executable. In plugin context, the reminder should say `workflow-ledger doctor` rather than assuming a `.claude/bin` path, because plugin installation does not imply a project-local CLI.

This preserves current local behavior while making the hook valid in plugin context.

### Behavior test

Add `tests/claude-code/run-skill-behavior-test.sh` and include it in the `npm test` script after existing CLI tests.

The test creates a temporary project, installs the local workflow-ledger skill and CLI into that project, creates a minimal ledger, then runs Claude Code in headless mode with a 300 second timeout.

Command shape:

```bash
timeout 300 claude -p "$PROMPT" \
  --add-dir "$TEST_PROJECT" \
  --permission-mode bypassPermissions
```

Prompt text:

```text
You are testing the local workflow-ledger skill in this temporary project. Use the workflow-ledger skill to start a tracked Level 2 task with this exact goal: "Test plugin behavior wiring". Update only .claude/WORKFLOW.md. Keep the ledger concise: do not include transcripts, raw command output, or implementation details. Stop after the ledger has one Active task with Current phase and Resume next.
```

The test verifies observable behavior rather than trusting Claude's response:

- `.claude/WORKFLOW.md` exists
- it contains `Test plugin behavior wiring`
- it contains `## Active`
- it contains `Current phase:`
- it contains `Resume next:`
- the ledger is no more than 120 lines and 8,000 bytes
- the ledger does not contain fenced code blocks or obvious transcript markers such as `tool_use`, `stdout`, or `stderr`
- `.claude/bin/workflow-ledger doctor` exits 0 after Claude writes the ledger

Because this test is part of `npm test`, absence of the `claude` command is a hard failure with a clear setup message.

The test must use a temp directory and `trap 'rm -rf "$TMP_DIR"' EXIT` so successful and failed runs do not leak temp projects.

## Data and file flow

1. `npm test` runs shell CLI tests, Node CLI tests, plugin manifest version checks, and the new behavior test.
2. The new behavior test creates a temp project.
3. The test copies repository files into `.claude/skills/workflow-ledger` and `.claude/bin/workflow-ledger`.
4. Claude Code runs against the temp project with access to the repo checkout and temp project.
5. Assertions read only the generated `.claude/WORKFLOW.md` and test output.

No network access or external project modification is required.

## Error handling

- Missing `claude`: fail with a direct message explaining that default tests require Claude Code.
- Claude timeout or non-zero exit: fail and print captured output path or tail.
- Missing ledger fields: fail with precise assertions.
- Oversized ledger: fail to protect the core product promise that workflow-ledger is not a transcript.

## Testing

Run:

```bash
npm test
```

Expected coverage:

- existing Bash CLI doctor/list/init/hooks behavior
- existing Node setup/init adapter behavior
- new Claude Code skill behavior in a temporary project

## Future work

- Add a release consistency check for versions across `package.json` and plugin manifests.
- Add optional manual tests for Codex and other harnesses.
- Add plugin marketplace installation docs once the plugin manifest is validated in real use.
