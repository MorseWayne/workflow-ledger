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

prepare_project() {
  local project="$1"
  mkdir -p "$project/.claude/skills" "$project/.claude/bin"
  cp -R "$REPO_ROOT/skills/workflow-ledger" "$project/.claude/skills/workflow-ledger"
  cp "$REPO_ROOT/bin/workflow-ledger.js" "$project/.claude/bin/workflow-ledger"
  chmod +x "$project/.claude/bin/workflow-ledger"
  cp "$REPO_ROOT/templates/WORKFLOW.md" "$project/.claude/WORKFLOW.md"
}

run_claude_case() {
  local project="$1" label="$2" prompt="$3"
  if ! (
    cd "$project"
    timeout 300 claude -p "$prompt" \
      --add-dir "$project" \
      --permission-mode bypassPermissions \
      --model sonnet \
      >"$TMP_DIR/$label-claude-out" 2>"$TMP_DIR/$label-claude-err"
  ); then
    printf 'Claude stdout tail (%s):\n' "$label" >&2
    tail -20 "$TMP_DIR/$label-claude-out" >&2 || true
    printf 'Claude stderr tail (%s):\n' "$label" >&2
    tail -20 "$TMP_DIR/$label-claude-err" >&2 || true
    fail "headless Claude Code behavior test completed ($label)"
  fi
  pass "headless Claude Code behavior test completed ($label)"
}

assert_common_ledger() {
  local project="$1" goal="$2" label="$3"
  local ledger="$project/.claude/WORKFLOW.md"
  [ -f "$ledger" ] || fail "ledger exists after Claude run ($label)"
  grep -Fq '## Active' "$ledger" || fail "ledger contains Active section ($label)"
  grep -Fq "$goal" "$ledger" || fail "ledger contains requested goal ($label)"
  grep -Fq 'Intent:' "$ledger" || fail "ledger contains Intent ($label)"
  grep -Fq 'Current todo:' "$ledger" || fail "ledger contains Current todo ($label)"
  grep -Fq 'Changes:' "$ledger" || fail "ledger contains Changes ($label)"
  grep -Fq 'Prerequisites:' "$ledger" || fail "ledger contains Prerequisites ($label)"
  grep -Fq 'Current phase:' "$ledger" || fail "ledger contains Current phase ($label)"
  grep -Fq 'Resume next:' "$ledger" || fail "ledger contains Resume next ($label)"
  pass "ledger contains required workflow fields ($label)"

  local line_count byte_count
  line_count="$(wc -l < "$ledger")"
  byte_count="$(wc -c < "$ledger")"
  [ "$line_count" -le 120 ] || fail "ledger stays under 120 lines ($label)"
  [ "$byte_count" -le 8000 ] || fail "ledger stays under 8000 bytes ($label)"
  pass "ledger remains concise ($label)"

  if grep -Fq '```' "$ledger"; then
    fail "ledger contains no fenced code blocks ($label)"
  fi
  if grep -Eiq 'tool_use|stdout|stderr' "$ledger"; then
    fail "ledger contains no transcript markers ($label)"
  fi
  pass "ledger avoids transcript markers ($label)"

  if ! env WORKFLOW_LEDGER_ROOT="$project" node "$REPO_ROOT/bin/workflow-ledger.js" doctor >"$TMP_DIR/$label-doctor-out" 2>"$TMP_DIR/$label-doctor-err"; then
    printf 'Doctor output (%s):\n' "$label" >&2
    cat "$TMP_DIR/$label-doctor-out" >&2 || true
    cat "$TMP_DIR/$label-doctor-err" >&2 || true
    fail "doctor accepts generated ledger ($label)"
  fi
  pass "doctor accepts generated ledger ($label)"
}

assert_one_active_task() {
  local ledger="$1" label="$2"
  python3 - "$ledger" <<'PY' || fail "ledger has one Active task ($label)"
import sys
text = open(sys.argv[1], encoding='utf-8').read()
try:
    active = text.split('## Active', 1)[1].split('## Backlog / Future', 1)[0]
except IndexError:
    raise SystemExit(1)
count = sum(1 for line in active.splitlines() if line.startswith('### '))
if count != 1:
    raise SystemExit(1)
PY
  pass "ledger has one Active task ($label)"
}

START_PROJECT="$TMP_DIR/project-start"
prepare_project "$START_PROJECT"
pass 'temporary Claude Code project prepared (start behavior)'

