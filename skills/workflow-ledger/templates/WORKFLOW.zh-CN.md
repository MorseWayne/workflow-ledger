# Workflow Ledger

Claude Code 开发工作的轻量级可恢复台账。

## Active

<!-- workflow-ledger:task
id: WF-YYYY-MM-DD-001
level: 2
status: In Progress
current_phase: 当前焦点
updated: YYYY-MM-DD
-->

### WF-YYYY-MM-DD-001 — 任务标题
Status: In Progress
Level: 2
Started: YYYY-MM-DD
Last updated: YYYY-MM-DD
Current phase: 当前焦点

Intent:
- 一个用户可见的目标或变更意图。

Current todo:
- [ ] 可随发现调整的下一步事项。

Changes:
- 记录会影响恢复上下文的范围、待办、前置条件或阻塞变化。

Prerequisites:
- 继续当前工作前必须满足的条件，或 None。

Resume next:
- 一个具体的下一步动作。

## Backlog / Future

- [ ] 当前任务范围外发现的未来事项 — 因为不阻塞当前意图而延后。

## Completed

### WF-YYYY-MM-DD-000 — 已完成任务标题
Completed: YYYY-MM-DD
Level: 1

Close summary:
- Outcome: 用户可见结果。
- Validation: 已执行的检查。
- Gaps: 剩余后续事项或 none。
