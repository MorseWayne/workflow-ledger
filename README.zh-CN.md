# workflow-ledger

面向 Claude Code 的轻量级工作流记忆层。

`workflow-ledger` 让 Claude Code 项目在开发过程中保持**可跟踪、可恢复、可验收**，但不强迫每个任务都进入沉重的 spec 流程。

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

- 一个地方看当前任务
- 阶段化任务，而不是平铺 checklist
- 清楚的验收和 review 摘要
- 能看到依赖和延期任务
- 中断后能恢复
- 只有复杂任务才创建附件

`workflow-ledger` 保留这些关键能力，同时避免制造大量文件。

## 它提供什么

- **单文件总览**：`.claude/WORKFLOW.md` 是任务状态源。
- **任务分级**：Level 0-3，让简单任务保持轻量，复杂任务更安全。
- **阶段任务树**：任务按 Phase 和子任务组织，不是一长串平铺列表。
- **验收紧跟任务**：每个完成阶段后面直接记录 Review、Validation、Tests、Gaps 等总结。
- **可恢复点**：每个活跃任务都有 `Current phase` 和 `Resume next`。
- **依赖管理**：阻塞项变成 dependencies，非阻塞发现进入 Backlog/Future。
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
| Superpowers 风格 skills | 用可复用 skill 和 checklist 教 Claude 按固定方式工作 | skill 包、详细流程、设计/计划循环、明确的人类批准门 | 采用同样的 skill-native 交付方式，但范围更窄：只解决任务记忆、阶段状态、恢复点和 review 摘要 |
| GSD 风格规划工作流 | 把大型工作拆成调研、计划、执行、验证、安全/UI/eval review 等阶段 | 多 agent 规划与执行、阶段文档、review 报告、更强流程门禁 | 借鉴可恢复和分阶段思路，但把日常任务的仪式感降到最低；重型 review 产物只作为 Level 3 可选附件 |
| OpenSpec 风格 spec 工作流 | 用 proposal、spec、tasks 和归档历史治理产品/API 变化 | 正式 proposal/design/task 文件和 spec 生命周期 | 借鉴阶段和验收意识，但不要求每个改动都从 proposal 目录开始 |
| Claude Code hooks | 在工具调用或生命周期边界确定性执行规则 | PreToolUse、PostToolUse、Stop、Compact 等事件处理器 | 把 hooks 视为可选保险丝；工作流状态仍放在可读的 `.claude/WORKFLOW.md` 中 |
| TodoWrite / 会话 todo | 管理 Claude 当前会话正在做什么 | 当前会话内频繁更新的 checklist | TodoWrite 只负责现场执行；ledger 负责持久里程碑和交接上下文 |

一句话概括：Superpowers 教行为，GSD 编排重型执行，OpenSpec 治理正式变更，hooks 强制事件规则，TodoWrite 跟踪当前会话。`workflow-ledger` 补的是中间那一层：日常 Claude Code 开发里的持久任务记忆。

## 借鉴了哪些思路

`workflow-ledger` 借鉴了 spec-driven 和 skill-driven 工作流，但刻意保持更小：

- 借鉴 OpenSpec 这类 spec-driven 系统：阶段、验收、可恢复状态。
- 借鉴 Claude Code skills / Superpowers 风格：把可复用流程写成 skill，按需加载。
- 借鉴 hooks：关键动作可以有硬性保护，但不默认把 hook 变成工作流引擎。

核心设计原则是：

> 强制规则保持短；详细流程放 skill；长期进度放一个 ledger 文件。

## 安装

在你要接入的项目根目录运行：

```bash
curl -fsSL https://raw.githubusercontent.com/MorseWayne/workflow-ledger/main/install.sh | bash
```

这条命令会安装 skill、在缺失时追加 `CLAUDE.md` 片段，并在缺失时创建 `.claude/WORKFLOW.md`。

如果你已经有本地 `workflow-ledger` checkout，也可以直接运行安装脚本：

```bash
/path/to/workflow-ledger/install.sh /path/to/your/project
```

手动项目级安装：

```bash
mkdir -p .claude/skills
cp -R skills/workflow-ledger .claude/skills/workflow-ledger
```

个人全局安装只安装 skill；项目仍然需要 `CLAUDE.md` 片段和 `.claude/WORKFLOW.md`：

```bash
mkdir -p ~/.claude/skills
cp -R skills/workflow-ledger ~/.claude/skills/workflow-ledger
```

然后在 Claude Code 中调用：

```text
/workflow-ledger start "implement auth flow"
/workflow-ledger resume
/workflow-ledger close
```

## 项目接入

一个项目需要三部分：

1. 把 skill 安装到 `.claude/skills/workflow-ledger`。
2. 把工作流规则片段加入项目 `CLAUDE.md`，让 Claude 始终能看到一段简短强制提醒：什么时候使用 skill 和 ledger。
3. 从模板创建 `.claude/WORKFLOW.md`。

把 [examples/claude-project/CLAUDE.md.snippet](examples/claude-project/CLAUDE.md.snippet) 加到项目的 `CLAUDE.md`：

```bash
cat examples/claude-project/CLAUDE.md.snippet >> CLAUDE.md
```

从模板创建项目台账：

```bash
mkdir -p .claude
cp skills/workflow-ledger/templates/WORKFLOW.md .claude/WORKFLOW.md
```

## 台账结构示例

一个被跟踪的任务大致长这样：

```markdown
### WF-2026-05-16-001 — Add streaming usage accounting
Status: In Progress
Level: 2
Current phase: Phase 2 — Implement conversion fix

Phases:

#### Phase 1 — Research current flow
Status: Done
Tasks:
- [x] Trace request flow
- [x] Identify affected symbols

Acceptance / Review:
- Review: Confirmed affected provider path.
- Validation: Read current tests and conversion code.
- GitNexus: Impact analysis showed medium risk.
- Tests: Not run in research phase.
- Gaps: Implementation pending.

#### Phase 2 — Implement conversion fix
Status: In Progress
Tasks:
- [ ] Update converter
- [ ] Add regression test

Resume next:
- Continue with converter update.
```

## 任务分级

| Level | 适用场景 | 是否写 ledger |
|---|---|---|
| Level 0 | 问答、只读解释 | 不需要 |
| Level 1 | typo、文档小改、小配置、无行为变化 | 可选 |
| Level 2 | 标准代码修改、测试、单模块行为变更 | 需要 |
| Level 3 | 新功能、跨模块、公共 API、不明确或高风险变更 | 需要，可选附件 |

## 设计原则

- 总览文件必须一眼有用。
- 只展开当前阶段；未来阶段先保持粗粒度。
- 验收和 review 结果紧贴已完成阶段。
- 新增依赖或未来任务时记录原因。
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

这是一个早期的 skill-first 版本。未来可能增加可选 CLI，但第一版目标是让它能轻松复制到任何 Claude Code 项目中使用。
