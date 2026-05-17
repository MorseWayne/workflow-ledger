#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const cli = path.join(repoRoot, 'bin', 'workflow-ledger.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-ledger-node-'));

function fail(message) {
  console.error(`not ok - ${message}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}

function pass(message) {
  console.log(`ok - ${message}`);
}

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, WORKFLOW_LEDGER_ROOT: cwd },
  });
}

let root = path.join(tmp, 'claude-code');
fs.mkdirSync(root, { recursive: true });
let result = run(['setup', '--tool', 'claude-code'], root);
if (result.status !== 0) fail('claude-code setup exits 0');
if (!fs.existsSync(path.join(root, '.claude', 'WORKFLOW.md'))) fail('claude-code setup creates ledger');
if (!fs.existsSync(path.join(root, '.claude', 'skills', 'workflow-ledger', 'SKILL.md'))) fail('claude-code setup installs skill');
if (!fs.existsSync(path.join(root, '.claude', 'bin', 'workflow-ledger'))) fail('claude-code setup installs local CLI');
if (!fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8').includes('## Workflow Ledger')) fail('claude-code setup updates CLAUDE.md');
pass('claude-code setup installs project files');

result = run(['setup', '--tool', 'claude-code'], root);
if (result.status !== 0) fail('claude-code setup is idempotent');
if (!result.stdout.includes('kept existing .claude/WORKFLOW.md')) fail('claude-code setup keeps existing ledger');
pass('claude-code setup is idempotent');

root = path.join(tmp, 'codex');
fs.mkdirSync(root, { recursive: true });
result = run(['setup', '--tool', 'codex'], root);
if (result.status !== 0) fail('codex setup exits 0');
if (!fs.existsSync(path.join(root, '.workflow-ledger', 'WORKFLOW.md'))) fail('codex setup creates shared ledger');
if (!fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').includes('# Workflow Ledger')) fail('codex setup updates AGENTS.md');
pass('codex setup installs project files');

root = path.join(tmp, 'all');
fs.mkdirSync(root, { recursive: true });
result = run(['setup', '--tool', 'all'], root);
if (result.status !== 0) fail('all setup exits 0');
if (!fs.existsSync(path.join(root, '.claude', 'WORKFLOW.md'))) fail('all setup creates Claude Code ledger');
if (!fs.existsSync(path.join(root, '.workflow-ledger', 'WORKFLOW.md'))) fail('all setup creates Codex ledger');
pass('all setup installs both adapters');

result = run(['doctor'], path.join(tmp, 'claude-code'));
if (result.status !== 0) fail('node CLI delegates doctor to Bash CLI');
pass('node CLI delegates doctor');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('all node cli tests passed');
