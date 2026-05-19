import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const cli = path.join(repoRoot, 'bin', 'workflow-ledger.js');

type RunResult = SpawnSyncReturns<string>;

function makeTempRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeTempRoot(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}

function copyFixture(name: string, dest: string): void {
  fs.cpSync(path.join(repoRoot, 'tests', 'fixtures', name), dest, { recursive: true });
}

function runCli(args: string[], cwd: string, extraEnv: NodeJS.ProcessEnv = {}): RunResult {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, WORKFLOW_LEDGER_ROOT: cwd, ...extraEnv },
  });
}

function assertOk(result: RunResult, message: string): void {
  assert.equal(result.status, 0, `${message}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function assertFail(result: RunResult, message: string): void {
  assert.notEqual(result.status, 0, `${message}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

test('skill documents compact iteration summary format', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'bin', 'workflow-ledger')), false);
  const skill = fs.readFileSync(path.join(repoRoot, 'skills', 'workflow-ledger', 'SKILL.md'), 'utf8');
  assert.match(skill, /## User-facing iteration summaries/);
  for (const heading of ['本轮任务：', '本轮目标：', '本轮结论：', '验证：', 'Review 发现：', '变更：', '风险：', '提交状态：', '下一步：']) {
    assert.ok(skill.includes(heading), `missing summary heading ${heading}`);
  }
  assert.ok(skill.includes('Do not force the full iteration template onto simple execution results.'));
  assert.ok(skill.includes('Use this order for substantive iteration summaries:'));
  assert.ok(skill.includes('Prefer short unordered bullets for `本轮任务` and `本轮目标`'));
});

