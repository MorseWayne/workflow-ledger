#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(__dirname, '..');

function defaultTargetRoot(): string {
  if (process.env.WORKFLOW_LEDGER_ROOT) return path.resolve(process.env.WORKFLOW_LEDGER_ROOT);
  if (path.basename(__dirname) === 'bin' && path.basename(path.dirname(__dirname)) === '.claude') {
    return path.resolve(__dirname, '..', '..');
  }
  return process.cwd();
}

const targetRoot = defaultTargetRoot();

const toolAliases = new Map<string, string>([
  ['cc', 'claude-code'],
  ['claude', 'claude-code'],
  ['claude-code', 'claude-code'],
  ['codex', 'codex'],
  ['all', 'all'],
]);

const languageAliases = new Map<string, string>([
  ['en', 'en'],
  ['english', 'en'],
  ['zh', 'zh-CN'],
  ['zh-cn', 'zh-CN'],
  ['zh_CN', 'zh-CN'],
  ['cn', 'zh-CN'],
  ['chinese', 'zh-CN'],
  ['中文', 'zh-CN'],
]);

function printHelp(): void {
  console.log(`workflow-ledger — lightweight workflow guardrails for AI coding agents

Usage:
  workflow-ledger setup [--tool claude-code|codex|all]
  workflow-ledger init [--tool claude-code|codex|all] [--lang en|zh-CN] [--root PATH]
  workflow-ledger help
  workflow-ledger doctor [--json]
  workflow-ledger list [--json]
  workflow-ledger next [--json]
  workflow-ledger hooks status
  workflow-ledger hooks install

setup installs global tool integrations. init creates project-local ledger files.`);
}

