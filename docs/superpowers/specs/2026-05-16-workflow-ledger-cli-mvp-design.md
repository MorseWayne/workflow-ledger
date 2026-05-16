# Workflow Ledger CLI MVP Design

Date: 2026-05-16

## Summary

Add a zero-dependency Bash CLI MVP to workflow-ledger while preserving the project’s lightweight, skill-first, single-ledger-file model. The CLI is an auxiliary guardrail, not the workflow engine.

## Goals

- Provide a stable command entry point for common project-local checks.
- Add a read-only `doctor` command that detects stale or malformed ledger state.
- Add a lightweight `list` command for quick status summaries.
- Add an `init` command that creates the ledger if missing without overwriting existing work.
- Add optional SessionStart hook installation and status checks.
- Strengthen the skill and CLAUDE snippet with anti-rationalization rules and phase completion gates.
- Keep runtime dependencies at zero.

## Non-goals

- Do not introduce Node.js, Python packages, or a package manager.
- Do not replace the Claude Code skill workflow.
- Do not parse Markdown as a full AST.
- Do not create per-task directories or mandatory proposal/design/task files.
- Do not enable hooks by default.
- Do not modify shell PATH automatically.

## File layout

New files:

```text
bin/workflow-ledger
hooks/session-start
hooks/hooks.json
tests/run-cli-tests.sh
tests/fixtures/
docs/cli.md
```

Updated files:

```text
install.sh
README.md
README.zh-CN.md
docs/usage.md
docs/design.md
docs/design.zh-CN.md
skills/workflow-ledger/SKILL.md
examples/claude-project/CLAUDE.md.snippet
```

## Architecture

`bin/workflow-ledger` is the single CLI entry point. It operates on the current project directory by default and only touches project-local workflow-ledger files.

The CLI may read:

- `.claude/WORKFLOW.md`
- `.claude/hooks/hooks.json`
- `.claude/hooks/session-start`
- git metadata when available

The CLI may write only for explicit mutating commands:

- `init`
- `hooks install`

All other commands are read-only.

The installed project-local CLI path is:

```bash
.claude/bin/workflow-ledger
```

The installer copies the CLI there but does not alter PATH.

## Commands

### `help`

Print usage, commands, and exit codes. Always exits `0`.

### `init`

Create `.claude/` and `.claude/WORKFLOW.md` if the ledger is missing.

Rules:

- Never overwrite an existing ledger.
- If the project-local skill is missing, print guidance to run the installer.
- Do not download remote content.

Exit `0` when the ledger is created successfully, when the ledger already exists, or when the only issue is that the project-local skill is missing and guidance was printed. Exit `1` when `.claude/` or `.claude/WORKFLOW.md` cannot be created due to permission or filesystem errors.

### `doctor`

Run read-only ledger health checks.

Phase status is determined by the `Status:` field under each `#### Phase N — Name` heading. Valid values are `Pending`, `In Progress`, `Blocked`, and `Done`.

Exit codes:

- `0`: no errors
- `1`: one or more errors

Warnings do not fail the command.

Errors:

- `.claude/WORKFLOW.md` is missing.
- Core sections are missing: `Active`, `Backlog / Future`, or `Completed`.
- An In Progress task lacks `Current phase`.
- A `Current phase` value cannot be matched to a phase heading. Match by exact string after trimming whitespace from the `Current phase` value and each `#### Phase N — Name` heading.
- A Done phase lacks `Acceptance / Review`.
- A Done phase `Acceptance / Review` lacks any required key: `Review`, `Validation`, `GitNexus`, `Tests`, or `Gaps`. The keys are detected as bullet lines starting with `- Review:`, `- Validation:`, `- GitNexus:`, `- Tests:`, and `- Gaps:` under the phase's `Acceptance / Review:` heading.

Warnings:

- Level 2/3 active task lacks `Resume next`.
- Ledger modified time is older than the latest git commit time.
- A task has more than seven phases.
- A Blocked phase lacks a literal `Blocked by` line.
- `Backlog / Future` contains more than 10 unchecked or bullet-list items.

Info:

- Active task count.
- In Progress phase count.
- Ledger modification time.
- Latest git commit time when available.
- Hook installation status.

### `list`

Print a compact ledger summary.

Output includes:

- Active task headings.
- Status and Level when available.
- Current phase when available.
- Backlog item count.
- Completed item count.

The command uses line-oriented parsing and should warn rather than fail on unfamiliar formatting. If `.claude/WORKFLOW.md` does not exist, print a message to stderr and exit `0` because there are no tasks to list. Exit `0` for readable empty or partial output, including parse warnings. Exit `1` only when `.claude/WORKFLOW.md` exists but cannot be read.

### `hooks status`

Report whether optional SessionStart hook files are installed in `.claude/hooks/`. Exit `0` when status is reported successfully, whether installed or not installed. Exit `1` only when required paths cannot be read due to permission or filesystem errors.

### `hooks install`

