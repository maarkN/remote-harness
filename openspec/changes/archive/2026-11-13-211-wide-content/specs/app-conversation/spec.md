## MODIFIED Requirements

### Requirement: Entry rendering
The screen SHALL show user messages, assistant text in markdown, collapsed thinking, collapsible tool calls with a one-line summary, and results; tool errors MUST appear in red. The assistant's leading dot SHALL take the session agent's color (Claude Code's until the protocol carries the agent); user messages keep the accent `>`. Markdown tables SHALL size each column from its content (between a minimum and a maximum width, longer cells wrapping inside their column) so a short table fits the screen; content that is still wider than the screen (a long table, a code block) SHALL scroll sideways and show that it does, with a fade at the right edge while more lies beyond it and the scroll indicator flashed when it first overflows.

#### Scenario: Tool call
- **WHEN** a `tool_use` entry for `Bash` arrives with `command` "pnpm test"
- **THEN** a collapsed "Bash(pnpm test)" line appears that expands to show the result

#### Scenario: Short table on a small phone
- **WHEN** an assistant message has the table `| Screen | Before | After |` with two short rows, on an iPhone SE
- **THEN** all three columns are visible without scrolling

#### Scenario: Wide table
- **WHEN** a table's columns together are wider than the screen
- **THEN** it scrolls sideways, a fade at its right edge shows there is more, and the fade goes away once scrolled to the end

#### Scenario: Unknown entry
- **WHEN** an `unknown` entry arrives
- **THEN** a subtle block appears with the raw JSON collapsed

#### Scenario: Agent color
- **WHEN** an assistant message of a Claude Code session is shown
- **THEN** its leading dot is in the Claude Code color while the user prompt marker stays in the accent

### Requirement: Tool call details
An expanded tool call SHALL show its details in three tabs: **Output** (the diff for `Edit`, `MultiEdit` and `Write`, then the tool result, or a running indicator while there is none), **Input** (the tool input as labeled fields formatted per tool, with the top-level keys as fallback for unknown tools) and **JSON** (the raw tool name, input and result). A result with no matching tool call MUST show only Output and JSON. The app MUST remember the last tab chosen per tool type, with every MCP tool counted as one type, across app restarts; a tool type never chosen MUST open on Output. Output that is prose (subagent results, fetched pages, web searches, MCP and other tool results) SHALL wrap to the card's width; output whose columns matter (shell commands, searches, file contents, file lists, patches) and the JSON tab SHALL keep their lines and scroll sideways, showing that they do as the conversation's wide content does. Outputs and JSON longer than 4,000 characters MUST be cut with a "Show more" control that reveals the full text. Texts in the tabs MUST be selectable. Tab names and field labels SHALL be translated (pt-BR, en-US, es-ES).

#### Scenario: Bash call
- **WHEN** the user expands a `Bash` call with `command` "pnpm test" that has finished
- **THEN** the Output tab is selected and shows the command output, and the Input tab shows a "Command" field with "pnpm test"

#### Scenario: Prose output wraps
- **WHEN** the user expands a finished `Task` or `WebFetch` call whose result has lines longer than the card
- **THEN** the Output tab wraps them to the card's width, with no sideways scroll

#### Scenario: Command output keeps its columns
- **WHEN** the user expands a `Bash` or `Grep` call whose output has lines longer than the card
- **THEN** the lines are kept whole, scroll sideways, and a fade at the right edge shows there is more

#### Scenario: Read range
- **WHEN** the user opens the Input tab of a `Read` call with `offset` 10 and `limit` 50
- **THEN** it shows the file path and the lines "10–59"

#### Scenario: Remembered tab
- **WHEN** the user picks the JSON tab on a `Grep` call and later expands another `Grep` call, even after restarting the app
- **THEN** the JSON tab opens, while a `Bash` call still opens on Output

#### Scenario: Long output
- **WHEN** a result has more than 4,000 characters
- **THEN** the Output tab shows the first 4,000 and a "Show more" control, and tapping it shows the whole result

#### Scenario: Unknown tool
- **WHEN** the user opens the Input tab of a tool the app does not know
- **THEN** each top-level input key is listed with its value, objects as compact JSON
