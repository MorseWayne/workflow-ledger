# 使用指南

本文介绍如何在 Claude Code 项目中使用 `workflow-ledger`。

## 安装到项目

先做全局工具接入：

```bash
npx workflow-ledger setup
```

配置特定工具：

```bash
npx workflow-ledger setup --tool claude-code
npx workflow-ledger setup --tool codex
npx workflow-ledger setup --tool all
```

然后在项目根目录初始化 ledger：

```bash
npx workflow-ledger init
npx workflow-ledger init --tool claude-code
npx workflow-ledger init --tool codex
npx workflow-ledger init --tool all
```

`claude-code` 项目 adapter 会创建 `.claude/WORKFLOW.md` 并更新 `CLAUDE.md`。`codex` 项目 adapter 会创建 `.workflow-ledger/WORKFLOW.md` 并更新 `AGENTS.md`。

Bash 安装脚本仍然可用：

```bash
curl -fsSL https://raw.githubusercontent.com/MorseWayne/workflow-ledger/main/install.sh | bash
```

初始化流程是幂等的：

- 只在缺失时创建对应的 Workflow Ledger 文件
- 保留已有工具指令片段和 ledger

如果你已经有本地 checkout：

```bash
/path/to/workflow-ledger/install.sh /path/to/your/project
```

手动安装仍然有三个项目本地必需步骤：复制 skill、追加 `CLAUDE.md` 规则片段、创建 ledger 文件。

```bash
mkdir -p .claude/skills .claude
cp -R /path/to/workflow-ledger/skills/workflow-ledger .claude/skills/workflow-ledger
cp /path/to/workflow-ledger/skills/workflow-ledger/templates/WORKFLOW.md .claude/WORKFLOW.md
```

把项目规则片段追加到 `CLAUDE.md`，让 Claude 始终能看到 Level 2/3 任务需要使用 skill 和 ledger 的简短提醒：

```bash
cat /path/to/workflow-ledger/examples/claude-project/CLAUDE.md.snippet >> CLAUDE.md
```

## 开始跟踪任务

在 Claude Code 中输入：

```text
/workflow-ledger start "add streaming usage accounting"
```

Claude 应该：

1. 判断任务级别。
2. 创建或更新 `.claude/WORKFLOW.md`。
3. 规划阶段。
4. 只展开当前阶段的具体子任务。
5. 使用 TodoWrite 跟踪当前会话执行。

## 恢复任务

```text
/workflow-ledger resume
```

Claude 应该读取 `.claude/WORKFLOW.md`，检查当前仓库状态，然后根据 `Current phase`、`Current phase tasks` 和 `Resume next` 继续执行。

## 更新任务

在执行过程中，只在里程碑节点更新 ledger：

- 任务开始
- 关键决策
- 阶段完成
- 发现依赖或阻塞
- 验证结果
- 中断交接
- 提交或关闭任务

不要每次小编辑都更新。

## 关闭任务

```text
/workflow-ledger close
```

Claude 应该：

1. 确认必要阶段已完成，或明确延期。
2. 补充短 `Acceptance` 证据。
3. 把任务从 `Active` 移到 `Completed`。
4. 记录 commit、验收摘要、GitNexus 摘要、缺口和后续任务。
5. 把未来工作保留在 `Backlog / Future`。

## 保持轻量

不要默认创建附件。只有 Level 3 任务需要长调研、详细设计或大量验证输出时，才创建附件并从 `.claude/WORKFLOW.md` 链接过去。
