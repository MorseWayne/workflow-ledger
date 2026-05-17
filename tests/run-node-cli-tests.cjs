#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const cli = path.join(repoRoot, 'bin', 'workflow-ledger.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-ledger-node-'));
const home = path.join(tmp, 'home');
fs.mkdirSync(home, { recursive: true });

function fail(message) {
  console.error(`not ok - ${message}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}

function pass(message) {
  console.log(`ok - ${message}`);
}

function run(args, cwd, extraEnv = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, WORKFLOW_LEDGER_ROOT: cwd, ...extraEnv },
  });
}

let root = path.join(tmp, 'setup-missing-tools');
fs.mkdirSync(root, { recursive: true });
let result = run(['setup', '--tool', 'all'], root);
if (result.status !== 0) fail('setup exits 0 when tools are missing');
if (!result.stdout.includes('Claude Code (not installed)')) fail('setup reports missing Claude Code');
if (!result.stdout.includes('Codex (not installed)')) fail('setup reports missing Codex');
pass('setup skips missing global tools');

fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
result = run(['setup', '--tool', 'all'], root);
if (result.status !== 0) fail('setup exits 0 with detected tools');
if (!fs.existsSync(path.join(home, '.claude', 'skills', 'workflow-ledger', 'SKILL.md'))) fail('setup installs global Claude Code skill');
if (!fs.existsSync(path.join(home, '.claude', 'bin', 'workflow-ledger'))) fail('setup installs global Claude Code CLI');
if (!fs.readFileSync(path.join(home, '.claude', 'bin', 'workflow-ledger'), 'utf8').startsWith('#!/usr/bin/env node')) fail('setup installs Node CLI as the Claude Code executable');
if (!fs.existsSync(path.join(home, '.agents', 'skills', 'workflow-ledger', 'SKILL.md'))) fail('setup installs global Codex skill');
pass('setup installs global tool integrations');

root = path.join(tmp, 'claude-code-project');
fs.mkdirSync(root, { recursive: true });
result = run(['init', '--tool', 'claude-code'], root);
if (result.status !== 0) fail('claude-code init exits 0');
if (!fs.existsSync(path.join(root, '.claude', 'WORKFLOW.md'))) fail('claude-code init creates ledger');
if (!fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8').includes('## Workflow Ledger')) fail('claude-code init updates CLAUDE.md');
pass('claude-code init installs project files');

root = path.join(tmp, 'zh-claude-code-project');
fs.mkdirSync(root, { recursive: true });
result = run(['init', '--tool', 'claude-code', '--lang', 'zh-CN'], root);
if (result.status !== 0) fail('zh-CN claude-code init exits 0');
if (!fs.readFileSync(path.join(root, '.claude', 'WORKFLOW.md'), 'utf8').includes('可恢复台账')) fail('zh-CN claude-code init creates Chinese ledger');
if (!fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8').includes('使用 `workflow-ledger` 跟踪可恢复的开发工作')) fail('zh-CN claude-code init updates CLAUDE.md in Chinese');
pass('zh-CN claude-code init installs localized project files');

root = path.join(tmp, 'bare-init-project');
fs.mkdirSync(root, { recursive: true });
result = run(['init'], root);
if (result.status !== 0) fail('bare init exits 0 without TTY');
if (!fs.readFileSync(path.join(root, '.claude', 'WORKFLOW.md'), 'utf8').includes('A lightweight OpenSpec-style resume ledger')) fail('bare non-TTY init defaults to English');
pass('bare non-TTY init defaults to English');

root = path.join(tmp, 'claude-code-project');
result = run(['init', '--tool', 'claude-code'], root);
if (result.status !== 0) fail('claude-code init is idempotent');
if (!result.stdout.includes('kept existing .claude/WORKFLOW.md')) fail('claude-code init keeps existing ledger');
pass('claude-code init is idempotent');

root = path.join(tmp, 'codex-project');
fs.mkdirSync(root, { recursive: true });
result = run(['init', '--tool', 'codex'], root);
if (result.status !== 0) fail('codex init exits 0');
if (!fs.existsSync(path.join(root, '.workflow-ledger', 'WORKFLOW.md'))) fail('codex init creates shared ledger');
if (!fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').includes('# Workflow Ledger')) fail('codex init updates AGENTS.md');
pass('codex init installs project files');

root = path.join(tmp, 'all-project');
fs.mkdirSync(root, { recursive: true });
result = run(['init', '--tool', 'all'], root);
if (result.status !== 0) fail('all init exits 0');
if (!fs.existsSync(path.join(root, '.claude', 'WORKFLOW.md'))) fail('all init creates Claude Code ledger');
if (!fs.existsSync(path.join(root, '.workflow-ledger', 'WORKFLOW.md'))) fail('all init creates Codex ledger');
pass('all init installs both adapters');

result = run(['doctor'], path.join(tmp, 'claude-code-project'));
if (result.status !== 0) fail('node CLI runs doctor directly');
pass('node CLI runs doctor directly');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('all node cli tests passed');
