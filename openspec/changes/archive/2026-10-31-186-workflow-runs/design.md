## Context

A workflow run leaves three footprints in the session transcript (captured from real runs, Claude Code CLI 2.1.x): the `Workflow` `tool_use`, whose `script` opens with a pure-literal `export const meta = { name, description, phases: [{ title, detail }] }` (or a `scriptPath` / saved `name` without a meta); its `tool_result` "Workflow launched in background. Task ID: <task>\nSummary: <description>\nTranscript dir: …/subagents/workflows/<wf_run>\nScript file: …"; and, when it ends, a `<task-notification>` with `<tool-use-id>`, `<status>`, `<summary>` and `<result>`. The run folder holds `journal.jsonl` (`launched`, `started {agentId, label, phase}`, `result {agentId, result}`) and the agents' `agent-<id>.jsonl` + `agent-<id>.meta.json` (`agentType: "workflow-subagent"`, `description` = the agent's label, `workflowPhase`). The subagent tracker watches `subagents/` at depth 0 and `SubagentStop` fires for these agents too (#439).

## Goals / Non-Goals

- Goals: no `.jsonl` knowledge outside the daemon's transcript feature; wire changes that older apps and daemons tolerate; live progress without a new message type.
- Non-goals: reading `journal.jsonl` (the agents' files and hooks already give start, end and phase), controlling a run (stop, resume), showing the run's script.

## Decisions

- **Optional fields, not new entry kinds.** A new `kind` in the `TranscriptEntry` union would make an older app reject every `transcript.entries` message carrying one. The parser therefore decorates existing entries: `tool_use.workflow` (`WorkflowCall`), `tool_result.workflow` (`WorkflowLaunch`), `system.toolUseId` / `system.result` on task notifications. The app's timeline turns a `tool_use` with `workflow` into a `workflow` item and attaches the matching result and notification by `toolUseId`, the way it already pairs results.
- **Meta by text, never by evaluation.** `workflow.ts` (used by the parser only) finds the `meta` literal by brace matching that skips strings, cuts the `phases` array out before reading `name` / `description`, and reads string literals with any quote. Anything odd yields nulls and an empty list.
- **Agents through the existing tracker.** The watcher depth goes to 2 and `agentFile(dir, path)` tells a plain `agent-*.jsonl` from `workflows/<run>/agent-*.jsonl`; the run id is kept per agent and used for the meta file, the incremental read and `transcriptPath`, and sent as `workflowRunId` with the meta's `workflowPhase`. The run's progress in the app is then `session.subagents` filtered by run id: the same `subagent.updated` flow, badges, elapsed time and tool counts as subagents, and the same route to open one.
- **Result in the notification entry.** The run's final report is in `<result>`; it is kept, cut at 4,000 characters (the tool output limit the app already uses for "Show more"), so the card can show it. Task id, output file and usage stay out as before.
- **Card owns its agents.** `WorkflowCard` reads the session's subagents from the sessions store through a `ConversationSession` context (the session id), so the FlashList item type carries only entries; the pure `features/workflows/logic.ts` computes status, phase rows and the summary line and is unit-tested.

## Risks / Trade-offs

- [Claude Code changes the launch text or the meta shape] → Everything degrades to today's rendering (plain tool card, plain notification); fixtures pin the current shapes.
- [A run spawns agents before the app learned the run id (launch result not yet written)] → The agents show in the Subagents sheet at once and in the card as soon as the result arrives (same render pass).
- [Phase titles in meta files differ from `meta.phases` titles] → Undeclared phases get rows of their own, so no agent is hidden.

## Migration Plan

Ships over the air (app) and with the next daemon release; no stored data changes. Mixed versions keep working as described in the proposal.
