#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const targetRoot = path.resolve(process.env.WORKFLOW_LEDGER_ROOT || process.cwd());

const toolAliases = new Map([
  ['cc', 'claude-code'],
  ['claude', 'claude-code'],
  ['claude-code', 'claude-code'],
  ['codex', 'codex'],
  ['all', 'all'],
]);

function printHelp() {
  console.log(`workflow-ledger — lightweight workflow guardrails for AI coding agents

Usage:
  workflow-ledger setup [--tool claude-code|codex|all] [--root PATH]
  workflow-ledger help
  workflow-ledger init
  workflow-ledger doctor
  workflow-ledger list
  workflow-ledger hooks status
  workflow-ledger hooks install

Setup defaults to --tool claude-code for compatibility.`);
}

function parseArgs(argv) {
  const args = { command: argv[0] || 'help', tool: 'claude-code', root: targetRoot, passthrough: argv.slice(1) };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tool') {
      args.tool = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--tool=')) {
      args.tool = arg.slice('--tool='.length);
    } else if (arg === '--root') {
      args.root = path.resolve(argv[i + 1] || '.');
      i += 1;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    }
  }
  args.tool = toolAliases.get(args.tool) || args.tool;
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFileIfMissing(src, dest, createdMessage, keptMessage) {
  if (fs.existsSync(dest)) {
    console.log(keptMessage);
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(createdMessage);
}

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  ensureDir(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true });
}

function appendSnippet(marker, snippetPath, targetPath, updatedMessage, keptMessage) {
  let current = '';
  if (fs.existsSync(targetPath)) {
    current = fs.readFileSync(targetPath, 'utf8');
  } else {
    ensureDir(path.dirname(targetPath));
  }
  if (current.includes(marker)) {
    console.log(keptMessage);
    return;
  }
  const prefix = current.length > 0 && !current.endsWith('\n') ? '\n\n' : current.length > 0 ? '\n' : '';
  fs.appendFileSync(targetPath, `${prefix}${fs.readFileSync(snippetPath, 'utf8')}`);
  console.log(updatedMessage);
}

function setupClaudeCode(root) {
  const claudeDir = path.join(root, '.claude');
  ensureDir(path.join(claudeDir, 'skills'));
  ensureDir(path.join(claudeDir, 'bin'));
  copyDir(path.join(repoRoot, 'skills', 'workflow-ledger'), path.join(claudeDir, 'skills', 'workflow-ledger'));
  fs.copyFileSync(path.join(repoRoot, 'bin', 'workflow-ledger'), path.join(claudeDir, 'bin', 'workflow-ledger'));
  fs.chmodSync(path.join(claudeDir, 'bin', 'workflow-ledger'), 0o755);
  copyFileIfMissing(
    path.join(repoRoot, 'skills', 'workflow-ledger', 'templates', 'WORKFLOW.md'),
    path.join(claudeDir, 'WORKFLOW.md'),
    'created .claude/WORKFLOW.md',
    'kept existing .claude/WORKFLOW.md'
  );
  appendSnippet(
    '## Workflow Ledger',
    path.join(repoRoot, 'examples', 'claude-project', 'CLAUDE.md.snippet'),
    path.join(root, 'CLAUDE.md'),
    'updated CLAUDE.md',
    'kept existing Workflow Ledger section in CLAUDE.md'
  );
  console.log('installed workflow-ledger for Claude Code');
}

function setupCodex(root) {
  const ledgerDir = path.join(root, '.workflow-ledger');
  ensureDir(ledgerDir);
  copyFileIfMissing(
    path.join(repoRoot, 'templates', 'WORKFLOW.md'),
    path.join(ledgerDir, 'WORKFLOW.md'),
    'created .workflow-ledger/WORKFLOW.md',
    'kept existing .workflow-ledger/WORKFLOW.md'
  );
  appendSnippet(
    '# Workflow Ledger',
    path.join(repoRoot, 'examples', 'codex-project', 'AGENTS.md.snippet'),
    path.join(root, 'AGENTS.md'),
    'updated AGENTS.md',
    'kept existing Workflow Ledger section in AGENTS.md'
  );
  console.log('installed workflow-ledger for Codex');
}

function setup(args) {
  if (!['claude-code', 'codex', 'all'].includes(args.tool)) {
    console.error(`error: unknown tool '${args.tool}'. Expected claude-code, codex, or all.`);
    process.exitCode = 1;
    return;
  }
  ensureDir(args.root);
  if (args.tool === 'claude-code' || args.tool === 'all') {
    setupClaudeCode(args.root);
  }
  if (args.tool === 'codex' || args.tool === 'all') {
    setupCodex(args.root);
  }
}

function delegateToBash(argv) {
  const script = path.join(repoRoot, 'bin', 'workflow-ledger');
  const result = spawnSync(script, argv, {
    stdio: 'inherit',
    env: { ...process.env, WORKFLOW_LEDGER_ROOT: process.env.WORKFLOW_LEDGER_ROOT || targetRoot },
  });
  process.exitCode = result.status ?? 1;
}

const args = parseArgs(process.argv.slice(2));
if (args.command === 'help' || args.command === '-h' || args.command === '--help') {
  printHelp();
} else if (args.command === 'setup') {
  setup(args);
} else {
  delegateToBash(process.argv.slice(2));
}
