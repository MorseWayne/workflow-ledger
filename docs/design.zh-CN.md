# 设计说明

`workflow-ledger` 是面向 Claude Code 项目的轻量级 OpenSpec-style change ledger。

## 问题

长时间运行的 Claude Code 任务可能会中断、在新会话中恢复，或者交给另一个 agent 继续。单靠聊天历史和当前会话 todo，不足以可靠恢复任务状态。

重型 spec 系统可以通过许多文件和正式阶段解决这个问题，但这对日常开发来说经常太重。

## 方案

使用一个单文件 change ledger `.claude/WORKFLOW.md`，再配合一个可复用 Claude Code skill。

skill 指导 Claude：

- 判断任务重量级别。
- 创建或更新一个 intent-first 任务条目。
- 执行中发现新情况时允许调整 `Current todo`。
- 跟踪前置依赖、阻塞和执行中发现的未来任务。
- 把完成任务归档为简洁历史。

## 非目标

- 默认不为每个任务创建独立文件。
- 不强制创建 proposal / design / tasks 文档。
- 不强制使用 hook 自动化。
- 不引入重型 CLI 运行时或包管理器；可选 CLI 保持零依赖、项目本地。

## 文件模型

- `.claude/WORKFLOW.md`：项目本地 change ledger。
- `.claude/skills/workflow-ledger/SKILL.md`：可复用工作流说明。
- 可选附件：只用于 Level 3 的长细节。

## 任务级别

- Level 0：问答 / 只读解释，不需要 ledger。
- Level 1：轻量修改，ledger 可选。
- Level 2：标准代码任务，需要 ledger。
- Level 3：复杂任务，需要 ledger，可选附件。

## 恢复模型

恢复任务时读取 `.claude/WORKFLOW.md`，找到 `Active`，根据 `Intent`、`Current phase`、`Current todo`、`Prerequisites`、`Blocked by` 和 `Resume next` 继续。

在信任 ledger 前，应先检查当前仓库状态；如果代码现状和 ledger 不一致，以当前代码和 git 状态为准，并更新 ledger。
