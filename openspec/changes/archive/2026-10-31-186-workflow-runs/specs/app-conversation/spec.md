## ADDED Requirements

### Requirement: Workflow runs
A `Workflow` tool call SHALL be shown as a **workflow card** instead of the tool card: a header with the run's name (else "Workflow"), a status badge and a chevron; collapsed, one line with the number of phases, the number of agents and how many run; expanded, the description, the phases in the script's order (each with a state glyph and `done/total` agents; agents in a phase the script did not declare get a row of their own), the run's agents as the same rows as the Subagents sheet (label, state badge, elapsed time, tool count; tapping one opens its conversation) and, once the run ended, its summary and result text. The status SHALL be `starting` until the launch result arrives, `running` after it, and from the run's task notification `done` (`completed`), `failed` (`failed`) or `stopped` (anything else), with the badge tones of the subagent states. The run's agents are the session's subagents whose `workflowRunId` is the run id of the launch result, so the card updates live as `subagent.updated` arrives. The task notification whose `toolUseId` matches a workflow card on screen MUST NOT also be shown as a separate line; one whose card is not loaded SHALL keep showing as today. A `Workflow` call from an older daemon (no `workflow` field) SHALL keep the tool card. All texts MUST be translated (pt-BR, en-US, es-ES).

#### Scenario: Run in progress
- **WHEN** a `Workflow` call named "review-changes" with phases Review and Verify was launched as run `wf_12`, and the session has three subagents with `workflowRunId: "wf_12"`, two in phase Review (one done, one running) and one in Verify (running)
- **THEN** the card reads "review-changes", badge `running`, "2 phases · 3 agents · 2 running"; expanded, Review shows 1/2 and Verify 0/1, and the three agents are listed with their badges

#### Scenario: Run finished
- **WHEN** the task notification for that call arrives with status `completed`, the summary and a result
- **THEN** the card's badge turns `✓ done`, the summary and the result are shown in the card, and no separate task notification line is added

#### Scenario: Open an agent
- **WHEN** the user taps an agent row in the card
- **THEN** that agent's read-only conversation opens, as from the Subagents sheet

#### Scenario: Script by file
- **WHEN** a `Workflow` call only points at a script file and its launch result names the run
- **THEN** the card is titled "Workflow", shows the launch summary as its description and lists the agents' phases as they appear

#### Scenario: Older daemon
- **WHEN** the daemon sends a `Workflow` tool call without a `workflow` field
- **THEN** the conversation shows the ordinary tool card for it
