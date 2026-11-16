## MODIFIED Requirements

### Requirement: Nesting in the app
The app SHALL show a session's subagents inside its card in the session list, on the card's state line, as state icons: at most three, running first and then the most recently updated, each drawn with its state's symbol and color (see "Subagent outcome and badges"), followed by "+N" for the others and, when some of those others run, "(M running)" counting only the hidden ones. The list MUST NOT draw subagent lines between cards. The icons SHALL be one button, announced with the number of subagents and the count per state, that opens the Subagents sheet over the list. A workflow run's agents are subagents of the session and SHALL show like any other; the workflow card stays in the conversation. The session screen MUST NOT show a strip of subagents; instead, when the session has subagents, the More options menu SHALL offer **Subagents (N)**, or **Subagents (N · M running)** while any runs, and the menu button SHALL show an accent dot while any subagent runs. Selecting the item SHALL open a sheet listing the subagents sorted running first, each row with its label, a state pill, the elapsed time (live while running, the total once done, omitted when the start is unknown) and the tool count when above zero; tapping a row SHALL open that subagent's conversation.

#### Scenario: List
- **WHEN** the session has two running subagents
- **THEN** its card shows two running icons on the state line and nothing is drawn between it and the next card

#### Scenario: More subagents than icons
- **WHEN** a session has six subagents, five of them running
- **THEN** the card shows three running icons and "+3 (2 running)"

#### Scenario: Open from the list
- **WHEN** the user taps the subagent icons of a card
- **THEN** the Subagents sheet opens over the list, and tapping a row opens that subagent's conversation

#### Scenario: Menu and sheet
- **WHEN** a session has five subagents, two of them running
- **THEN** the More options menu reads "Subagents (5 · 2 running)", the menu button has an accent dot, and selecting it opens the sheet with the running ones first

#### Scenario: No subagents
- **WHEN** a session has no subagents
- **THEN** the card shows no icons, the menu has no Subagents item and the button shows no dot

### Requirement: Subagent outcome and badges
A subagent that ended SHALL carry `outcome: "failed"` when the parent's `Agent`/`Task` tool result for it is an error, or its background task notification has status `failed`, and `outcome: "stopped"` when that status is `killed` or `cancelled`. The daemon SHALL look for it in the tail of the parent transcript after `SubagentStop`, more than once, because the result is written after the subagent stops. `state` SHALL stay `running` or `done`. The app SHALL show the state with text and a symbol, in theme colors that work in every theme:
- running: accent, with a dot;
- "✓ done": success;
- "× failed": danger;
- "■ stopped": warning.

The badges SHALL appear in the Subagents sheet and the tablet inspector. The session list SHALL show the same states as icons in the same colors (a progress circle, a check, an × and a square, each in a circle), with the state in their accessible label. All labels MUST be translated.

#### Scenario: Failed subagent
- **WHEN** the parent's tool result for a subagent is an error
- **THEN** the subagent ends with `outcome: "failed"` and the app shows the red "× failed" badge

#### Scenario: Killed background subagent
- **WHEN** the task notification of a background subagent reports `<status>killed</status>`
- **THEN** the app shows the amber "■ stopped" badge

#### Scenario: States in the list
- **WHEN** a session has a running, a done and a failed subagent
- **THEN** its card shows an accent progress circle, a green check and a red ×, announced as "3 subagents: 1 running, 1 done, 1 failed"
