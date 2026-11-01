## Why

Claude Code's multi-agent workflows (the `Workflow` tool, e.g. `ultracode`) run in the background and spawn their agents under `subagents/workflows/<run>/`, a folder the daemon does not watch; the app shows the `Workflow` call as a generic tool card, the run's final notification as a plain system line, and none of its agents (#440). After #439 the session at least stays `running` while the run works, but nothing tells what is running.

## What Changes

- The transcript parser (the only module that knows the `.jsonl`) normalizes the three footprints of a run: the `Workflow` call carries what the script's `meta` declares (`name`, `description`, `phases`); its launch result carries the run id and task id; the task notification that ends it carries the tool call it belongs to and its (cut) result. All as optional fields of the existing `tool_use`, `tool_result` and `system` entries, so older apps keep working.
- The subagent tracker also discovers agents under `subagents/workflows/<run>/`, labels them with the run id and the phase their meta file names, serves their transcripts, and keeps handling their `SubagentStop`.
- The app renders a **workflow card** in place of the tool card: name and description, status (starting, running, done, failed, stopped), the phases with how many of their agents ran and finished, the run's agents with the subagent badges (tap opens the agent's conversation, like any subagent), and the final summary and result once it ends. The run's own notification no longer shows as a separate line when its card is on screen.
- Labels in pt-BR, en-US and es-ES.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `transcript-stream`: "Tolerant normalization" — workflow fields on `tool_use` / `tool_result`, the task notification's tool use id and result.
- `subagents`: "Subagent discovery", "Subagent transcript" and "Subagent names" — agents of a workflow run (folder, run id, phase).
- `app-conversation`: a new "Workflow runs" requirement (the card).

## Impact

- `packages/protocol` (optional fields on `SubagentInfo` and the transcript entries; no new message, no version bump), `apps/daemon/src/features/transcript` (`workflow.ts` next to the parser, parser hooks, fixtures), `apps/daemon/src/features/subagents/tracker.ts`, `apps/mobile/src/features/conversation/timeline.ts`, a new `apps/mobile/src/features/workflows` feature (pure logic + card), i18n in the three catalogs.
- Backward compatible both ways: older apps ignore the new optional fields and keep the generic tool card; newer apps with older daemons see no `workflow` fields and keep today's rendering.