START_PROMPT='You are testing the local workflow-ledger skill in this temporary project. Use the workflow-ledger skill to start a tracked Level 2 task with this exact goal: "Test plugin behavior wiring". Update only .claude/WORKFLOW.md. Keep the ledger concise: do not include transcripts, raw command output, or implementation details. Stop after the ledger has one Active task with Intent, Current todo, Changes, Prerequisites, Current phase, and Resume next.'

run_claude_case "$START_PROJECT" 'start' "$START_PROMPT"
assert_common_ledger "$START_PROJECT" 'Test plugin behavior wiring' 'start'

MERGE_PROJECT="$TMP_DIR/project-merge"
prepare_project "$MERGE_PROJECT"
pass 'temporary Claude Code project prepared (merge suggestion)'

MERGE_PROMPT='You are testing the local workflow-ledger skill in this temporary project. Use the workflow-ledger skill and update only .claude/WORKFLOW.md. Replace the template placeholder with one tracked Level 2 task with this exact goal: "Add status query state unit tests". The work has these sibling todo items: "6.T3 Write status query offline unit test", "6.T4 Write status query unknown unit test", and "6.T5 Write status query not_deployed unit test". Treat this prompt as user approval to merge related same-family todos when the workflow-ledger skill says a merge suggestion is appropriate. When approved, represent the merged work as one compact Current todo item exactly like "6.T3-T5 Write status query state-branch unit tests: offline, unknown, not_deployed" instead of keeping T3, T4, and T5 as separate checklist entries. Keep the ledger concise and stop after updating it.'

run_claude_case "$MERGE_PROJECT" 'merge' "$MERGE_PROMPT"
assert_common_ledger "$MERGE_PROJECT" 'Add status query state unit tests' 'merge'
MERGE_LEDGER="$MERGE_PROJECT/.claude/WORKFLOW.md"
assert_one_active_task "$MERGE_LEDGER" 'merge'
python3 - "$MERGE_LEDGER" <<'PY' || fail 'ledger contains compact status query batch item'
import re
import sys
lines = open(sys.argv[1], encoding='utf-8').read().splitlines()
matched = []
for line in lines:
    lowered = line.lower()
    has_all_states = all(state in lowered for state in ('offline', 'unknown', 'not_deployed'))
    has_range = re.search(r'(6\.t3\s*-\s*t5|t3\s*-\s*t5)', lowered)
    if has_all_states and has_range:
        matched.append(line)
if not matched:
    raise SystemExit(1)
PY
pass 'ledger contains compact status query batch item'
if grep -Eq '^### .*6\.T[345]' "$MERGE_LEDGER"; then
  fail 'ledger does not create separate Active tasks for merged status query items'
fi
pass 'ledger does not create separate Active tasks for merged status query items'

SEPARATE_PROJECT="$TMP_DIR/project-separate"
prepare_project "$SEPARATE_PROJECT"
pass 'temporary Claude Code project prepared (non-suggestion)'

SEPARATE_PROMPT='You are testing the local workflow-ledger skill in this temporary project. Use the workflow-ledger skill and update only .claude/WORKFLOW.md. Replace the template placeholder with one tracked Level 2 task with this exact goal: "Improve project maintenance". The discovered work items are: "Update status query offline unit test", "Rewrite README installation section", and "Investigate release publishing credentials". These items have different task families and validation paths. Keep them separate using the workflow-ledger skill rules. Keep the ledger concise and stop after updating it.'

run_claude_case "$SEPARATE_PROJECT" 'separate' "$SEPARATE_PROMPT"
assert_common_ledger "$SEPARATE_PROJECT" 'Improve project maintenance' 'separate'
SEPARATE_LEDGER="$SEPARATE_PROJECT/.claude/WORKFLOW.md"
for term in 'status query' 'README' 'release publishing'; do
  grep -Eiq "$term" "$SEPARATE_LEDGER" || fail "ledger preserves unrelated item: $term"
done
pass 'ledger preserves unrelated maintenance items'
python3 - "$SEPARATE_LEDGER" <<'PY' || fail 'ledger does not collapse unrelated maintenance items'
import re
import sys
lines = open(sys.argv[1], encoding='utf-8').read().splitlines()
for line in lines:
    lowered = line.lower()
    is_checklist = re.match(r'\s*-\s*\[[ xX]\]', line)
    has_all_items = all(term in lowered for term in ('status query', 'readme', 'release publishing'))
    if is_checklist and has_all_items:
        raise SystemExit(1)
PY
pass 'ledger does not collapse unrelated maintenance items'

printf 'all claude code behavior tests passed\n'
