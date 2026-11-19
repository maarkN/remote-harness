# launchers Specification

## Purpose
Provides commands that start Claude Code inside tmux, with the correct profile, so the session can be controlled from the phone.

## Requirements

### Requirement: Open session in tmux
The launcher SHALL create (if it does not exist) the tmux session `remote-harness` (`tmuxSession` in `config.json`) on the Remote Harness tmux server (see "Dedicated tmux server") and open in it a new window named `<profile>:<directory>` running `claude` with the profile's `CLAUDE_CONFIG_DIR` and `REMOTE_HARNESS_PROFILE` set (`CLAUDE_REMOTE_PROFILE` too, for the hooks of sessions installed before the rename), forwarding all arguments received. The window's command SHALL itself change to the directory the launcher ran in before starting the agent (`cd -- <dir> && exec …`), in addition to tmux's `-c <dir>`, so the agent starts in that directory even when the tmux server's own working directory no longer exists (tmux then ignores `-c`). When the launcher creates the session, it SHALL run that tmux command from the home folder (`/` when the home folder is not reachable), so a tmux server it starts never keeps a project folder as its working directory. The terminal SHALL show the window through a view session of its own that holds only that window: the window is linked into the view from the launchers' session, and the view is not grouped with it, so no other window of the launchers' session can show in that terminal. The view SHALL be destroyed when its last client goes away (`destroy-unattached`) and when its window closes, and either way the window SHALL keep running in the launchers' session until the agent exits. Outside tmux the terminal SHALL attach to the view, and when the window closes (the agent exits) the client SHALL detach, returning the terminal to its shell. Inside tmux, the launcher MUST NOT take over a client of another tmux server: when the current client belongs to the Remote Harness server it SHALL switch that client to the view, and when the window closes that client SHALL return to the session it was on instead of detaching; otherwise it SHALL attach the view nested in the current pane, with the view's status line off, leaving the user's server, sessions and client untouched, and the nested client SHALL detach when the window closes. For a profile with a provider, the launcher SHALL export the provider's `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` and `ANTHROPIC_SMALL_FAST_MODEL` (those configured), unset `ANTHROPIC_API_KEY` in the window, and read the provider key from the OS secret store (the `0600` file when present, else the macOS Keychain, else the Secret Service) only inside the new window, exporting it as `ANTHROPIC_AUTH_TOKEN`; the key MUST NOT appear on any command line nor in the launcher file. When no key is stored, the launcher MUST fail before creating the window with a message naming `remote-harness provider key <profile>`.

#### Scenario: Outside tmux
- **WHEN** the user runs `claudin --resume` in a terminal outside tmux
- **THEN** a window is created in the `remote-harness` session of the Remote Harness server with `claude --resume` and the terminal attaches to it

#### Scenario: Inside tmux
- **WHEN** the user runs `drclaude` in a pane of their own tmux server (their `tmux.conf`, their sessions)
- **THEN** the window is created in the `remote-harness` session of the Remote Harness server and shows nested in that pane, without a second status line; the user's client, sessions and windows are not changed, and detaching returns to their shell prompt

#### Scenario: Inside the Remote Harness server
- **WHEN** the user runs `drclaude` in a pane of a terminal attached to the Remote Harness server
- **THEN** the window is created and that client switches to it; when the agent exits, the client returns to the session it was on

#### Scenario: OpenRouter profile
- **WHEN** the user runs the launcher of a profile with provider `openrouter` and a stored key
- **THEN** the window runs `claude` with `ANTHROPIC_BASE_URL` set to the gateway, `ANTHROPIC_AUTH_TOKEN` read inside the window and `ANTHROPIC_API_KEY` unset, and `ps` never shows the key

#### Scenario: Missing key
- **WHEN** the user runs the launcher of a profile with a provider and no key is stored
- **THEN** no window is created and the message points to `remote-harness provider key <profile>`

#### Scenario: Server started in a folder that was deleted
- **WHEN** the Remote Harness tmux server was started from `~/workspaces/old-app`, that folder was deleted, and the launcher runs in `~/workspaces/api`
- **THEN** the new window's agent runs in `~/workspaces/api` instead of exiting with "The current directory no longer exists"

#### Scenario: New server starts from the home folder
- **WHEN** no launchers' session exists and the user runs `drclaude` in `~/workspaces/api`
- **THEN** the session is created from the home folder, so a tmux server started by it has the home folder as its working directory, and its first window still runs in `~/workspaces/api`

#### Scenario: Exiting one of several sessions
- **WHEN** the user has three sessions open from launchers, each in its own terminal, and exits one of them with `/exit` or Ctrl+C twice
- **THEN** that terminal is back at its shell prompt, no other session shows in it, and the other two keep running

#### Scenario: Detaching or closing the terminal
- **WHEN** the user detaches from a launcher's terminal (`Ctrl-b d`) or closes the terminal tab
- **THEN** the session keeps running in the launchers' session and the app, the tray and `remote-harness tmux` still reach it

### Requirement: Plain claude untouched
The installation MUST NOT change the `claude` command.

