## 1. Protocol

- [x] 1.1 `WorkflowPhaseSchema`, `WorkflowCallSchema`, `WorkflowLaunchSchema`; optional `workflow` on `tool_use` / `tool_result`, `toolUseId` / `result` on `system`, `workflowRunId` / `workflowPhase` on `SubagentInfo`; `pnpm --filter @remote-harness/protocol typecheck test` passes

## 2. Daemon

- [x] 2.1 `features/transcript/workflow.ts`: `workflowCall` (meta by text) and `workflowLaunch`; parser decorates `tool_use` / `tool_result` and task notifications (`toolUseId`, cut `result`); fixture `test/fixtures/workflow-run.jsonl` (neutral values) and tests for scripts, files, saved names, malformed meta, launch text, ordinary tools and the notification
- [x] 2.2 Tracker: `agentFile` (plain vs `workflows/<run>/`), watcher depth 2, rescan of run folders, meta file and transcript path per agent folder, `workflowRunId` / `workflowPhase` on the info, kept through `SubagentStop`; tests with a run folder (discovery, phase from meta, transcript path, stop)

## 3. App

- [x] 3.1 `timeline.ts`: `workflow` items from `tool_use` with `workflow`, result and notification attached by `toolUseId` (also when they arrive later), the attached notification not shown as a line; tests
- [x] 3.2 `features/workflows/logic.ts`: status, phase rows, summary parts, agents of a run; tests
- [x] 3.3 `features/workflows/WorkflowCard.tsx` + `ConversationSession` context; `renderItem` renders it; agents open through the agent route
- [x] 3.4 i18n `workflow.*` in pt-BR, en-US and es-ES; parity tests pass

## 4. Verify

- [x] 4.1 `openspec validate 186-workflow-runs --strict`, `turbo run typecheck test`, Biome (worktree workaround), `expo export --platform ios`