Install optional hook files into `.claude/hooks/`. Exit `0` when hooks are installed or when installation is a no-op because target files already exist. Exit `1` when `.claude/hooks/` cannot be created or hook files cannot be copied.

Rules:

- Create `.claude/hooks/` if missing.
- Write canonical `session-start` and `hooks.json` files into `.claude/hooks/`; source templates are kept in `hooks/` for readability.
- Do not overwrite existing hook files.
- Do not modify global Claude Code settings.
- Do not run network commands.

## Optional SessionStart hook

The hook is advisory only. `hooks/hooks.json` registers the SessionStart event and invokes `.claude/hooks/session-start`. The minimum installed structure is:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "command": ".claude/hooks/session-start"
      }
    ]
  }
}
```

`hooks status` checks that `.claude/hooks/hooks.json` exists, declares a `SessionStart` command pointing to `.claude/hooks/session-start`, and that the script exists and is executable. The script uses a POSIX shell shebang, prints advisory text to stdout, exits `0`, and never treats missing files as fatal. It emits a short reminder when a project contains `.claude/WORKFLOW.md`:

- Read `.claude/WORKFLOW.md` before resuming tracked work.
- Check Active tasks, `Current phase`, and `Resume next`.
- Run `.claude/bin/workflow-ledger doctor` if state may be stale.

The hook must not mutate files, block the session, or call the network.

## Skill rule hardening

Add anti-rationalization rules to the skill and CLAUDE snippet.

Examples:

| Rationalization | Required behavior |
|---|---|
| This is too small for the ledger | Classify first; Level 2/3 must be tracked |
| I will update the ledger at the end | Update at phase completion, blockers, key decisions, and handoff points |
| Tests passed, so the phase is done | Record validation evidence and remaining gaps before marking Done |
| TodoWrite is enough | TodoWrite is session-local; the ledger is cross-session state |
| Formatting does not matter | Preserve stable fields so `doctor` can check the ledger |

## Phase completion gate

Before marking a phase Done, the phase must include:

```markdown
Acceptance / Review:
- Review:
- Validation:
- GitNexus:
- Tests:
- Gaps:
```

Rules:

- `Validation` must name actual checks, or explain why validation is not applicable.
- `Tests` must name commands run, or explain why tests were omitted.
- `Gaps` must explicitly say `None` or list known risks.
- If validation fails, the phase remains `In Progress` or `Blocked`.

## Machine-readable metadata foundation

The template may include an optional HTML comment block for future structured parsing:

```markdown
<!-- workflow-ledger:task
id: WF-2026-05-16-001
level: 2
status: In Progress
current_phase: Phase 1 — Research
updated: 2026-05-16
-->
```

MVP commands must not require this block. Existing ledgers remain valid without migration.

## Tests

Add Bash tests with fixtures.

Initial coverage:

- Healthy ledger makes `doctor` return `0`.
- Missing `Acceptance / Review` in a Done phase makes `doctor` return `1`.
- In Progress task without `Current phase` makes `doctor` return `1`.
- `list` prints Active task and Current phase.
- `hooks status` reports not installed for a fresh fixture.
- `init` does not overwrite an existing `.claude/WORKFLOW.md`.
- `doctor` returns `1` when `.claude/WORKFLOW.md` is missing.
- `doctor` returns `1` when a core section such as `Completed` is missing.
- `init` creates `.claude/WORKFLOW.md` when the file is absent.
- `init` creates `.claude/` when the directory is absent.
- `hooks install` creates hook files and does not overwrite existing files.
- `hooks status` reports installed when `.claude/hooks/hooks.json` and `.claude/hooks/session-start` are present and the script is executable.
- `doctor` still succeeds for non-git directories and when `git` is unavailable; git freshness checks become Info/Warning only when metadata is available.

Tests must not use network access or external packages.

## Documentation

Update documentation to describe the CLI as optional guardrails:

- README: quick CLI overview.
- README.zh-CN.md: translated overview.
- docs/usage.md: install and command examples.
- docs/design.md: replace the first-version no-CLI non-goal with the new CLI boundary.
- docs/design.zh-CN.md: corresponding Chinese translation of the updated design boundary.
- docs/cli.md: command reference and exit codes.

## Risks and mitigations

### Bash parsing is brittle

Mitigation: keep checks line-oriented, conservative, and warning-oriented when uncertain.

### CLI scope creep

Mitigation: CLI only supports guardrails, summaries, initialization, and optional hook install. It does not execute workflow phases.

### Hook noise

Mitigation: hooks are optional, advisory, and project-local.

### Breaking existing ledgers

Mitigation: no migration required; metadata comments are optional; doctor reports issues but does not rewrite files.

## Acceptance criteria

- `install.sh` installs the skill, snippet, ledger template, and project-local CLI without changing PATH.
- `.claude/bin/workflow-ledger doctor` works in a configured project.
- `doctor` returns nonzero for fixture ledgers with structural errors.
- `list` provides a useful summary for the template and fixture ledgers.
- Optional hooks can be installed and status-checked.
- Documentation explains the CLI boundary and preserves the lightweight design story.