#### Scenario: claude outside the launcher
- **WHEN** the user runs `claude` directly
- **THEN** the session opens normally outside tmux

### Requirement: Dedicated tmux server
The launchers, the daemon, "Open in terminal (tmux)" and the demo SHALL address a tmux server of their own, named by `tmuxSocket` (`tmux -L <name>`, default `remote-harness`), started with the generated config `~/.remote-harness/tmux.conf` (`tmux -f`) instead of the user's `tmux.conf`. `install`, `setup`, `update` and the daemon at start SHALL write that config from `config.json`: with `tmuxConfig` `minimal` (default) it holds only Remote Harness's own settings (Esc delivered at once, focus events, a larger history); with `user` it additionally sources the user's `~/.tmux.conf` and `~/.config/tmux/tmux.conf` when they exist, so their settings win. With `tmuxSocket` `null` everything SHALL use the user's default server and config, as before this requirement. The user's `tmux.conf` MUST NOT affect the Remote Harness server unless `tmuxConfig` is `user`, and the Remote Harness sessions MUST NOT appear in the user's own `tmux ls`. `remote-harness tmux [args…]` SHALL run `tmux` against the Remote Harness server with the given arguments, and with none SHALL attach to the launchers' session. When `install` finds the launchers' session still on the user's default server (sessions started before this requirement), it SHALL say that those sessions are no longer managed and how to attach to them.

#### Scenario: User's tmux.conf
- **WHEN** the user's `~/.tmux.conf` sets `destroy-unattached on` and a custom prefix, and `tmuxConfig` is `minimal`
- **THEN** the Remote Harness session survives the launcher detaching and keeps tmux's default prefix

#### Scenario: Own settings on top
- **WHEN** `tmuxConfig` is `user` and the user's `~/.tmux.conf` sets `mouse on`
- **THEN** the Remote Harness server has `mouse on` and still delivers Esc at once

#### Scenario: Attaching by hand
- **WHEN** the user runs `remote-harness tmux` in a terminal
- **THEN** the terminal attaches to the `remote-harness` session of the Remote Harness server; `remote-harness tmux ls` lists only that server's sessions

#### Scenario: Default server by choice
- **WHEN** `config.json` has `"tmuxSocket": null`
- **THEN** the launchers and the daemon use the user's default tmux server and `tmux.conf`, and no `tmux.conf` is generated

#### Scenario: Sessions from before the upgrade
- **WHEN** `remote-harness update` finishes while a `remote-harness` or `claude-remote` session exists on the user's default server
- **THEN** the install output says those sessions are no longer managed and names `tmux attach -t <that session>` to reach them

### Requirement: Profile picker
When `profilePicker` is `true` in `config.json` (default `false`), `install`, `setup` and `update` SHALL write a `rhnss` command next to the launchers (`~/.remote-harness/bin/rhnss`), rewritten together with them, so it always lists the current profiles. The script SHALL be the same zsh as the launchers, executable and generated (it says not to edit it).

Run without arguments, it SHALL:
- list the profiles as numbered rows of agent name, profile name and config folder (`~` for the home folder), in aligned columns;
- ask for a number, and also accept a profile's alias as the answer;
- `exec` that profile's launcher with every argument it got, in the current folder, so the session starts exactly as with the launcher.

An answer that matches no profile SHALL ask again; an empty answer or end of input SHALL exit without starting anything. `rhnss <alias> [args…]` SHALL start that profile without asking, and with a single profile `rhnss` SHALL start it directly. The texts SHALL be in the language of `config.json` when the script is written. With `profilePicker` off, `install`, `setup` and `update` SHALL remove a picker written before, and `uninstall` SHALL remove it as well.

#### Scenario: Picking a profile
- **WHEN** `profilePicker` is on, the profiles are `work` (Claude Code, `~/.claude-work`), `personal` (Claude Code, `~/.claude`) and `cx` (Codex, `~/.codex-x`), and the user runs `rhnss --resume abc` in `~/api` and answers `3`
- **THEN** the three rows are shown with aligned columns and the `cx` launcher runs in `~/api` with `--resume abc`

#### Scenario: Profile named on the command line
- **WHEN** the user runs `rhnss work --continue`
- **THEN** the `work` launcher runs with `--continue` and nothing is asked

#### Scenario: Single profile
- **WHEN** only one profile is configured and the user runs `rhnss`
- **THEN** that profile's launcher runs without a question

#### Scenario: Invalid answer
- **WHEN** the user answers `7` with three profiles
- **THEN** the picker says the answer is not in the list and asks again; an empty answer exits without starting a session

#### Scenario: Profile added later
- **WHEN** a profile is added with `remote-harness setup` (or in `config.json` followed by `remote-harness install`)
- **THEN** `rhnss` lists it, without editing anything by hand

#### Scenario: Turned off and uninstalled
- **WHEN** `profilePicker` is set back to `false` and `remote-harness install` runs, or the user runs `remote-harness uninstall`
- **THEN** `~/.remote-harness/bin/rhnss` no longer exists
