## ADDED Requirements

### Requirement: Run from the conversation
While the daemon offers commands and they are on (`auth.ok.commands.enabled`), a long press on the command of a `Bash` tool call card and on a fenced code block whose language is `sh`, `bash`, `zsh` or `shell` SHALL show a menu with **Copy** and **Run on the computer**. Run on the computer SHALL open the Run command sheet with the command filled in — every line of a multi-line command, and without the `$ ` console prompts when every line of the block starts with one — where the user confirms as usual; nothing runs from the menu itself, and a plain tap keeps its current behavior. The same two actions SHALL be reachable as accessibility actions on the card and the block. Without commands on that computer the menu and the actions SHALL be absent. Texts SHALL be translated (en-US, pt-BR, es-ES).

#### Scenario: From a Bash card
- **WHEN** the user presses and holds the card of a `Bash` call that ran `pnpm test` and picks Run on the computer
- **THEN** the Run command sheet opens with `pnpm test` in the field and the usual confirmation follows when they tap Run

#### Scenario: Console block
- **WHEN** an assistant message has a `bash` block reading `$ cd app` and `$ yarn install` and the user picks Run on the computer
- **THEN** the sheet opens with `cd app` and `yarn install` on two lines, without the prompts

#### Scenario: Commands off
- **WHEN** the daemon reports `commands.enabled: false`
- **THEN** a long press on a Bash card or a shell block offers no Run on the computer
