import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const cli = path.join(repoRoot, 'bin', 'workflow-ledger.js');

function makeTempRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeTempRoot(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}

function tail(text: string, lines = 20): string {
  return text.split(/\r?\n/).slice(-lines).join('\n');
}

function commandExists(command: string): boolean {
  const paths = (process.env.PATH || '').split(path.delimiter);
  return paths.some((entry) => fs.existsSync(path.join(entry, command)));
}

function prepareProject(project: string): void {
  fs.mkdirSync(path.join(project, '.claude', 'skills'), { recursive: true });
  fs.mkdirSync(path.join(project, '.claude', 'bin'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'skills', 'workflow-ledger'), path.join(project, '.claude', 'skills', 'workflow-ledger'), { recursive: true });
  fs.copyFileSync(cli, path.join(project, '.claude', 'bin', 'workflow-ledger'));
  fs.chmodSync(path.join(project, '.claude', 'bin', 'workflow-ledger'), 0o755);
  fs.mkdirSync(path.join(project, '.claude'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'templates', 'WORKFLOW.md'), path.join(project, '.claude', 'WORKFLOW.md'));
}

function applyLedgerFallback(project: string, label: string, stdout: string): void {
  const ledger = path.join(project, '.claude', 'WORKFLOW.md');
  const begin = 'WORKFLOW_LEDGER_BEGIN';
  const end = 'WORKFLOW_LEDGER_END';

  if (!stdout.includes(begin) && !stdout.includes(end)) {
    const lowered = stdout.toLowerCase();
    if (lowered.includes('sensitive file') || lowered.includes('protected as a sensitive')) {
      assert.fail(`Claude did not emit fallback ledger after sensitive file block (${label})`);
    }
    return;
  }

  assert.ok(stdout.includes(begin) && stdout.includes(end), `Claude fallback ledger markers parsed (${label})`);
  const content = stdout.split(begin, 2)[1].split(end, 1)[0].trim();
  assert.ok(content.includes('# Workflow Ledger') && content.includes('## Active'), `Claude fallback ledger content parsed (${label})`);
  fs.writeFileSync(ledger, `${content}\n`);
}

function claudeTransportError(stdout: string, stderr: string): boolean {
  return /API Error|socket connection was closed|fetch\(\)|ECONNRESET|UND_ERR_SOCKET/i.test(`${stdout}\n${stderr}`);
}

function runClaudeCase(project: string, label: string, prompt: string): void {
  const harnessPrompt = `Use the project-local workflow-ledger skill at .claude/skills/workflow-ledger/SKILL.md, not any global skill.

${prompt}

Headless test harness note: If Claude Code blocks direct writes to .claude/WORKFLOW.md as a sensitive file, do not ask for approval. Instead print the full desired replacement ledger between exact lines WORKFLOW_LEDGER_BEGIN and WORKFLOW_LEDGER_END; the harness will apply it. Keep the marker block to markdown ledger content only.`;

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = spawnSync('claude', ['-p', harnessPrompt, '--add-dir', project, '--permission-mode', 'bypassPermissions', '--model', 'sonnet'], {
      cwd: project,
      encoding: 'utf8',
      timeout: 300_000,
    });

    if (result.status === 0) {
      applyLedgerFallback(project, label, result.stdout);
      return;
    }

    if (attempt < maxAttempts && claudeTransportError(result.stdout, result.stderr)) {
      continue;
    }

    assert.equal(
      result.status,
      0,
      `headless Claude Code behavior test completed (${label})\nstdout tail:\n${tail(result.stdout)}\nstderr tail:\n${tail(result.stderr)}`
    );
  }
}

function assertCommonLedger(project: string, goal: string, label: string): void {
  const ledger = path.join(project, '.claude', 'WORKFLOW.md');
  assert.ok(fs.existsSync(ledger), `ledger exists after Claude run (${label})`);
  const text = fs.readFileSync(ledger, 'utf8');
  for (const required of ['## Active', goal, 'Intent:', 'Current todo:', 'Changes:', 'Prerequisites:', 'Current phase:', 'Resume next:']) {
    assert.ok(text.includes(required), `ledger contains ${required} (${label})`);
  }
  assert.ok(text.split(/\r?\n/).length <= 120, `ledger stays under 120 lines (${label})`);
  assert.ok(Buffer.byteLength(text, 'utf8') <= 8000, `ledger stays under 8000 bytes (${label})`);
  assert.ok(!text.includes('```'), `ledger contains no fenced code blocks (${label})`);
  assert.ok(!/tool_use|stdout|stderr/i.test(text), `ledger contains no transcript markers (${label})`);

  const result = spawnSync(process.execPath, [cli, 'doctor'], {
    cwd: project,
    encoding: 'utf8',
    env: { ...process.env, WORKFLOW_LEDGER_ROOT: project },
  });
  assert.equal(result.status, 0, `doctor accepts generated ledger (${label})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function assertOneActiveTask(ledger: string, label: string): void {
  const text = fs.readFileSync(ledger, 'utf8');
  const active = text.split('## Active', 2)[1]?.split('## Backlog / Future', 1)[0] || '';
  const count = active.split(/\r?\n/).filter((line) => line.startsWith('### ')).length;
  assert.equal(count, 1, `ledger has one Active task (${label})`);
}

test('plugin versions match package version', () => {
  const packageVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
  const pluginVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const marketplaceVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8')).plugins[0].version;
  assert.equal(pluginVersion, packageVersion);
  assert.equal(marketplaceVersion, packageVersion);
});

test('plugin hook emits valid JSON context', () => {
  const tmp = makeTempRoot('workflow-ledger-hook-');
  try {
    const root = path.join(tmp, 'hook-json');
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, 'templates', 'WORKFLOW.md'), path.join(root, '.claude', 'WORKFLOW.md'));
    const result = spawnSync(path.join(repoRoot, 'hooks', 'session-start'), [], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: '1' },
    });
    assert.equal(result.status, 0, `plugin hook exits 0\nstderr:\n${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.hookSpecificOutput);
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.match(parsed.hookSpecificOutput.additionalContext, /Workflow Ledger detected/);
  } finally {
    removeTempRoot(tmp);
  }
});