interface CliArgs {
  command: string;
  tool: string;
  language: string;
  root: string;
  interactiveLanguage: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args = {
    command: argv[0] || 'help',
    tool: 'claude-code',
    language: '',
    root: targetRoot,
    interactiveLanguage: argv[0] === 'init',
    json: false,
  };
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
    } else if (arg === '--json') {
      args.json = true;
    }
  }
  args.tool = toolAliases.get(args.tool) || args.tool;
  args.language = args.language ? languageAliases.get(args.language) || args.language : 'en';
  return args;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function dirExists(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

interface CommandResult {
  configured: string[];
  skipped: string[];
  errors: string[];
}

function copyFileIfMissing(src: string, dest: string, createdMessage: string, keptMessage: string, result: CommandResult): void {
  if (fs.existsSync(dest)) {
    result.configured.push(keptMessage);
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  result.configured.push(createdMessage);
}

function copyDir(src: string, dest: string): void {
  fs.rmSync(dest, { recursive: true, force: true });
  ensureDir(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true });
}

function copyCli(dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(__filename, dest);
  fs.chmodSync(dest, 0o755);
}

function appendSnippet(marker: string, snippetPath: string, targetPath: string, updatedMessage: string, keptMessage: string, result: CommandResult): void {
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

function validateTool(tool: string): boolean {
  if (!['claude-code', 'codex', 'all'].includes(tool)) {
    console.error(`error: unknown tool '${tool}'. Expected claude-code, codex, or all.`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

function validateLanguage(language: string): boolean {
  if (!['en', 'zh-CN'].includes(language)) {
    console.error(`error: unknown language '${language}'. Expected en or zh-CN.`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function chooseLanguage(): Promise<string> {
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

function localizedPath(...segments: string[]): string {
  return path.join(repoRoot, ...segments);
}

function createResult(): CommandResult {
  return { configured: [], skipped: [], errors: [] };
}

function printResult(title: string, result: CommandResult): void {
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setupClaudeCodeGlobal(result: CommandResult): void {
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
    result.errors.push(`Claude Code: ${errorMessage(error)}`);
  }
}

function setupCodexGlobal(result: CommandResult): void {
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
    result.errors.push(`Codex: ${errorMessage(error)}`);
  }
}

function setup(args: CliArgs): void {
  if (!validateTool(args.tool)) return;
  const result = createResult();
  if (args.tool === 'claude-code' || args.tool === 'all') setupClaudeCodeGlobal(result);
  if (args.tool === 'codex' || args.tool === 'all') setupCodexGlobal(result);
  printResult('Workflow Ledger Setup', result);
  console.log('\nNext: run workflow-ledger init in a project.');
}

function templateFile(language: string, englishPath: string[], chinesePath: string[]): string {
  return language === 'zh-CN' ? localizedPath(...chinesePath) : localizedPath(...englishPath);
}

function initClaudeCodeProject(root: string, language: string, result: CommandResult): void {
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

function initCodexProject(root: string, language: string, result: CommandResult): void {
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

async function initProject(args: CliArgs): Promise<void> {
  if (!validateTool(args.tool)) return;
  if (!validateLanguage(args.language)) return;
  const language = args.interactiveLanguage ? await chooseLanguage() : args.language;
  const result = createResult();
  ensureDir(args.root);
  if (args.tool === 'claude-code' || args.tool === 'all') initClaudeCodeProject(args.root, language, result);
  if (args.tool === 'codex' || args.tool === 'all') initCodexProject(args.root, language, result);
  printResult('Workflow Ledger Init', result);
}

function ledgerPath(root = targetRoot): string {
  return path.join(root, '.claude', 'WORKFLOW.md');
}

function hooksJsonPath(root = targetRoot): string {
  return path.join(root, '.claude', 'hooks', 'hooks.json');
}

function hookScriptPath(root = targetRoot): string {
  return path.join(root, '.claude', 'hooks', 'session-start');
}

function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function hookStatusValue(root = targetRoot): string {
  const hooksJson = hooksJsonPath(root);
  const hookScript = hookScriptPath(root);
  if (!fs.existsSync(hooksJson) || !fs.existsSync(hookScript)) return 'not installed';
  const hooksText = fs.readFileSync(hooksJson, 'utf8');
  if (hooksText.includes('SessionStart') && hooksText.includes('.claude/hooks/session-start') && isExecutable(hookScript)) {
    return 'installed';
  }
  return 'incomplete';
}

function formatLocalTimestamp(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

type PlanStatus = 'todo' | 'doing' | 'done' | 'blocked' | 'deferred' | 'removed' | 'merged';

type LedgerSection = 'none' | 'active' | 'backlog' | 'completed';

interface PlanItem {
  id: string;
  status: string;
  title: string;
  raw: string;
  line: number;
}

interface LedgerTask {
  title: string;
  status: string;
  level: string;
  currentPhase: string;
  hasIntent: boolean;
  hasPlan: boolean;
  hasTodo: boolean;
  hasChanges: boolean;
  hasPrerequisites: boolean;
  hasResume: boolean;
  hasBlockedBy: boolean;
  hasCloseSummary: boolean;
  lineCount: number;
  planItems: PlanItem[];
  currentTodoItems: string[];
  resumeNext: string;
}

interface ParsedLedger {
  lines: string[];
  hasActive: boolean;
  hasBacklog: boolean;
  hasCompleted: boolean;
  activeTasks: LedgerTask[];
  backlogItems: number;
  completedItems: number;
}

interface DoctorDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
}

const knownPlanStatuses = new Set<PlanStatus>(['todo', 'doing', 'done', 'blocked', 'deferred', 'removed', 'merged']);

function isTaskBlockHeading(line: string): boolean {
  return /^(Intent|Plan|Current\s+todo|Changes|Prerequisites|Blocked\s+by|Resume\s+next|Close\s+summary|Acceptance\s*\/\s*Review):\s*$/.test(line);
}

function normalizePlanStatus(status: string): string {
  return status.trim().toLowerCase();
}

function parsePlanItem(line: string, lineNumber: number): PlanItem | null {
  const match = line.match(/^-\s+\[([^\]]+)\]\s+([A-Za-z][A-Za-z0-9._-]*)\s+(?:—|-)\s+(.+)$/);
  if (!match) return null;
  return {
    status: normalizePlanStatus(match[1]),
    id: match[2],
    title: match[3].trim(),
    raw: line.trim(),
    line: lineNumber,
  };
}

function planItemNeedsReason(item: PlanItem): boolean {
  return ['blocked', 'deferred', 'removed', 'merged'].includes(item.status);
}

function planItemHasReason(item: PlanItem): boolean {
  return /\b(blocked|deferred|removed|merged|reason|because|into):/i.test(item.raw)
    || /(原因|因为|阻塞|延后|延期|移除|合并|并入|转入)/.test(item.raw);
}

function planSummary(planItems: PlanItem[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const item of planItems) summary[item.status] = (summary[item.status] || 0) + 1;
  return summary;
}

function nextPlanItem(task: LedgerTask): PlanItem | null {
  return task.planItems.find((item) => item.status === 'doing')
    || task.planItems.find((item) => item.status === 'todo')
    || task.planItems.find((item) => item.status === 'blocked')
    || null;
}

function extractPlanRefs(text: string): string[] {
  return Array.from(new Set(text.match(/\bP\d+[A-Za-z0-9._-]*\b/g) || []));
}

function createEmptyTask(title: string): LedgerTask {
  return {
    title,
    status: '',
    level: '',
    currentPhase: '',
    hasIntent: false,
    hasPlan: false,
    hasTodo: false,
    hasChanges: false,
    hasPrerequisites: false,
    hasResume: false,
    hasBlockedBy: false,
    hasCloseSummary: false,
    lineCount: 1,
    planItems: [],
    currentTodoItems: [],
    resumeNext: '',
  };
}

function parseLedgerText(text: string): ParsedLedger {
  const lines = text.split(/\r?\n/);
  const activeTasks: LedgerTask[] = [];
  let section: LedgerSection = 'none';
  let currentBlock = '';
  let backlogItems = 0;
  let completedItems = 0;
  let task: LedgerTask | null = null;
  let hasActive = false;
  let hasBacklog = false;
  let hasCompleted = false;

  const finishTask = (): void => {
    if (!task) return;
    activeTasks.push(task);
    task = null;
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (line === '## Active') {
      finishTask();
      section = 'active';
      currentBlock = '';
      hasActive = true;
      return;
    }
    if (line === '## Backlog / Future') {
      finishTask();
      section = 'backlog';
      currentBlock = '';
      hasBacklog = true;
      return;
    }
    if (line === '## Completed') {
      finishTask();
      section = 'completed';
      currentBlock = '';
      hasCompleted = true;
      return;
    }
    if (line.startsWith('## ')) {
      finishTask();
      section = 'none';
      currentBlock = '';
      return;
    }

    if (section === 'backlog' && /^-\s+(\[[ xX]\]\s+)?/.test(line)) backlogItems += 1;
    if (section === 'completed' && /^###\s+/.test(line)) completedItems += 1;
    if (section !== 'active') return;

    if (task) task.lineCount += 1;
    const titleMatch = line.match(/^###\s+(.+)/);
    if (titleMatch) {
      finishTask();
      task = createEmptyTask(titleMatch[1]);
      currentBlock = '';
      return;
    }
    if (!task) return;

    const statusMatch = line.match(/^Status:\s*(.+)/);
    if (statusMatch && !task.status) task.status = statusMatch[1];
    const levelMatch = line.match(/^Level:\s*([0-3])/);
    if (levelMatch) task.level = levelMatch[1];
    const currentMatch = line.match(/^Current\s+phase:\s*(.+)/);
    if (currentMatch) task.currentPhase = currentMatch[1];

    if (/^Intent:/.test(line)) {
      task.hasIntent = true;
      currentBlock = 'Intent';
    } else if (/^Plan:/.test(line)) {
      task.hasPlan = true;
      currentBlock = 'Plan';
    } else if (/^Current\s+todo:/.test(line)) {
      task.hasTodo = true;
      currentBlock = 'Current todo';
    } else if (/^Changes:/.test(line)) {
      task.hasChanges = true;
      currentBlock = 'Changes';
    } else if (/^Prerequisites:/.test(line)) {
      task.hasPrerequisites = true;
      currentBlock = 'Prerequisites';
    } else if (/^Blocked\s+by:/.test(line)) {
      task.hasBlockedBy = true;
      currentBlock = 'Blocked by';
    } else if (/^Resume\s+next:/.test(line)) {
      task.hasResume = true;
      currentBlock = 'Resume next';
    } else if (/^Close\s+summary:/.test(line)) {
      task.hasCloseSummary = true;
      currentBlock = 'Close summary';
    } else if (isTaskBlockHeading(line)) {
      currentBlock = '';
    } else if (currentBlock === 'Plan') {
      const item = parsePlanItem(line, lineNumber);
      if (item) task.planItems.push(item);
    } else if (currentBlock === 'Current todo' && /^-\s+/.test(line)) {
      task.currentTodoItems.push(line.replace(/^-\s+\[[ xX]\]\s*/, '').replace(/^-\s+/, '').trim());
    } else if (currentBlock === 'Resume next' && /^-\s+(.+)/.test(line) && !task.resumeNext) {
      task.resumeNext = line.replace(/^-\s+/, '').trim();
    } else if (line.trim() && currentBlock === 'Resume next') {
      currentBlock = '';
    }
  });
  finishTask();

  return { lines, hasActive, hasBacklog, hasCompleted, activeTasks, backlogItems, completedItems };
}

function readLedgerForCommand(): { ledger: string; text: string } | null {
  const ledger = ledgerPath();
  if (!fs.existsSync(ledger)) return null;
  return { ledger, text: fs.readFileSync(ledger, 'utf8') };
}

function collectDoctorDiagnostics(parsed: ParsedLedger, ledger: string): { diagnostics: DoctorDiagnostic[]; errorCount: number; warningCount: number; ledgerMtime: number } {
  const diagnostics: DoctorDiagnostic[] = [];
  let errorCount = 0;
  let warningCount = 0;

  const say = (severity: DoctorDiagnostic['severity'], message: string): void => {
    diagnostics.push({ severity, message });
    if (severity === 'error') errorCount += 1;
    if (severity === 'warning') warningCount += 1;
  };

  if (!parsed.hasActive) say('error', 'Missing ## Active section.');
  if (!parsed.hasBacklog) say('error', 'Missing ## Backlog / Future section.');
  if (!parsed.hasCompleted) say('error', 'Missing ## Completed section.');

  for (const task of parsed.activeTasks) {
    if (task.status === 'In Progress') {
      if (!task.currentPhase) say('error', `In Progress task '${task.title}' lacks Current phase.`);
      if (!task.hasIntent) say('error', `In Progress task '${task.title}' lacks Intent.`);
      if (!task.hasTodo) say('error', `In Progress task '${task.title}' lacks Current todo.`);
      if (!task.hasResume) say('error', `In Progress task '${task.title}' lacks Resume next.`);
      if (task.level === '2' || task.level === '3') {
        if (!task.hasPlan) say('warning', `Level ${task.level} task '${task.title}' lacks Plan.`);
        if (!task.hasChanges) say('warning', `Level ${task.level} task '${task.title}' lacks Changes.`);
        if (!task.hasPrerequisites) say('warning', `Level ${task.level} task '${task.title}' lacks Prerequisites.`);
      }
    }
    if (task.status === 'Blocked') {
      if (!task.hasBlockedBy) say('error', `Blocked task '${task.title}' lacks Blocked by.`);
      if (!task.hasResume) say('error', `Blocked task '${task.title}' lacks Resume next.`);
    }
    if (task.status === 'Done' || task.status === 'Completed') {
      if (!task.hasCloseSummary) say('warning', `Completed task '${task.title}' is still under Active and lacks Close summary. Move it to ## Completed when closing.`);
    }
    if (task.lineCount > 100) say('warning', `Task '${task.title}' has more than 100 lines.`);

    if (task.hasPlan) {
      if (task.planItems.length === 0) say('warning', `Task '${task.title}' has Plan but no structured plan items.`);
      const doingItems = task.planItems.filter((item) => item.status === 'doing');
      if (doingItems.length > 1) say('warning', `Task '${task.title}' has more than one doing Plan item.`);
      const ids = new Set<string>();
      for (const item of task.planItems) {
        if (ids.has(item.id)) say('warning', `Task '${task.title}' repeats Plan item id ${item.id}.`);
        ids.add(item.id);
        if (!knownPlanStatuses.has(item.status as PlanStatus)) say('warning', `Task '${task.title}' has unknown Plan status '${item.status}' on ${item.id}.`);
        if (planItemNeedsReason(item) && !planItemHasReason(item)) say('warning', `Task '${task.title}' Plan item ${item.id} is ${item.status} but lacks a reason.`);
      }
      const currentRefs = task.currentTodoItems.flatMap(extractPlanRefs);
      if (task.currentTodoItems.length > 0 && currentRefs.length === 0) say('warning', `Task '${task.title}' Current todo does not reference a Plan item id.`);
      for (const ref of currentRefs) {
        if (!ids.has(ref)) say('warning', `Task '${task.title}' Current todo references missing Plan item ${ref}.`);
      }
    }
  }

  if (parsed.backlogItems > 10) say('warning', 'Backlog / Future contains more than 10 items.');
  if (parsed.activeTasks.length > 1) say('warning', 'More than one Active task; include priority, blocker state, and Resume next if this is intentional.');

  say('info', `Active tasks: ${parsed.activeTasks.length}`);
  say('info', `Backlog items: ${parsed.backlogItems}`);
  say('info', `Completed tasks: ${parsed.completedItems}`);

  let ledgerMtime = 0;
  try {
    ledgerMtime = Math.floor(fs.statSync(ledger).mtimeMs / 1000);
    say('info', `Ledger modified: ${formatLocalTimestamp(ledgerMtime)}`);
  } catch {
    ledgerMtime = 0;
  }

  const inGit = spawnSync('git', ['-C', targetRoot, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  if (inGit.status === 0) {
    const latest = spawnSync('git', ['-C', targetRoot, 'log', '-1', '--format=%ct'], { encoding: 'utf8' });
    const commitTime = Number(latest.stdout.trim());
    if (latest.status === 0 && Number.isFinite(commitTime) && commitTime > 0) {
      say('info', `Latest git commit: ${formatLocalTimestamp(commitTime)}`);
      if (ledgerMtime > 0 && ledgerMtime < commitTime) say('warning', 'Ledger modified time is older than latest git commit.');
    }
  }

  say('info', `Hooks: ${hookStatusValue()}`);
  return { diagnostics, errorCount, warningCount, ledgerMtime };
}

function cmdDoctor(): void {
  const ledger = ledgerPath();
  if (!fs.existsSync(ledger)) {
    const diagnostics: DoctorDiagnostic[] = [{ severity: 'error', message: '.claude/WORKFLOW.md is missing.' }];
    if (args.json) console.log(JSON.stringify({ ok: false, errors: 1, warnings: 0, diagnostics }, null, 2));
    else console.log(['ERROR: .claude/WORKFLOW.md is missing.', 'doctor finished with 1 error(s), 0 warning(s).'].join('\n'));
    process.exitCode = 1;
    return;
  }

  let text = '';
  try {
    text = fs.readFileSync(ledger, 'utf8');
  } catch {
    const diagnostics: DoctorDiagnostic[] = [{ severity: 'error', message: '.claude/WORKFLOW.md exists but cannot be read.' }];
    if (args.json) console.log(JSON.stringify({ ok: false, errors: 1, warnings: 0, diagnostics }, null, 2));
    else console.log(['ERROR: .claude/WORKFLOW.md exists but cannot be read.', 'doctor finished with 1 error(s), 0 warning(s).'].join('\n'));
    process.exitCode = 1;
    return;
  }

  const parsed = parseLedgerText(text);
  const result = collectDoctorDiagnostics(parsed, ledger);
  const ok = result.errorCount === 0;
  if (args.json) {
    console.log(JSON.stringify({
      ok,
      errors: result.errorCount,
      warnings: result.warningCount,
      diagnostics: result.diagnostics,
      summary: {
        activeTasks: parsed.activeTasks.length,
        backlogItems: parsed.backlogItems,
        completedTasks: parsed.completedItems,
        ledgerMtime: result.ledgerMtime,
        hooks: hookStatusValue(),
      },
    }, null, 2));
  } else {
    const out = result.diagnostics.map((diagnostic) => `${diagnostic.severity.toUpperCase()}: ${diagnostic.message}`);
    out.push(ok ? `doctor finished with 0 errors, ${result.warningCount} warning(s).` : `doctor finished with ${result.errorCount} error(s), ${result.warningCount} warning(s).`);
    console.log(out.join('\n'));
  }
  if (!ok) process.exitCode = 1;
}

function taskListJson(task: LedgerTask) {
  return {
    title: task.title,
    status: task.status,
    level: task.level,
    currentPhase: task.currentPhase,
    resumeNext: task.resumeNext,
    currentTodo: task.currentTodoItems,
    plan: {
      summary: planSummary(task.planItems),
      next: nextPlanItem(task),
      items: task.planItems,
    },
  };
}

function cmdList(): void {
  const loaded = readLedgerForCommand();
  if (!loaded) {
    if (args.json) console.log(JSON.stringify({ active: [], backlogItems: 0, completedTasks: 0 }, null, 2));
    else console.error('No .claude/WORKFLOW.md found; no tasks to list.');
    return;
  }

  let parsed: ParsedLedger;
  try {
    parsed = parseLedgerText(loaded.text);
  } catch {
    console.error('error: .claude/WORKFLOW.md exists but cannot be read.');
    process.exitCode = 1;
    return;
  }

  if (args.json) {
    console.log(JSON.stringify({
      active: parsed.activeTasks.map(taskListJson),
      backlogItems: parsed.backlogItems,
      completedTasks: parsed.completedItems,
    }, null, 2));
    return;
  }

  const out = ['Active:'];
  for (const task of parsed.activeTasks) {
    let meta = '';
    if (task.level) meta = `[Level ${task.level}]`;
    if (task.status) meta = `${meta} ${task.status}`.trim();
    out.push(`- ${task.title}${meta ? ` ${meta}` : ''}`);
    if (task.currentPhase) out.push(`  Current phase: ${task.currentPhase}`);
    if (task.planItems.length > 0) {
      const summary = planSummary(task.planItems);
      const summaryText = Object.keys(summary).sort().map((status) => `${status}:${summary[status]}`).join(', ');
      out.push(`  Plan: ${summaryText}`);
      const next = nextPlanItem(task);
      if (next) out.push(`  Next plan item: ${next.id} [${next.status}] ${next.title}`);
    }
    if (task.resumeNext) out.push(`  Resume next: ${task.resumeNext}`);
  }
  out.push('', 'Backlog / Future:', `- ${parsed.backlogItems} items`, '', 'Completed:', `- ${parsed.completedItems} items`);
  console.log(out.join('\n'));
}

function cmdNext(): void {
  const loaded = readLedgerForCommand();
  if (!loaded) {
    if (args.json) console.log(JSON.stringify({ task: null, next: null }, null, 2));
    else console.error('No .claude/WORKFLOW.md found; no next action.');
    return;
  }

  const parsed = parseLedgerText(loaded.text);
  const task = parsed.activeTasks[0] || null;
  const planItem = task ? nextPlanItem(task) : null;
  const next = task ? {
    task: task.title,
    currentPhase: task.currentPhase,
    planItem,
    resumeNext: task.resumeNext,
  } : null;

  if (args.json) {
    console.log(JSON.stringify({ task: task ? taskListJson(task) : null, next }, null, 2));
    return;
  }

  if (!task) {
    console.log('No Active task.');
    return;
  }
  console.log(`Task: ${task.title}`);
  if (task.currentPhase) console.log(`Current phase: ${task.currentPhase}`);
  if (planItem) console.log(`Next plan item: ${planItem.id} [${planItem.status}] ${planItem.title}`);
  if (task.resumeNext) console.log(`Resume next: ${task.resumeNext}`);
}

function cmdHooksStatus(): void {
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

const DEFAULT_SESSION_START_HOOK = [
  '#!/usr/bin/env node',
  "const fs = require('node:fs');",
  '',
  "const ledger = '.claude/WORKFLOW.md';",
  "const cli = '.claude/bin/workflow-ledger';",
  '',
  'if (!fs.existsSync(ledger)) {',
  '  process.exit(0);',
  '}',
  '',
  'if (process.env.CLAUDE_PLUGIN_ROOT) {',
  '  process.stdout.write(JSON.stringify({',
  '    hookSpecificOutput: {',
  "      hookEventName: 'SessionStart',",
  "      additionalContext: 'Workflow Ledger detected.\\n- Read .claude/WORKFLOW.md before resuming tracked work.\\n- Check Active tasks, Current phase/current focus, Current todo, and Resume next.\\n- Run workflow-ledger doctor if state may be stale.',",
  '    },',
  "  }) + '\\n');",
  '  process.exit(0);',
  '}',
  '',
  "process.stdout.write('Workflow Ledger detected.\\n');",
  "process.stdout.write('- Read .claude/WORKFLOW.md before resuming tracked work.\\n');",
  "process.stdout.write('- Check Active tasks, Current phase/current focus, Current todo, and Resume next.\\n');",
  '',
  'try {',
  '  fs.accessSync(cli, fs.constants.X_OK);',
  "  process.stdout.write('- Run .claude/bin/workflow-ledger doctor if state may be stale.\\n');",
  '} catch {',
  "  process.stdout.write('- Run workflow-ledger doctor if the project CLI is available.\\n');",
  '}',
  '',
].join('\n');

function cmdHooksInstall(): void {
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

async function runCommand(argv: string[]): Promise<void> {
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
  } else if (command === 'next') {
    cmdNext();
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
  console.error(errorMessage(error));
  process.exitCode = 1;
});
