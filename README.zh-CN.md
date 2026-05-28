# workflow-ledger

面向 Claude Code 的轻量级 OpenSpec-style change ledger。

`workflow-ledger` 让 Claude Code 项目在开发过程中保持**可跟踪、可恢复、可调整**，但不强迫每个任务都进入 proposal/design/tasks/spec 文件流程。

它要解决的是 AI 辅助开发里非常常见的问题：

> 会话中断、上下文压缩、换新会话继续时，没人能一眼看清已经做了什么、验收了什么、阻塞在哪里、下一步该干什么。

`workflow-ledger` 用一个项目总览文件解决这个问题：`.claude/WORKFLOW.md`。

## 为什么设计这个工作流

很多工作流系统为了可恢复性，会引入很多结构：

- proposal 文件
- design 文件
- task 文件
- 每个功能一个目录
- 阶段产物
- 命令状态机

这些对大型功能很有价值，但对日常 Claude Code 开发太重了。大多数任务真正需要的是：

- 一个地方看当前 change intent
- 可变的 `Current todo`，而不是冻结计划
- 能看到前置依赖、阻塞和延期任务
- 中断后能恢复
- 完成时只写短 `Close summary`

`workflow-ledger` 保留这些关键能力，同时避免制造大量文件。

## 它提供什么

- **单文件 change ledger**：`.claude/WORKFLOW.md` 是任务状态源。
- **任务分级**：Level 0-3，让简单任务保持轻量，复杂任务更安全。
- **Intent-first 条目**：每个 Active 任务只记录一个小的用户可见目标。
- **结构化 Plan**：Level 2/3 任务可以保留稳定计划项和 todo 历史。
- **设计转 ledger 规划**：`/workflow-ledger plan` 帮 coding agent 在实现前把设计文本转换成持久 Plan。
- **可变 todo**：`Current todo` 可以随新增需求、前置依赖或阻塞调整。
- **可恢复点**：每个活跃任务都有表示当前焦点的 `Current phase` 和 `Resume next`。
- **依赖管理**：阻塞当前目标的前置依赖留在 Active；非阻塞发现进入 Backlog/Future。
- **低文件数量**：默认不为每个任务创建独立文件。
- **Claude Code 原生**：以 skill 形式交付，不需要运行时依赖。

## 和其他方式的区别

| 方式 | 优点 | 代价 | workflow-ledger 的选择 |
|---|---|---|---|
| 只靠聊天历史 | 零配置 | 中断或压缩后难恢复 | 多步任务不够用 |
| 只靠 TodoWrite | 当前会话很好用 | 不能跨会话持久恢复 | 用于当前会话执行，不承担历史记录 |
| 重型 spec 工作流 | 治理强、可追踪 | 文件多、阶段重 | 只在 Level 3 真需要时使用 |
| hook 自动化 | 确定性强 | 容易变吵、变硬 | 作为可选保险丝，不作为主流程 |
| `workflow-ledger` | 轻量、可恢复、可验收 | 需要在里程碑节点更新一个文件 | 默认用于需要恢复的 Claude Code 开发任务 |

## 和具体工具的横向对比

| 工具 / 工作流 | 最擅长 | 常见形态 | `workflow-ledger` 的区别 |
|---|---|---|---|
| Superpowers 风格 skills | 用可复用 skill 和 checklist 教 Claude 按固定方式工作 | skill 包、详细流程、设计/计划循环、明确的人类批准门 | 采用同样的 skill-native 交付方式，但范围更窄：只解决任务记忆、change intent、可变 todo、前置依赖和恢复点 |
| GSD 风格规划工作流 | 把大型工作拆成调研、计划、执行、验证、安全/UI/eval review 等阶段 | 多 agent 规划与执行、阶段文档、review 报告、更强流程门禁 | 借鉴可恢复思路，但把日常任务的仪式感降到最低；重型 review 产物不进入默认 ledger |
| OpenSpec 风格 spec 工作流 | 用 proposal、spec、tasks 和归档历史治理产品/API 变化 | 正式 proposal/design/task 文件和 spec 生命周期 | 借鉴 intent/change 管理意识，但不要求每个改动都从 proposal/design/tasks/spec 文件开始 |
| Claude Code hooks | 在工具调用或生命周期边界确定性执行规则 | PreToolUse、PostToolUse、Stop、Compact 等事件处理器 | 把 hooks 视为可选保险丝；工作流状态仍放在可读的 `.claude/WORKFLOW.md` 中 |
| TodoWrite / 会话 todo | 管理 Claude 当前会话正在做什么 | 当前会话内频繁更新的 checklist | TodoWrite 只负责现场执行；ledger 负责持久里程碑和交接上下文 |

一句话概括：Superpowers 教行为，GSD 编排重型执行，OpenSpec 治理正式变更，hooks 强制事件规则，TodoWrite 跟踪当前会话。`workflow-ledger` 补的是中间那一层：日常 Claude Code 开发里的单文件 OpenSpec-lite 任务记忆。

## 借鉴了哪些思路

`workflow-ledger` 借鉴了 spec-driven 和 skill-driven 工作流，但刻意保持更小：

- 借鉴 OpenSpec 这类 spec-driven 系统：明确 intent、依赖意识和归档式关闭摘要。
- 借鉴 Claude Code skills / Superpowers 风格：把可复用流程写成 skill，按需加载。
- 借鉴 hooks：关键动作可以有硬性保护，但不默认把 hook 变成工作流引擎。

核心设计原则是：

> 强制规则保持短；详细流程放 skill；长期 change state 放一个 ledger 文件。

## 安装

推荐先做全局工具接入：

