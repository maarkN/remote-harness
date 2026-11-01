## MODIFIED Requirements

### Requirement: Subagent discovery
The daemon SHALL list the subagents of each session with `agentId`, `agentType`, `description`, `state` (`running` or `done`), `updatedAt`, `startedAt` (when the subagent was first seen: the transcript file's creation time when known, otherwise the discovery time; `null` when unknown) and `toolCount` (the tool uses in its transcript so far), based on the subagent transcript files and the `SubagentStop` hook, sending `subagent.updated` on every change. The tool count SHALL be kept incrementally, reading only what was appended to the transcript since the last change, and the transcript format MUST stay inside the transcript parser. Agents of a workflow run, whose transcripts live under `subagents/workflows/<run>/` instead of the subagents folder itself, SHALL be discovered the same way and carry `workflowRunId` (the run folder's name) and `workflowPhase` (the phase their meta file names, when it does); subagents outside a run MUST NOT carry either.

#### Scenario: Subagent started
- **WHEN** a new `agent-*.jsonl` appears in the session's subagents folder
- **THEN** clients receive `subagent.updated` with `state: "running"`, a `startedAt` and `toolCount: 0`

#### Scenario: Subagent finished
- **WHEN** `SubagentStop` arrives for the agent
- **THEN** clients receive `subagent.updated` with `state: "done"`, keeping `startedAt` and the final `toolCount`

#### Scenario: Tool uses counted
- **WHEN** the subagent transcript grows by lines that carry two tool uses
- **THEN** `toolCount` grows by 2 without the daemon reading the earlier lines again

#### Scenario: Agent of a workflow run
- **WHEN** `subagents/workflows/wf_12/agent-a1.jsonl` appears with a meta file naming `workflowPhase: "Review"`
- **THEN** clients receive `subagent.updated` for `a1` with `state: "running"`, `workflowRunId: "wf_12"` and `workflowPhase: "Review"`, and a later `SubagentStop` for `a1` keeps both

### Requirement: Subagent transcript
`session.subscribe` with `agentId` SHALL stream the subagent transcript with the same rules as the main transcript, for agents of a workflow run too (their file under the run folder).

#### Scenario: Open a subagent
- **WHEN** the user taps a subagent
- **THEN** they see the subagent conversation in read-only mode

#### Scenario: Open an agent of a workflow run
- **WHEN** the user taps an agent listed under a workflow card
- **THEN** they see that agent's conversation, read from `subagents/workflows/<run>/agent-<id>.jsonl`

### Requirement: Subagent names
The daemon SHALL send `description` and `agentType` only as trimmed, non-empty strings (else `null`). While either is missing, or the agent belongs to a workflow run whose phase is not known yet, it SHALL read the subagent's meta file (next to its transcript) again on later activity. Without a description, it SHALL use the first line of the subagent's prompt (the first user message of its transcript), cut at 80 characters. The app SHALL label a subagent with the first trimmed, non-empty value of: description, agent type, "Subagent #N" (its position by start time in the session), and MUST NOT show an empty label. With a description, the agent type SHALL be shown on the row's secondary line.

#### Scenario: Meta file written late
- **WHEN** a subagent's transcript appears before its meta file, and the meta file is written later with the description "Review the diff"
- **THEN** the subagent's label becomes "Review the diff" on its next activity

#### Scenario: No description anywhere
- **WHEN** a subagent has no meta file and an empty prompt
- **THEN** the app labels it "Subagent #2" when it was the second one to start