test('headless Claude Code skill behavior', { timeout: 1_000_000 }, () => {
  assert.ok(commandExists('claude'), 'claude command not found; default tests require Claude Code');
  const tmp = makeTempRoot('workflow-ledger-claude-');
  try {
    const startProject = path.join(tmp, 'project-start');
    prepareProject(startProject);
    const startPrompt = 'You are testing the local workflow-ledger skill in this temporary project. Use the workflow-ledger skill to start a tracked Level 2 task with this exact goal: "Test plugin behavior wiring". The Intent section must include the exact goal string "Test plugin behavior wiring". Update only .claude/WORKFLOW.md. Keep the ledger concise: do not include transcripts, raw command output, or implementation details. Stop after the ledger has one Active task with Intent, Current todo, Changes, Prerequisites, Current phase, and Resume next.';
    runClaudeCase(startProject, 'start', startPrompt);
    assertCommonLedger(startProject, 'Test plugin behavior wiring', 'start');

    const mergeProject = path.join(tmp, 'project-merge');
    prepareProject(mergeProject);
    const mergePrompt = 'You are testing the local workflow-ledger skill in this temporary project. Use the workflow-ledger skill and update only .claude/WORKFLOW.md. Replace the template placeholder with one tracked Level 2 task with this exact goal: "Add status query state unit tests". The Intent section must include the exact goal string "Add status query state unit tests". The work has these sibling todo items: "6.T3 Write status query offline unit test", "6.T4 Write status query unknown unit test", and "6.T5 Write status query not_deployed unit test". Treat this prompt as user approval to merge related same-family todos when the workflow-ledger skill says a merge suggestion is appropriate. When approved, represent the merged work as one compact Current todo item exactly like "6.T3-T5 Write status query state-branch unit tests: offline, unknown, not_deployed" instead of keeping T3, T4, and T5 as separate checklist entries. Keep the ledger concise and stop after updating it.';
    runClaudeCase(mergeProject, 'merge', mergePrompt);
    assertCommonLedger(mergeProject, 'Add status query state unit tests', 'merge');
    const mergeLedger = path.join(mergeProject, '.claude', 'WORKFLOW.md');
    assertOneActiveTask(mergeLedger, 'merge');
    const mergeLines = fs.readFileSync(mergeLedger, 'utf8').split(/\r?\n/);
    assert.ok(mergeLines.some((line) => {
      const lowered = line.toLowerCase();
      return ['offline', 'unknown', 'not_deployed'].every((state) => lowered.includes(state)) && /(6\.t3\s*-\s*t5|t3\s*-\s*t5)/.test(lowered);
    }), 'ledger contains compact status query batch item');
    assert.ok(!mergeLines.some((line) => /^### .*6\.T[345]/.test(line)), 'ledger does not create separate Active tasks for merged status query items');

    const separateProject = path.join(tmp, 'project-separate');
    prepareProject(separateProject);
    const separatePrompt = 'You are testing the local workflow-ledger skill in this temporary project. Use the workflow-ledger skill and update only .claude/WORKFLOW.md. Replace the template placeholder with one tracked Level 2 task with this exact goal: "Improve project maintenance". The Intent section must include the exact goal string "Improve project maintenance". The discovered work items are: "Update status query offline unit test", "Rewrite README installation section", and "Investigate release publishing credentials". These items have different task families and validation paths. Keep them separate using the workflow-ledger skill rules. Keep the ledger concise and stop after updating it.';
    runClaudeCase(separateProject, 'separate', separatePrompt);
    assertCommonLedger(separateProject, 'Improve project maintenance', 'separate');
    const separateLedger = fs.readFileSync(path.join(separateProject, '.claude', 'WORKFLOW.md'), 'utf8');
    for (const term of ['status query', 'README', 'release publishing']) {
      assert.match(separateLedger, new RegExp(term, 'i'), `ledger preserves unrelated item: ${term}`);
    }
    assert.ok(!separateLedger.split(/\r?\n/).some((line) => /^\s*-\s*\[[ xX]\]/.test(line) && ['status query', 'readme', 'release publishing'].every((term) => line.toLowerCase().includes(term))), 'ledger does not collapse unrelated maintenance items');
  } finally {
    removeTempRoot(tmp);
  }
});
