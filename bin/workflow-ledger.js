#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

function defaultTargetRoot() {
  if (process.env.WORKFLOW_LEDGER_ROOT) return path.resolve(process.env.WORKFLOW_LEDGER_ROOT);
  if (path.basename(__dirname) === 'bin' && path.basename(path.dirname(__dirname)) === '.claude') {
    return path.resolve(__dirname, '..', '..');
  }
  return process.cwd();
}

const targetRoot = defaultTargetRoot();

const toolAliases = new Map([
  ['cc', 'claude-code'],
  ['claude', 'claude-code'],
  ['claude-code', 'claude-code'],
  ['codex', 'codex'],
  ['all', 'all'],
]);

const languageAliases = new Map([
  ['en', 'en'],
  ['english', 'en'],
  ['zh', 'zh-CN'],
  ['zh-cn', 'zh-CN'],
  ['zh_CN', 'zh-CN'],
  ['cn', 'zh-CN'],
  ['chinese', 'zh-CN'],
  ['中文', 'zh-CN'],
]);

function printHelp() {
  console.log(`workflow-ledger — lightweight workflow guardrails for AI coding agents

Usage:
  workflow-ledger setup [--tool claude-code|codex|all]
  workflow-ledger init [--tool claude-code|codex|all] [--lang en|zh-CN] [--root PATH]
  workflow-ledger help
  workflow-ledger doctor
  workflow-ledger list
  workflow-ledger hooks status
  workflow-ledger hooks install

setup installs global tool integrations. init creates project-local ledger files.`);
}

function parseArgs(argv) {
  const args = { command: argv[0] || 'help', tool: 'claude-code', language: '', root: targetRoot, interactiveLanguage: argv[0] === 'init' };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tool') {
      args.tool = argv[i + 1] || '';
      args.interactiveLanguage = false;
      i += 1;
    } else if (arg.startsWith('--tool=')) {
      args.tool = arg.slice('--tool='.length);
      args.interactiveLanguage = false;
    } else if (arg === '--lang' || arg === '--language') {
      args.language = argv[i + 1] || '';
      args.interactiveLanguage = false;
      i += 1;
    } else if (arg.startsWith('--lang=')) {
      args.language = arg.slice('--lang='.length);
      args.interactiveLanguage = false;
    } else if (arg.startsWith('--language=')) {
      args.language = arg.slice('--language='.length);
      args.interactiveLanguage = false;
    } else if (arg === '--root') {
      args.root = path.resolve(argv[i + 1] || '.');
      i += 1;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    }
  }
  args.tool = toolAliases.get(args.tool) || args.tool;
  args.language = args.language ? languageAliases.get(args.language) || args.language : 'en';
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