```bash
npx workflow-ledger setup
```

也可以只配置特定 AI coding 工具：

```bash
npx workflow-ledger setup --tool claude-code
npx workflow-ledger setup --tool codex
npx workflow-ledger setup --tool all
```

`setup` 只安装工具接入，让支持的 agent 能找到它；它不会让 Workflow Ledger 在所有项目里自动生效。

然后在目标项目根目录初始化 ledger。裸 `init` 会先交互式选择语言；自动化脚本可传 `--lang en` 或 `--lang zh-CN` 跳过交互：

```bash
npx workflow-ledger init
npx workflow-ledger init --lang zh-CN
npx workflow-ledger init --tool claude-code --lang zh-CN
npx workflow-ledger init --tool codex --lang zh-CN
npx workflow-ledger init --tool all --lang zh-CN
```

`init` 是启用步骤。它创建项目本地 ledger 和短指令片段。没有 `init` 时，本 skill 对普通开发任务保持 dormant。`claude-code` 使用 `.claude/WORKFLOW.md`；`codex` 使用 `.workflow-ledger/WORKFLOW.md` 和 `AGENTS.md`。语言选择会影响新创建的 ledger 模板和工具指令片段；已有文件不会被覆盖。

如果你之前使用 Bash 安装脚本，请迁移到上面的 `npx workflow-ledger init` 流程。

手动项目级安装 Claude Code：

```bash
mkdir -p .claude/skills
cp -R skills/workflow-ledger .claude/skills/workflow-ledger
```

个人全局安装只安装 skill；项目仍然需要 `CLAUDE.md` 片段和 `.claude/WORKFLOW.md`：

```bash
mkdir -p ~/.claude/skills
cp -R skills/workflow-ledger ~/.claude/skills/workflow-ledger
```

CLI 可以检查和汇总 ledger：

```bash
npx workflow-ledger doctor [--json]
npx workflow-ledger list [--json]
npx workflow-ledger next [--json]
```

详见 [docs/cli.md](docs/cli.md)。CLI 是可选保护栏，不替代 skill 工作流。

然后在 Claude Code 中调用：

```text
/workflow-ledger start "implement auth flow"
/workflow-ledger plan "粘贴或引用设计文档，生成结构化 Plan"
/workflow-ledger resume
/workflow-ledger close
```

## 项目接入

项目接入分两层：

1. 先用 `workflow-ledger setup` 做全局工具接入，让支持的 agent 能找到工作流指令。
2. 再用 `workflow-ledger init` 初始化项目，让仓库里有 ledger 文件和短工具提醒。这一步才会让 Workflow Ledger 在该项目生效。

对 Claude Code，`init` 会把 [examples/claude-project/CLAUDE.md.snippet](examples/claude-project/CLAUDE.md.snippet) 加入项目 `CLAUDE.md`，并把 [skills/workflow-ledger/templates/WORKFLOW.md](skills/workflow-ledger/templates/WORKFLOW.md) 创建到 `.claude/WORKFLOW.md`。

对 Codex，`init --tool codex` 会把 [examples/codex-project/AGENTS.md.snippet](examples/codex-project/AGENTS.md.snippet) 加入 `AGENTS.md`，并把 [templates/WORKFLOW.md](templates/WORKFLOW.md) 创建到 `.workflow-ledger/WORKFLOW.md`。

## 台账结构示例

一个被跟踪的任务大致长这样：

```markdown
### WF-2026-05-16-001 — Add streaming usage accounting
Status: In Progress
Level: 2
Current phase: Implement conversion fix

Intent:
- Stabilize streaming usage accounting without expanding the ledger into a transcript.

Plan:
- [done] P1 — Update converter.
- [doing] P2 — Add regression test.
- [deferred] P3 — Add dashboard polish. Deferred: outside this fix.

Current todo:
- [ ] P2 — Add regression test.

Changes:
- 2026-05-16 — Current implementation path narrowed to the provider conversion code.

Prerequisites:
- Existing streaming usage tests must be checked before editing.

Resume next:
- Update the converter and add the smallest regression test.
```

## 任务分级

| Level | 适用场景 | 是否写 ledger |
|---|---|---|
| Level 0 | 问答、只读解释、新增 tag 或发布版本 | 不需要 |
| Level 1 | typo、文档小改、小配置、无行为变化 | 可选 |
| Level 2 | 标准代码修改、测试、单模块行为变更 | 需要 |
| Level 3 | 新功能、跨模块、公共 API、不明确或高风险变更 | 需要，可选附件 |

## 设计原则

- 总览文件必须一眼有用。
- 有设计文档或长期任务时，Level 2/3 工作应先规划。
- 通过修改 `Plan` 条目状态保留 todo 历史，而不是删除旧条目。
- 保持 Active intent 小而明确。
- 将 `Current todo` 作为当前执行焦点，而不是完整历史计划。
- 每完成一个 Plan item 后，更新 ledger、总结本步、提交改动，并询问是否继续。
- 新增前置依赖或未来任务时记录原因。
- 不为了流程而流程。
- 优先一个持久 ledger，而不是散落的过程文件。

## 什么时候使用

适合：

- 多步骤实现
- 可能跨会话的任务
- 需要保留 review 历史的任务
- 有依赖的 debug / refactor
- 任何需要知道“已完成什么、还剩什么”的任务

不适合：

- 纯问答
- 一步完成的小修改
- 临时探索
- 用户明确说不用跟踪的任务

## 当前状态

当前版本以 Node.js CLI 作为 setup、init、doctor、list、next 和 hooks 的唯一实现。Bash 安装器保留为 Claude Code 项目初始化的轻量 bootstrap wrapper。
