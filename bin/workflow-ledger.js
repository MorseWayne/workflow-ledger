#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
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
  workflow-ledger setup [--tool claude-code|codex|all]
  workflow-ledger init [--tool claude-code|codex|all] [--root PATH]
  workflow-ledger help
  workflow-ledger doctor
  workflow-ledger list
  workflow-ledger hooks status
  workflow-ledger hooks install

setup installs global tool integrations. init creates project-local ledger files.`);
}

function parseArgs(argv) {
  const args = { command: argv[0] || 'help', tool: 'claude-code', root: targetRoot };
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

function dirExists(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function copyFileIfMissing(src, dest, createdMessage, keptMessage, result) {
  if (fs.existsSync(dest)) {
    result.configured.push(keptMessage);
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  result.configured.push(createdMessage);
}

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  ensureDir(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true });
}

function appendSnippet(marker, snippetPath, targetPath, updatedMessage, keptMessage, result) {
  let current = '';
  if (fs.existsSync(targetPath)) {
    current = fs.readFileSync(targetPath, 'utf8');
  } else {
    ensureDir(path.dirname(targetPath));
  }
  if (current.includes(marker)) {
    result.configured.push(keptMessage);
    return;
  }
  const prefix = current.length > 0 && !current.endsWith('\n') ? '\n\n' : current.length > 0 ? '\n' : '';
  fs.appendFileSync(targetPath, `${prefix}${fs.readFileSync(snippetPath, 'utf8')}`);
  result.configured.push(updatedMessage);
}

function validateTool(tool) {
  if (!['claude-code', 'codex', 'all'].includes(tool)) {
    console.error(`error: unknown tool '${tool}'. Expected claude-code, codex, or all.`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

function createResult() {
  return { configured: [], skipped: [], errors: [] };
}

function printResult(title, result) {
  console.log(`\n${title}`);
  if (result.configured.length > 0) {
    console.log('Configured:');
    for (const item of result.configured) console.log(`  + ${item}`);
  }
  if (result.skipped.length > 0) {
    console.log('Skipped:');
    for (const item of result.skipped) console.log(`  - ${item}`);
  }
  if (result.errors.length > 0) {
    console.log('Errors:');
    for (const item of result.errors) console.log(`  ! ${item}`);
    process.exitCode = 1;
  }
}

function setupClaudeCodeGlobal(result) {
  const claudeDir = path.join(os.homedir(), '.claude');
  if (!dirExists(claudeDir)) {
    result.skipped.push('Claude Code (not installed)');
    return;
  }
  const skillsDir = path.join(claudeDir, 'skills');
  const binDir = path.join(claudeDir, 'bin');
  try {
    copyDir(path.join(repoRoot, 'skills', 'workflow-ledger'), path.join(skillsDir, 'workflow-ledger'));
    ensureDir(binDir);
    fs.copyFileSync(path.join(repoRoot, 'bin', 'workflow-ledger'), path.join(binDir, 'workflow-ledger'));
    fs.chmodSync(path.join(binDir, 'workflow-ledger'), 0o755);
    result.configured.push('Claude Code skill → ~/.claude/skills/workflow-ledger');
    result.configured.push('Claude Code local CLI → ~/.claude/bin/workflow-ledger');
  } catch (error) {
    result.errors.push(`Claude Code: ${error.message}`);
  }
}

function setupCodexGlobal(result) {
  const codexDir = path.join(os.homedir(), '.codex');
  if (!dirExists(codexDir)) {
    result.skipped.push('Codex (not installed)');
    return;
  }
  const skillDir = path.join(os.homedir(), '.agents', 'skills', 'workflow-ledger');
  try {
    ensureDir(skillDir);
    fs.copyFileSync(path.join(repoRoot, 'examples', 'codex-project', 'AGENTS.md.snippet'), path.join(skillDir, 'SKILL.md'));
    result.configured.push('Codex skill → ~/.agents/skills/workflow-ledger');
  } catch (error) {
    result.errors.push(`Codex: ${error.message}`);
  }
}

function setup(args) {
  if (!validateTool(args.tool)) return;
  const result = createResult();
  if (args.tool === 'claude-code' || args.tool === 'all') setupClaudeCodeGlobal(result);
  if (args.tool === 'codex' || args.tool === 'all') setupCodexGlobal(result);
  printResult('Workflow Ledger Setup', result);
  console.log('\nNext: run workflow-ledger init in a project.');
}

function initClaudeCodeProject(root, result) {
  const claudeDir = path.join(root, '.claude');
  ensureDir(claudeDir);
  copyFileIfMissing(
    path.join(repoRoot, 'skills', 'workflow-ledger', 'templates', 'WORKFLOW.md'),
    path.join(claudeDir, 'WORKFLOW.md'),
    'created .claude/WORKFLOW.md',
    'kept existing .claude/WORKFLOW.md',
    result
  );
  appendSnippet(
    '## Workflow Ledger',
    path.join(repoRoot, 'examples', 'claude-project', 'CLAUDE.md.snippet'),
    path.join(root, 'CLAUDE.md'),
    'updated CLAUDE.md',
    'kept existing Workflow Ledger section in CLAUDE.md',
    result
  );
}

function initCodexProject(root, result) {
  const ledgerDir = path.join(root, '.workflow-ledger');
  ensureDir(ledgerDir);
  copyFileIfMissing(
    path.join(repoRoot, 'templates', 'WORKFLOW.md'),
    path.join(ledgerDir, 'WORKFLOW.md'),
    'created .workflow-ledger/WORKFLOW.md',
    'kept existing .workflow-ledger/WORKFLOW.md',
    result
  );
  appendSnippet(
    '# Workflow Ledger',
    path.join(repoRoot, 'examples', 'codex-project', 'AGENTS.md.snippet'),
    path.join(root, 'AGENTS.md'),
    'updated AGENTS.md',
    'kept existing Workflow Ledger section in AGENTS.md',
    result
  );
}

function initProject(args) {
  if (!validateTool(args.tool)) return;
  const result = createResult();
  ensureDir(args.root);
  if (args.tool === 'claude-code' || args.tool === 'all') initClaudeCodeProject(args.root, result);
  if (args.tool === 'codex' || args.tool === 'all') initCodexProject(args.root, result);
  printResult('Workflow Ledger Init', result);
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
} else if (args.command === 'init') {
  initProject(args);
} else {
  delegateToBash(process.argv.slice(2));
}