#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$REPO_ROOT/bin/workflow-ledger"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass() { printf 'ok - %s\n' "$1"; }
fail() { printf 'not ok - %s\n' "$1" >&2; exit 1; }
copy_fixture() {
  local name="$1" dest="$2"
  mkdir -p "$dest"
  cp -R "$REPO_ROOT/tests/fixtures/$name/." "$dest/"
}

run_ok() {
  local name="$1"; shift
  "$@" >"$TMP_DIR/out" 2>"$TMP_DIR/err" || fail "$name"
  pass "$name"
}

run_fail() {
  local name="$1"; shift
  if "$@" >"$TMP_DIR/out" 2>"$TMP_DIR/err"; then
    fail "$name"
  fi
  pass "$name"
}

root="$TMP_DIR/healthy"
copy_fixture healthy "$root"
run_ok 'doctor returns 0 for healthy ledger' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" doctor
grep -Fq 'doctor finished with 0 errors' "$TMP_DIR/out" || fail 'healthy doctor output'

run_ok 'list prints active task and current phase' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" list
grep -Fq 'Healthy task' "$TMP_DIR/out" || fail 'list active task'
grep -Fq 'Current phase: Phase 1 — Build CLI' "$TMP_DIR/out" || fail 'list current phase'

root="$TMP_DIR/missing-acceptance"
copy_fixture missing-acceptance "$root"
run_fail 'doctor returns 1 for missing Acceptance / Review' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" doctor
grep -Fq 'lacks Acceptance / Review' "$TMP_DIR/out" || fail 'missing acceptance error'

root="$TMP_DIR/missing-current-phase"
copy_fixture missing-current-phase "$root"
run_fail 'doctor returns 1 for missing Current phase' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" doctor
grep -Fq 'lacks Current phase' "$TMP_DIR/out" || fail 'missing current phase error'

root="$TMP_DIR/missing-section"
copy_fixture missing-section "$root"
run_fail 'doctor returns 1 for missing core section' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" doctor
grep -Fq 'Missing ## Completed section' "$TMP_DIR/out" || fail 'missing section error'

root="$TMP_DIR/missing-ledger"
mkdir -p "$root"
run_fail 'doctor returns 1 when ledger is missing' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" doctor
grep -Fq '.claude/WORKFLOW.md is missing' "$TMP_DIR/out" || fail 'missing ledger error'

run_ok 'list exits 0 when ledger is missing' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" list
grep -Fq 'No .claude/WORKFLOW.md found' "$TMP_DIR/err" || fail 'missing ledger list message'

root="$TMP_DIR/init-new"
mkdir -p "$root/.claude/skills/workflow-ledger/templates"
cp "$REPO_ROOT/skills/workflow-ledger/templates/WORKFLOW.md" "$root/.claude/skills/workflow-ledger/templates/WORKFLOW.md"
run_ok 'init creates ledger when absent' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" init
[ -f "$root/.claude/WORKFLOW.md" ] || fail 'init created ledger file'

printf 'custom ledger\n' > "$root/.claude/WORKFLOW.md"
run_ok 'init does not overwrite existing ledger' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" init
grep -Fq 'custom ledger' "$root/.claude/WORKFLOW.md" || fail 'init preserved ledger'

root="$TMP_DIR/hooks-missing"
mkdir -p "$root"
run_ok 'hooks status reports not installed' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" hooks status
grep -Fq 'hooks: not installed' "$TMP_DIR/out" || fail 'hooks not installed status'

root="$TMP_DIR/hooks-installed"
copy_fixture hooks-installed "$root"
run_ok 'hooks status reports installed' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" hooks status
grep -Fq 'hooks: installed' "$TMP_DIR/out" || fail 'hooks installed status'

root="$TMP_DIR/hooks-install"
mkdir -p "$root"
run_ok 'hooks install creates hook files' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" hooks install
[ -f "$root/.claude/hooks/hooks.json" ] || fail 'hooks.json installed'
[ -x "$root/.claude/hooks/session-start" ] || fail 'session-start installed executable'

printf 'existing\n' > "$root/.claude/hooks/hooks.json"
run_ok 'hooks install does not overwrite existing files' env WORKFLOW_LEDGER_ROOT="$root" "$CLI" hooks install
grep -Fq 'existing' "$root/.claude/hooks/hooks.json" || fail 'hooks install preserved existing hooks.json'

printf 'all cli tests passed\n'
