## MODIFIED Requirements

### Requirement: Tolerant normalization
The daemon SHALL convert each transcript line into zero or more normalized entries (`user`, `assistant_text`, `thinking`, `tool_use`, `tool_result`, `system`, `unknown`). Invalid lines or lines of an unknown type MUST NOT interrupt reading. User entries that Claude Code writes as XML-like tags MUST NOT become `user` entries: each `<task-notification>` SHALL become a `system` entry with subtype `task_notification`, the summary as text, its `status`, its optional `note`, the `<tool-use-id>` as `toolUseId` when present and the `<result>` as `result` cut at 4,000 characters when present, without the task id, output file or usage; `<bash-input>` SHALL become a `bash_input` system entry with the command, and `<bash-stdout>`/`<bash-stderr>` a `bash_output` system entry with both outputs (none when both are empty); any other entry made only of tag blocks SHALL become a `tagged` system entry with the first tag name in `tag` and the raw text. The `(no content)` placeholder Claude Code writes for an empty command output or an empty assistant reply MUST NOT become an entry.

A `tool_use` of Claude Code's `Workflow` tool SHALL carry `workflow` with what the run declares: `name` (the script's `meta.name`, else the saved workflow's name, else `null`), `description` (`meta.description`, else `null`) and `phases` (`meta.phases` as `{ title, detail }`, empty when none), read from the script's `export const meta` literal without executing it; a malformed or absent `meta` MUST yield nulls and an empty list, never an error. The `tool_result` that launches a run ("Workflow launched in background…") SHALL carry `workflow` with `taskId` (the background task id), `runId` (the last segment of the transcript directory, `wf_…`) and `summary`, each `null` when the text does not name it. Other tools' entries MUST NOT carry `workflow`.

#### Scenario: Corrupted line
- **WHEN** a `.jsonl` line is not valid JSON
- **THEN** it is ignored and the following lines keep being streamed

#### Scenario: Internal types
- **WHEN** the line is `file-history-snapshot`, `atis-latch` or `queue-operation`
- **THEN** no entry is sent to the app

#### Scenario: Empty thinking
- **WHEN** a `thinking` block comes without text
- **THEN** no entry is sent for it

#### Scenario: Task notification
- **WHEN** a user entry is a `<task-notification>` with status `stopped`, a summary, a note, a tool use id, a result and an output file path
- **THEN** a `system` entry with subtype `task_notification`, status `stopped`, the summary, the note, `toolUseId` and the result is sent, and the output file path and the task id are not

#### Scenario: Shell command
- **WHEN** the user runs `! git status` in Claude Code
- **THEN** a `bash_input` entry with `git status` and a `bash_output` entry with its output are sent instead of user entries

#### Scenario: Unknown tag
- **WHEN** a user entry is only `<new-thing>…</new-thing>`
- **THEN** a `tagged` system entry with tag `new-thing` is sent, not a `user` entry

#### Scenario: Empty command output
- **WHEN** the user runs `/exit` and Claude Code records the command output as `(no content)`
- **THEN** only the `/exit` command entry is sent, without a `(no content)` line

#### Scenario: Workflow call with a script
- **WHEN** an assistant line calls `Workflow` with a script whose `meta` is `{ name: 'review-changes', description: 'Review the diff', phases: [{ title: 'Review' }, { title: 'Verify', detail: 'one agent per finding' }] }`
- **THEN** the `tool_use` entry carries `workflow` with that name, description and the two phases (the first with `detail: null`)

#### Scenario: Workflow call by file
- **WHEN** an assistant line calls `Workflow` with only `scriptPath` and `args`
- **THEN** the `tool_use` entry carries `workflow` with `name: null`, `description: null` and no phases

#### Scenario: Workflow launch
- **WHEN** the result of that call reads "Workflow launched in background. Task ID: w1\nSummary: Review the diff\nTranscript dir: /home/u/.claude/projects/p/s/subagents/workflows/wf_1234abcd-9ef\nScript file: …"
- **THEN** the `tool_result` entry carries `workflow` with `taskId: "w1"`, `runId: "wf_1234abcd-9ef"` and `summary: "Review the diff"`

#### Scenario: Ordinary tool
- **WHEN** an assistant line calls `Bash` and its result arrives
- **THEN** neither entry carries a `workflow` field
