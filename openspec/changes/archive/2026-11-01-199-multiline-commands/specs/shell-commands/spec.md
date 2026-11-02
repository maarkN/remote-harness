## MODIFIED Requirements

### Requirement: Run command sheet
The session's More options menu SHALL offer "Run command…" when the daemon's `auth.ok` has `commands`. It SHALL open a sheet with a monospaced, multi-line command field (no autocorrect or capitalization) and the session's folder: Return inserts a line break, the Run button (and Command+Return with a hardware keyboard) runs, and a pasted block keeps its lines. Several lines SHALL run in order and stop at the first one that fails (the app sends them under `set -e`), which the sheet says under the field; a script over the command size limit SHALL not be runnable, with the reason shown. Running SHALL ask for confirmation every time, showing every line of the command and the folder. The output SHALL stream into a scrollable, selectable, monospaced panel, headed by `$ <line>` for each line of the command, that stays at the end while new output arrives, with the state (running with elapsed time, exit code, cancelled, timed out, output limit reached, failed to start), Cancel while running, Copy output and "Add to prompt", which appends the command (every line, each after `$ `) and its output as a fenced code block to the session's composer draft without sending it. Closing the sheet cancels a running command. When `commands.enabled` is false the sheet SHALL say that commands are off on the computer and show the command that turns them on. Texts SHALL be translated (en-US, pt-BR, es-ES).

#### Scenario: Confirm before running
- **WHEN** the user types `pnpm test` and taps Run
- **THEN** an alert asks to run `pnpm test` in the session's folder, and nothing runs until the user confirms

#### Scenario: Several lines
- **WHEN** the user pastes `cd app`, `yarn install` and `yarn dev` on three lines and taps Run
- **THEN** the alert shows the three lines, the daemon receives them under `set -e` so a failing `yarn install` stops `yarn dev`, and the panel starts with `$ cd app`, `$ yarn install`, `$ yarn dev`

#### Scenario: Add to prompt
- **WHEN** a command finished and the user taps "Add to prompt"
- **THEN** the session's draft gains a fenced block with `$ <command>` (one `$` line per command line), its output and the exit status, the sheet closes and nothing is sent yet

#### Scenario: Commands off
- **WHEN** the daemon reports `commands.enabled: false`
- **THEN** the sheet shows that commands are off and `remote-harness commands on`, with no Run button
