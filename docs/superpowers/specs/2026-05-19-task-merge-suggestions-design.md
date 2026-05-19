# Workflow Ledger Task Merge Suggestions Design

## Goal

Reduce workflow-ledger task fragmentation by teaching the skill to suggest merging strongly related tasks or todo items before creating or preserving separate tracked work.

The rule is intentionally conservative in outcome but broader in recognition: Claude should suggest merging when items belong to the same task family and can be completed and validated in the same iteration. It must never merge automatically.

## Scope

This change covers three pieces:

1. Skill behavior for suggesting task merges during task start and todo updates.
2. User-facing documentation in English and Chinese usage guides.
3. Behavior test coverage for merge suggestion and non-suggestion cases.

It does not add CLI merge detection, change the ledger template structure, or introduce automatic merging.

## Architecture

### Skill merge suggestion rule

Add a `Task merge suggestions` section to `skills/workflow-ledger/SKILL.md`.

The section should define when Claude may ask whether to merge related work. A merge suggestion is appropriate only when all of these are true:

- The items belong to the same task family: same feature, command, API, component, state-branch set, documentation pair, or phase goal.
- The items can be completed in the same iteration without adding unrelated scope.
- The items can be validated in the same test or review batch.
- The merged entry remains a clear user-visible goal and preserves resume clarity.

The rule should explicitly cover batchable sibling todo items, such as multiple status query state tests:

```markdown
- [ ] 6.T3 Write status query offline unit test.
- [ ] 6.T4 Write status query unknown unit test.
- [ ] 6.T5 Write status query not_deployed unit test.
```

Claude should suggest a merge like:

```markdown
- [ ] 6.T3-T5 Write status query state-branch unit tests: offline, unknown, not_deployed.
```

### Trigger points

Wire the rule into existing workflow sections rather than adding a separate process:

1. `Start a tracked task`: before creating a new Active entry, check existing Active and Backlog items. If the new task belongs to the same task family and can be validated with an existing task, ask whether to merge.
2. `Handling changing todos`: when implementation reveals new work, check whether sibling todos, prerequisites, tests, docs, or small fixes form one task family and one validation batch. If so, ask before adding separate todo items or moving them to Backlog.
3. `Update a task`: when rewriting `Current todo`, prefer a compact merged todo item only after the user agrees.

The existing fallback behavior remains unchanged. If the user declines or the conditions are not met, Claude should keep items separate and use the current prerequisite, Backlog, or new-task rules.

### Interaction model

A merge suggestion should be short and explain both the reason and the resulting ledger expression.

Example:

> These todo items are all status query state-branch tests and can be validated in the same test run. Merge them into `6.T3-T5 Write status query state-branch unit tests: offline, unknown, not_deployed`?

The question should appear before modifying the ledger. User approval is required.

### TodoWrite ordering

TodoWrite remains session-local execution tracking. The merge suggestion decision happens before durable ledger updates and before converting sibling discoveries into separate persistent ledger items.

When Claude detects mergeable sibling work during execution:

1. Keep the current session todo focused on resolving the merge decision, such as `Ask whether to merge status query state tests`.
2. Ask the user whether to merge and show the proposed compact ledger item.
3. After the user answers, update TodoWrite to match the chosen execution shape.
4. Update `.claude/WORKFLOW.md` only after user approval if the durable ledger representation changes.

Do not create separate TodoWrite items and then immediately ask to merge them; that creates noisy intermediate state.

### Ledger representation

Use the existing single Active task shape. Do not add new schema fields.

When the user approves a merge:

- Keep one Active task.
- Keep `Intent:` as one user-visible goal.
- Represent merged work as a compact `Current todo:` item, using a range like `6.T3-T5` when existing task labels make that clear.
- Add at most one `Changes:` bullet only if it helps resume, for example: `Merged status query state-branch tests into one validation batch after user approval.`

Do not create a second Active task for merged work.

### Documentation

Update both usage guides:

- `docs/usage.md`
- `docs/usage.zh-CN.md`

The docs should explain the behavior from the user's perspective:

- Workflow Ledger may suggest merging related tasks or todos.
- It only suggests merging when items are in the same task family and share one validation batch.
- It asks before changing the ledger.
- If the user declines, items remain separate.

The documentation should include a concise status-query test example to show how sibling test todos can become one batch item.

## Data and file flow

1. User starts or updates tracked work through the workflow-ledger skill.
2. The skill checks whether related existing or newly discovered items form one task family and one validation batch.
3. If so, Claude asks the user whether to merge and shows the proposed compact todo expression.
4. If approved, Claude updates `.claude/WORKFLOW.md` using the existing Active task fields.
5. If declined, Claude follows the current separate prerequisite, Backlog, or new-task behavior.

No runtime state or CLI data model changes are required.

## Error handling

- Ambiguous relationship: do not suggest merging.
- Different validation commands or review paths: do not suggest merging.
- Merge would obscure resume state: do not suggest merging.
- User declines: preserve separate items and continue normally.
- User approval is unclear: ask a short follow-up rather than modifying the ledger.

## Testing

Update `tests/claude-code/run-skill-behavior-test.sh`. Keep the existing start-task behavior test, and add two additional headless Claude Code prompts against the same temporary project setup or a fresh copied project per case if isolation is clearer.

### Merge suggestion behavior prompt

Use a prompt that makes the expected merge candidate explicit and tells Claude not to ask the human test runner for input. The test should assert the observable ledger outcome.

```text
You are testing the local workflow-ledger skill in this temporary project. Update only .claude/WORKFLOW.md. Start a tracked Level 2 task with this exact goal: "Add status query state unit tests". The work has these sibling todo items: "6.T3 Write status query offline unit test", "6.T4 Write status query unknown unit test", and "6.T5 Write status query not_deployed unit test". Treat this prompt as user approval to merge related same-family todos when the workflow-ledger skill says a merge suggestion is appropriate. Keep the ledger concise and stop after updating it.
```

Assertions:

- The ledger contains one Active task for `Add status query state unit tests`.
- `Current todo:` contains one compact merged item using `6.T3-T5` or an equivalent single batch item.
- The merged item mentions `offline`, `unknown`, and `not_deployed`.
- The ledger does not create separate Active tasks for T3, T4, and T5.

### Non-suggestion behavior prompt

Use a prompt with unrelated work that should remain separate.

```text
You are testing the local workflow-ledger skill in this temporary project. Update only .claude/WORKFLOW.md. Start a tracked Level 2 task with this exact goal: "Improve project maintenance". The discovered work items are: "Update status query offline unit test", "Rewrite README installation section", and "Investigate release publishing credentials". These items have different task families and validation paths. Keep them separate using the workflow-ledger skill rules. Keep the ledger concise and stop after updating it.
```

Assertions:

- The ledger does not collapse the unrelated items into a single ranged todo.
- Different-family non-blocking work is represented separately, either as separate todo items only when appropriate for the active intent or as Backlog / Future items with short deferred reasons.
- The ledger remains under the existing concision limits and passes `workflow-ledger doctor`.

Existing behavior must still pass:

- normal start behavior
- required ledger fields
- concision and transcript-marker checks
- doctor validation

Run:

```bash
npm test
```

## Future work

- Add CLI diagnostics for suspicious task fragmentation only if real usage shows skill-level suggestions are insufficient.
- Add examples for Codex after the Claude Code behavior is stable.
