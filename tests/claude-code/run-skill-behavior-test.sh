#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass() { printf 'ok - %s\n' "$1"; }
fail() { printf 'not ok - %s\n' "$1" >&2; exit 1; }

node_eval() {
  node -e "$1"
}

package_version="$(node_eval "console.log(require('./package.json').version)")"
plugin_version="$(node_eval "console.log(require('./.claude-plugin/plugin.json').version)")"
marketplace_version="$(node_eval "console.log(require('./.claude-plugin/marketplace.json').plugins[0].version)")"

[ "$plugin_version" = "$package_version" ] || fail 'plugin.json version matches package.json'
pass 'plugin.json version matches package.json'

[ "$marketplace_version" = "$package_version" ] || fail 'marketplace.json version matches package.json'
pass 'marketplace.json version matches package.json'

hook_root="$TMP_DIR/hook-json"
mkdir -p "$hook_root/.claude"
cp "$REPO_ROOT/templates/WORKFLOW.md" "$hook_root/.claude/WORKFLOW.md"
(
  cd "$hook_root"
  CLAUDE_PLUGIN_ROOT=1 bash "$REPO_ROOT/hooks/session-start"
) >"$TMP_DIR/hook-json.out"
python3 -m json.tool "$TMP_DIR/hook-json.out" >"$TMP_DIR/hook-json.pretty" || fail 'plugin hook emits valid JSON'
pass 'plugin hook emits valid JSON'
grep -Fq 'hookSpecificOutput' "$TMP_DIR/hook-json.pretty" || fail 'plugin hook JSON includes hookSpecificOutput'
grep -Fq 'additionalContext' "$TMP_DIR/hook-json.pretty" || fail 'plugin hook JSON includes additionalContext'
pass 'plugin hook JSON includes additionalContext'

if ! command -v claude >/dev/null 2>&1; then
  fail 'claude command not found; default tests require Claude Code'
fi
pass 'claude command is available'

TEST_PROJECT="$TMP_DIR/project"
mkdir -p "$TEST_PROJECT/.claude/skills" "$TEST_PROJECT/.claude/bin"
cp -R "$REPO_ROOT/skills/workflow-ledger" "$TEST_PROJECT/.claude/skills/workflow-ledger"
cp "$REPO_ROOT/bin/workflow-ledger" "$TEST_PROJECT/.claude/bin/workflow-ledger"
cp "$REPO_ROOT/bin/workflow-ledger.js" "$TEST_PROJECT/.claude/bin/workflow-ledger.js"
chmod +x "$TEST_PROJECT/.claude/bin/workflow-ledger"
cp "$REPO_ROOT/templates/WORKFLOW.md" "$TEST_PROJECT/.claude/WORKFLOW.md"
pass 'temporary Claude Code project prepared'

PROMPT='You are testing the local workflow-ledger skill in this temporary project. Use the workflow-ledger skill to start a tracked Level 2 task with this exact goal: "Test plugin behavior wiring". Update only .claude/WORKFLOW.md. Keep the ledger concise: do not include transcripts, raw command output, or implementation details. Stop after the ledger has one Active task with Intent, Current todo, Changes, Prerequisites, Current phase, and Resume next.'

if ! (
  cd "$TEST_PROJECT"
  timeout 300 claude -p "$PROMPT" \
    --add-dir "$TEST_PROJECT" \
    --permission-mode bypassPermissions \
    >"$TMP_DIR/claude-out" 2>"$TMP_DIR/claude-err"
); then
  printf 'Claude stdout tail:\n' >&2
  tail -20 "$TMP_DIR/claude-out" >&2 || true
  printf 'Claude stderr tail:\n' >&2
  tail -20 "$TMP_DIR/claude-err" >&2 || true
  fail 'headless Claude Code behavior test completed'
fi
pass 'headless Claude Code behavior test completed'

LEDGER="$TEST_PROJECT/.claude/WORKFLOW.md"
[ -f "$LEDGER" ] || fail 'ledger exists after Claude run'
grep -Fq '## Active' "$LEDGER" || fail 'ledger contains Active section'
grep -Fq 'Test plugin behavior wiring' "$LEDGER" || fail 'ledger contains requested goal'
grep -Fq 'Intent:' "$LEDGER" || fail 'ledger contains Intent'
grep -Fq 'Current todo:' "$LEDGER" || fail 'ledger contains Current todo'
grep -Fq 'Changes:' "$LEDGER" || fail 'ledger contains Changes'
grep -Fq 'Prerequisites:' "$LEDGER" || fail 'ledger contains Prerequisites'
grep -Fq 'Current phase:' "$LEDGER" || fail 'ledger contains Current phase'
grep -Fq 'Resume next:' "$LEDGER" || fail 'ledger contains Resume next'
pass 'ledger contains required workflow fields'

line_count="$(wc -l < "$LEDGER")"
byte_count="$(wc -c < "$LEDGER")"
[ "$line_count" -le 120 ] || fail 'ledger stays under 120 lines'
[ "$byte_count" -le 8000 ] || fail 'ledger stays under 8000 bytes'
pass 'ledger remains concise'

if grep -Fq '```' "$LEDGER"; then
  fail 'ledger contains no fenced code blocks'
fi
if grep -Eiq 'tool_use|stdout|stderr' "$LEDGER"; then
  fail 'ledger contains no transcript markers'
fi
pass 'ledger avoids transcript markers'

if ! env WORKFLOW_LEDGER_ROOT="$TEST_PROJECT" "$REPO_ROOT/bin/workflow-ledger" doctor >"$TMP_DIR/doctor-out" 2>"$TMP_DIR/doctor-err"; then
  printf 'Doctor output:\n' >&2
  cat "$TMP_DIR/doctor-out" >&2 || true
  cat "$TMP_DIR/doctor-err" >&2 || true
  fail 'doctor accepts generated ledger'
fi
pass 'doctor accepts generated ledger'

printf 'all claude code behavior tests passed\n'