test('doctor and list handle ledger fixtures', () => {
  const tmp = makeTempRoot('workflow-ledger-cli-');
  try {
    let root = path.join(tmp, 'healthy');
    copyFixture('healthy', root);
    let result = runCli(['doctor'], root);
    assertOk(result, 'doctor returns 0 for healthy ledger');
    assert.match(result.stdout, /doctor finished with 0 errors/);

    result = runCli(['list'], root);
    assertOk(result, 'list prints active task, current focus, and resume next');
    assert.match(result.stdout, /Healthy task/);
    assert.match(result.stdout, /Current phase: Build CLI guardrails/);
    assert.match(result.stdout, /Resume next: Continue with docs\./);

    root = path.join(tmp, 'missing-intent');
    copyFixture('missing-intent', root);
    result = runCli(['doctor'], root);
    assertFail(result, 'doctor returns 1 for missing Intent');
    assert.match(result.stdout, /lacks Intent/);

    root = path.join(tmp, 'missing-current-phase');
    copyFixture('missing-current-phase', root);
    result = runCli(['doctor'], root);
    assertFail(result, 'doctor returns 1 for missing Current phase');
    assert.match(result.stdout, /lacks Current phase/);

    root = path.join(tmp, 'missing-section');
    copyFixture('missing-section', root);
    result = runCli(['doctor'], root);
    assertFail(result, 'doctor returns 1 for missing core section');
    assert.match(result.stdout, /Missing ## Completed section/);

    root = path.join(tmp, 'missing-ledger');
    fs.mkdirSync(root, { recursive: true });
    result = runCli(['doctor'], root);
    assertFail(result, 'doctor returns 1 when ledger is missing');
    assert.match(result.stdout, /\.claude\/WORKFLOW\.md is missing/);

    result = runCli(['list'], root);
    assertOk(result, 'list exits 0 when ledger is missing');
    assert.match(result.stderr, /No \.claude\/WORKFLOW\.md found/);
  } finally {
    removeTempRoot(tmp);
  }
});

test('init creates localized ledgers and preserves existing files', () => {
  const tmp = makeTempRoot('workflow-ledger-init-');
  try {
    let root = path.join(tmp, 'init-new');
    fs.mkdirSync(root, { recursive: true });
    let result = runCli(['init'], root);
    assertOk(result, 'init creates ledger when absent');
    assert.ok(fs.existsSync(path.join(root, '.claude', 'WORKFLOW.md')));
    assert.match(fs.readFileSync(path.join(root, '.claude', 'WORKFLOW.md'), 'utf8'), /A lightweight OpenSpec-style resume ledger/);

    root = path.join(tmp, 'init-zh');
    fs.mkdirSync(root, { recursive: true });
    result = runCli(['init', '--lang', 'zh-CN'], root);
    assertOk(result, 'init creates zh-CN ledger when requested');
    assert.match(fs.readFileSync(path.join(root, '.claude', 'WORKFLOW.md'), 'utf8'), /可恢复台账/);

    root = path.join(tmp, 'init-new');
    fs.writeFileSync(path.join(root, '.claude', 'WORKFLOW.md'), 'custom ledger\n');
    result = runCli(['init'], root);
    assertOk(result, 'init does not overwrite existing ledger');
    assert.equal(fs.readFileSync(path.join(root, '.claude', 'WORKFLOW.md'), 'utf8'), 'custom ledger\n');
  } finally {
    removeTempRoot(tmp);
  }
});

test('hooks commands report and install hook files', () => {
  const tmp = makeTempRoot('workflow-ledger-hooks-');
  try {
    let root = path.join(tmp, 'hooks-missing');
    fs.mkdirSync(root, { recursive: true });
    let result = runCli(['hooks', 'status'], root);
    assertOk(result, 'hooks status reports not installed');
    assert.match(result.stdout, /hooks: not installed/);

    root = path.join(tmp, 'hooks-installed');
    copyFixture('hooks-installed', root);
    result = runCli(['hooks', 'status'], root);
    assertOk(result, 'hooks status reports installed');
    assert.match(result.stdout, /hooks: installed/);

    root = path.join(tmp, 'hooks-install');
    fs.mkdirSync(root, { recursive: true });
    result = runCli(['hooks', 'install'], root);
    assertOk(result, 'hooks install creates hook files');
    assert.ok(fs.existsSync(path.join(root, '.claude', 'hooks', 'hooks.json')));
    fs.accessSync(path.join(root, '.claude', 'hooks', 'session-start'), fs.constants.X_OK);

    fs.writeFileSync(path.join(root, '.claude', 'hooks', 'hooks.json'), 'existing\n');
    result = runCli(['hooks', 'install'], root);
    assertOk(result, 'hooks install does not overwrite existing files');
    assert.equal(fs.readFileSync(path.join(root, '.claude', 'hooks', 'hooks.json'), 'utf8'), 'existing\n');
  } finally {
    removeTempRoot(tmp);
  }
});

test('setup and multi-tool init install expected files', () => {
  const tmp = makeTempRoot('workflow-ledger-setup-');
  const home = path.join(tmp, 'home');
  try {
    fs.mkdirSync(home, { recursive: true });
    let root = path.join(tmp, 'setup-missing-tools');
    fs.mkdirSync(root, { recursive: true });
    let result = runCli(['setup', '--tool', 'all'], root, { HOME: home });
    assertOk(result, 'setup exits 0 when tools are missing');
    assert.match(result.stdout, /Claude Code \(not installed\)/);
    assert.match(result.stdout, /Codex \(not installed\)/);

    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    result = runCli(['setup', '--tool', 'all'], root, { HOME: home });
    assertOk(result, 'setup exits 0 with detected tools');
    assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'workflow-ledger', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(home, '.claude', 'bin', 'workflow-ledger')));
    assert.ok(fs.readFileSync(path.join(home, '.claude', 'bin', 'workflow-ledger'), 'utf8').startsWith('#!/usr/bin/env node'));
    assert.ok(fs.existsSync(path.join(home, '.agents', 'skills', 'workflow-ledger', 'SKILL.md')));

    root = path.join(tmp, 'claude-code-project');
    fs.mkdirSync(root, { recursive: true });
    result = runCli(['init', '--tool', 'claude-code'], root, { HOME: home });
    assertOk(result, 'claude-code init exits 0');
    assert.ok(fs.existsSync(path.join(root, '.claude', 'WORKFLOW.md')));
    assert.match(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), /## Workflow Ledger/);

    root = path.join(tmp, 'zh-claude-code-project');
    fs.mkdirSync(root, { recursive: true });
    result = runCli(['init', '--tool', 'claude-code', '--lang', 'zh-CN'], root, { HOME: home });
    assertOk(result, 'zh-CN claude-code init exits 0');
    assert.match(fs.readFileSync(path.join(root, '.claude', 'WORKFLOW.md'), 'utf8'), /可恢复台账/);
    assert.match(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), /使用 `workflow-ledger` 跟踪可恢复的开发工作/);

    root = path.join(tmp, 'bare-init-project');
    fs.mkdirSync(root, { recursive: true });
    result = runCli(['init'], root, { HOME: home });
    assertOk(result, 'bare init exits 0 without TTY');
    assert.match(fs.readFileSync(path.join(root, '.claude', 'WORKFLOW.md'), 'utf8'), /A lightweight OpenSpec-style resume ledger/);

    root = path.join(tmp, 'claude-code-project');
    result = runCli(['init', '--tool', 'claude-code'], root, { HOME: home });
    assertOk(result, 'claude-code init is idempotent');
    assert.match(result.stdout, /kept existing \.claude\/WORKFLOW\.md/);

    root = path.join(tmp, 'codex-project');
    fs.mkdirSync(root, { recursive: true });
    result = runCli(['init', '--tool', 'codex'], root, { HOME: home });
    assertOk(result, 'codex init exits 0');
    assert.ok(fs.existsSync(path.join(root, '.workflow-ledger', 'WORKFLOW.md')));
    assert.match(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /# Workflow Ledger/);

    root = path.join(tmp, 'all-project');
    fs.mkdirSync(root, { recursive: true });
    result = runCli(['init', '--tool', 'all'], root, { HOME: home });
    assertOk(result, 'all init exits 0');
    assert.ok(fs.existsSync(path.join(root, '.claude', 'WORKFLOW.md')));
    assert.ok(fs.existsSync(path.join(root, '.workflow-ledger', 'WORKFLOW.md')));

    result = runCli(['doctor'], path.join(tmp, 'claude-code-project'), { HOME: home });
    assertOk(result, 'node CLI runs doctor directly');
  } finally {
    removeTempRoot(tmp);
  }
});