function copyCli(dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(__filename, dest);
  fs.chmodSync(dest, 0o755);
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

function validateLanguage(language) {
  if (!['en', 'zh-CN'].includes(language)) {
    console.error(`error: unknown language '${language}'. Expected en or zh-CN.`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function chooseLanguage() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return 'en';
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question('Choose language / 选择语言 [1] English [2] 简体中文: ');
    const normalized = answer.trim().toLowerCase();
    if (['2', 'zh', 'zh-cn', 'cn', '中文'].includes(normalized)) return 'zh-CN';
    return 'en';
  } finally {
    rl.close();
  }
}

function localizedPath(...segments) {
  return path.join(repoRoot, ...segments);
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
    copyCli(path.join(binDir, 'workflow-ledger'));
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

function templateFile(language, englishPath, chinesePath) {
  return language === 'zh-CN' ? localizedPath(...chinesePath) : localizedPath(...englishPath);
}

function initClaudeCodeProject(root, language, result) {
  const claudeDir = path.join(root, '.claude');
  ensureDir(claudeDir);
  copyFileIfMissing(
    templateFile(
      language,
      ['skills', 'workflow-ledger', 'templates', 'WORKFLOW.md'],
      ['skills', 'workflow-ledger', 'templates', 'WORKFLOW.zh-CN.md']
    ),
    path.join(claudeDir, 'WORKFLOW.md'),
    'created .claude/WORKFLOW.md',
    'kept existing .claude/WORKFLOW.md',
    result
  );
  appendSnippet(
    '## Workflow Ledger',
    templateFile(
      language,
      ['examples', 'claude-project', 'CLAUDE.md.snippet'],
      ['examples', 'claude-project', 'CLAUDE.zh-CN.md.snippet']
    ),
    path.join(root, 'CLAUDE.md'),
    'updated CLAUDE.md',
    'kept existing Workflow Ledger section in CLAUDE.md',
    result
  );
}

function initCodexProject(root, language, result) {
  const ledgerDir = path.join(root, '.workflow-ledger');
  ensureDir(ledgerDir);
  copyFileIfMissing(
    templateFile(
      language,
      ['templates', 'WORKFLOW.md'],
      ['templates', 'WORKFLOW.zh-CN.md']
    ),
    path.join(ledgerDir, 'WORKFLOW.md'),
    'created .workflow-ledger/WORKFLOW.md',
    'kept existing .workflow-ledger/WORKFLOW.md',
    result
  );
  appendSnippet(
    '# Workflow Ledger',
    templateFile(
      language,
      ['examples', 'codex-project', 'AGENTS.md.snippet'],
      ['examples', 'codex-project', 'AGENTS.zh-CN.md.snippet']
    ),
    path.join(root, 'AGENTS.md'),
    'updated AGENTS.md',
    'kept existing Workflow Ledger section in AGENTS.md',
    result
  );
}

async function initProject(args) {
  if (!validateTool(args.tool)) return;
  if (!validateLanguage(args.language)) return;
  const language = args.interactiveLanguage ? await chooseLanguage() : args.language;
  const result = createResult();
  ensureDir(args.root);
  if (args.tool === 'claude-code' || args.tool === 'all') initClaudeCodeProject(args.root, language, result);
  if (args.tool === 'codex' || args.tool === 'all') initCodexProject(args.root, language, result);
  printResult('Workflow Ledger Init', result);
}

function ledgerPath(root = targetRoot) {
  return path.join(root, '.claude', 'WORKFLOW.md');
}

function hooksJsonPath(root = targetRoot) {
  return path.join(root, '.claude', 'hooks', 'hooks.json');
}

function hookScriptPath(root = targetRoot) {
  return path.join(root, '.claude', 'hooks', 'session-start');
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function hookStatusValue(root = targetRoot) {
  const hooksJson = hooksJsonPath(root);
  const hookScript = hookScriptPath(root);
  if (!fs.existsSync(hooksJson) || !fs.existsSync(hookScript)) return 'not installed';
  const hooksText = fs.readFileSync(hooksJson, 'utf8');
  if (hooksText.includes('SessionStart') && hooksText.includes('.claude/hooks/session-start') && isExecutable(hookScript)) {
    return 'installed';
  }
  return 'incomplete';
}

function hasSection(lines, name) {
  return lines.some((line) => new RegExp(`^##\\s+${name}\\s*$`).test(line));
}

function formatLocalTimestamp(epochSeconds) {
  const date = new Date(epochSeconds * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function cmdDoctor() {
  const ledger = ledgerPath();
  let errorCount = 0;
  let warningCount = 0;
  const out = [];

  const sayError = (message) => {
    errorCount += 1;
    out.push(`ERROR: ${message}`);
  };
  const sayWarning = (message) => {
    warningCount += 1;
    out.push(`WARNING: ${message}`);
  };
  const sayInfo = (message) => out.push(`INFO: ${message}`);

  if (!fs.existsSync(ledger)) {
    sayError('.claude/WORKFLOW.md is missing.');
    console.log(out.join('\n'));
    process.exitCode = 1;
    return;
  }

  let text = '';
  try {
    text = fs.readFileSync(ledger, 'utf8');
  } catch {
    sayError('.claude/WORKFLOW.md exists but cannot be read.');
    console.log(out.join('\n'));
    process.exitCode = 1;
    return;
  }

  const lines = text.split(/\r?\n/);
  if (!hasSection(lines, 'Active')) sayError('Missing ## Active section.');
  if (!hasSection(lines, 'Backlog / Future')) sayError('Missing ## Backlog / Future section.');
  if (!hasSection(lines, 'Completed')) sayError('Missing ## Completed section.');

  let activeCount = 0;
  let backlogItems = 0;
  let completedItems = 0;
  let inActive = false;
  let inBacklog = false;
  let inCompleted = false;
  let task = null;

  const finishTask = () => {
    if (!task) return;
    if (task.status === 'In Progress') {
      if (!task.currentPhase) sayError(`In Progress task '${task.title}' lacks Current phase.`);
      if (!task.hasIntent) sayError(`In Progress task '${task.title}' lacks Intent.`);
      if (!task.hasTodo) sayError(`In Progress task '${task.title}' lacks Current todo.`);
      if (!task.hasResume) sayError(`In Progress task '${task.title}' lacks Resume next.`);
      if (task.level === '2' || task.level === '3') {
        if (!task.hasChanges) sayWarning(`Level ${task.level} task '${task.title}' lacks Changes.`);
        if (!task.hasPrerequisites) sayWarning(`Level ${task.level} task '${task.title}' lacks Prerequisites.`);
      }
    }
    if (task.status === 'Blocked') {
      if (!task.hasBlockedBy) sayError(`Blocked task '${task.title}' lacks Blocked by.`);
      if (!task.hasResume) sayError(`Blocked task '${task.title}' lacks Resume next.`);
    }
    if (task.status === 'Done' || task.status === 'Completed') {
      if (!task.hasCloseSummary) sayWarning(`Completed task '${task.title}' is still under Active and lacks Close summary. Move it to ## Completed when closing.`);
    }
    if (task.lineCount > 80) sayWarning(`Task '${task.title}' has more than 80 lines.`);
  };

  for (const line of lines) {
    if (line === '## Active') {
      finishTask();
      inActive = true;
      inBacklog = false;
      inCompleted = false;
      task = null;
      continue;
    }
    if (line === '## Backlog / Future') {
      finishTask();
      inActive = false;
      inBacklog = true;
      inCompleted = false;
      task = null;
      continue;
    }
    if (line === '## Completed') {
      finishTask();
      inActive = false;
      inBacklog = false;
      inCompleted = true;
      task = null;
      continue;
    }
    if (line.startsWith('## ')) {
      finishTask();
      inActive = false;
      inBacklog = false;
      inCompleted = false;
      task = null;
    }

    if (inBacklog && /^-\s+(\[[ xX]\]\s+)?/.test(line)) backlogItems += 1;
    if (inCompleted && /^###\s+/.test(line)) completedItems += 1;

    if (!inActive) continue;
    if (task) task.lineCount += 1;
    const titleMatch = line.match(/^###\s+(.+)/);
    if (titleMatch) {
      finishTask();
      activeCount += 1;
      task = {
        title: titleMatch[1],
        status: '',
        level: '',
        currentPhase: '',
        hasIntent: false,
        hasTodo: false,
        hasChanges: false,
        hasPrerequisites: false,
        hasResume: false,
        hasBlockedBy: false,
        hasCloseSummary: false,
        lineCount: 1,
      };
      continue;
    }
    if (!task) continue;
    const statusMatch = line.match(/^Status:\s*(.+)/);
    if (statusMatch && !task.status) task.status = statusMatch[1];
    const levelMatch = line.match(/^Level:\s*([0-3])/);
    if (levelMatch) task.level = levelMatch[1];
    const currentMatch = line.match(/^Current\s+phase:\s*(.+)/);
    if (currentMatch) task.currentPhase = currentMatch[1];
    if (/^Intent:/.test(line)) task.hasIntent = true;
    if (/^Current\s+todo:/.test(line)) task.hasTodo = true;
    if (/^Changes:/.test(line)) task.hasChanges = true;
    if (/^Prerequisites:/.test(line)) task.hasPrerequisites = true;
    if (/^Blocked\s+by:/.test(line)) task.hasBlockedBy = true;
    if (/^Resume\s+next:/.test(line)) task.hasResume = true;
    if (/^Close\s+summary:/.test(line)) task.hasCloseSummary = true;
  }
  finishTask();

  if (backlogItems > 10) sayWarning('Backlog / Future contains more than 10 items.');
  if (activeCount > 1) sayWarning('More than one Active task; include priority, blocker state, and Resume next if this is intentional.');

  sayInfo(`Active tasks: ${activeCount}`);
  sayInfo(`Backlog items: ${backlogItems}`);
  sayInfo(`Completed tasks: ${completedItems}`);

  let ledgerMtime = 0;
  try {
    ledgerMtime = Math.floor(fs.statSync(ledger).mtimeMs / 1000);
    sayInfo(`Ledger modified: ${formatLocalTimestamp(ledgerMtime)}`);
  } catch {
    ledgerMtime = 0;
  }

  const inGit = spawnSync('git', ['-C', targetRoot, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  if (inGit.status === 0) {
    const latest = spawnSync('git', ['-C', targetRoot, 'log', '-1', '--format=%ct'], { encoding: 'utf8' });
    const commitTime = Number(latest.stdout.trim());
    if (latest.status === 0 && Number.isFinite(commitTime) && commitTime > 0) {
      sayInfo(`Latest git commit: ${formatLocalTimestamp(commitTime)}`);
      if (ledgerMtime > 0 && ledgerMtime < commitTime) sayWarning('Ledger modified time is older than latest git commit.');
    }
  }

  sayInfo(`Hooks: ${hookStatusValue()}`);
  if (errorCount > 0) {
    out.push(`doctor finished with ${errorCount} error(s), ${warningCount} warning(s).`);
    process.exitCode = 1;
  } else {
    out.push(`doctor finished with 0 errors, ${warningCount} warning(s).`);
  }
  console.log(out.join('\n'));
}

function cmdList() {
  const ledger = ledgerPath();
  if (!fs.existsSync(ledger)) {
    console.error('No .claude/WORKFLOW.md found; no tasks to list.');
    return;
  }

  let text = '';
  try {
    text = fs.readFileSync(ledger, 'utf8');
  } catch {
    console.error('error: .claude/WORKFLOW.md exists but cannot be read.');
    process.exitCode = 1;
    return;
  }

  const lines = text.split(/\r?\n/);
  const out = ['Active:'];
  let inActive = false;
  let inBacklog = false;
  let inCompleted = false;
  let inResume = false;
  let backlogItems = 0;
  let completedItems = 0;
  let currentTask = '';
  let status = '';
  let level = '';
  let currentPhase = '';
  let resumeNext = '';

  const printTask = () => {
    if (!currentTask) return;
    let meta = '';
    if (level) meta = `[Level ${level}]`;
    if (status) meta = `${meta} ${status}`;
    out.push(`- ${currentTask} ${meta}`);
    if (currentPhase) out.push(`  Current phase: ${currentPhase}`);
    if (resumeNext) out.push(`  Resume next: ${resumeNext}`);
  };

  for (const line of lines) {
    if (line === '## Active') {
      inActive = true;
      inBacklog = false;
      inCompleted = false;
      inResume = false;
      continue;
    }
    if (line === '## Backlog / Future') {
      printTask();
      currentTask = '';
      inActive = false;
      inBacklog = true;
      inCompleted = false;
      inResume = false;
      continue;
    }
    if (line === '## Completed') {
      printTask();
      currentTask = '';
      inActive = false;
      inBacklog = false;
      inCompleted = true;
      inResume = false;
      continue;
    }
    if (line.startsWith('## ')) {
      printTask();
      currentTask = '';
      inActive = false;
      inBacklog = false;
      inCompleted = false;
      inResume = false;
    }

    if (inActive) {
      const titleMatch = line.match(/^###\s+(.+)/);
      if (titleMatch) {
        printTask();
        currentTask = titleMatch[1];
        status = '';
        level = '';
        currentPhase = '';
        resumeNext = '';
        inResume = false;
      } else {
        const statusMatch = line.match(/^Status:\s*(.+)/);
        const levelMatch = line.match(/^Level:\s*([0-3])/);
        const currentMatch = line.match(/^Current\s+phase:\s*(.+)/);
        if (statusMatch && !status) {
          status = statusMatch[1];
          inResume = false;
        } else if (levelMatch) {
          level = levelMatch[1];
          inResume = false;
        } else if (currentMatch) {
          currentPhase = currentMatch[1];
          inResume = false;
        } else if (/^Resume\s+next:/.test(line)) {
          inResume = true;
        } else if (inResume && /^-\s+(.+)/.test(line)) {
          if (!resumeNext) resumeNext = line.replace(/^-\s+/, '');
        } else if (line.trim()) {
          inResume = false;
        }
      }
    } else if (inBacklog && /^-\s+(\[[ xX]\]\s+)?/.test(line)) {
      backlogItems += 1;
    } else if (inCompleted && /^###\s+/.test(line)) {
      completedItems += 1;
    }
  }
  printTask();
  out.push('', 'Backlog / Future:', `- ${backlogItems} items`, '', 'Completed:', `- ${completedItems} items`);
  console.log(out.join('\n'));
}

function cmdHooksStatus() {
  console.log(`hooks: ${hookStatusValue()}`);
  console.log(`hooks.json: ${hooksJsonPath()}`);
  console.log(`session-start: ${hookScriptPath()}`);
}

const DEFAULT_HOOKS_JSON = `{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "command": ".claude/hooks/session-start"
      }
    ]
  }
}
`;

const DEFAULT_SESSION_START_HOOK = `#!/usr/bin/env bash
set -u

ledger=".claude/WORKFLOW.md"
cli=".claude/bin/workflow-ledger"

if [ ! -f "$ledger" ]; then
  exit 0
fi

if [ -n "\${CLAUDE_PLUGIN_ROOT:-}" ]; then
  cat <<'PLUGIN_JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Workflow Ledger detected.\\n- Read .claude/WORKFLOW.md before resuming tracked work.\\n- Check Active tasks, Current phase/current focus, Current todo, and Resume next.\\n- Run workflow-ledger doctor if state may be stale."}}
PLUGIN_JSON
  exit 0
fi

printf 'Workflow Ledger detected.\\n'
printf -- '- Read .claude/WORKFLOW.md before resuming tracked work.\\n'
printf -- '- Check Active tasks, Current phase/current focus, Current todo, and Resume next.\\n'

if [ -x "$cli" ]; then
  printf -- '- Run .claude/bin/workflow-ledger doctor if state may be stale.\\n'
else
  printf -- '- Run workflow-ledger doctor if the project CLI is available.\\n'
fi

exit 0
`;

function cmdHooksInstall() {
  const targetDir = path.join(targetRoot, '.claude', 'hooks');
  try {
    ensureDir(targetDir);
  } catch {
    console.error('error: cannot create .claude/hooks directory.');
    process.exitCode = 1;
    return;
  }

  const hooksJson = hooksJsonPath();
  const hookScript = hookScriptPath();
  if (fs.existsSync(hooksJson)) {
    console.log('kept existing .claude/hooks/hooks.json');
  } else {
    fs.writeFileSync(hooksJson, DEFAULT_HOOKS_JSON);
    console.log('installed .claude/hooks/hooks.json');
  }

  if (fs.existsSync(hookScript)) {
    console.log('kept existing .claude/hooks/session-start');
  } else {
    fs.writeFileSync(hookScript, DEFAULT_SESSION_START_HOOK, { mode: 0o755 });
    fs.chmodSync(hookScript, 0o755);
    console.log('installed .claude/hooks/session-start');
  }
}

function runCommand(argv) {
  const command = argv[0] || 'help';
  if (command === 'help' || command === '-h' || command === '--help') {
    printHelp();
  } else if (command === 'setup') {
    setup(args);
  } else if (command === 'init') {
    return initProject(args);
  } else if (command === 'doctor') {
    cmdDoctor();
  } else if (command === 'list') {
    cmdList();
  } else if (command === 'hooks') {
    const subcommand = argv[1] || 'status';
    if (subcommand === 'status') cmdHooksStatus();
    else if (subcommand === 'install') cmdHooksInstall();
    else {
      console.error(`error: unknown hooks command: ${subcommand}`);
      process.exitCode = 1;
    }
  } else {
    console.error(`error: unknown command: ${command}\n`);
    printHelp();
    process.exitCode = 1;
  }
}

const args = parseArgs(process.argv.slice(2));
async function main() {
  await runCommand(process.argv.slice(2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
