# launchers Specification

## Purpose
Provides commands that start Claude Code inside tmux, with the correct profile, so the session can be controlled from the phone.

## Requirements

### Requirement: Open session in tmux
The launcher SHALL create (if it does not exist) the tmux session `claude-remote` on the Remote Harness tmux server (see "Dedicated tmux server") and open in it a new window named `<profile>:<directory>` running `claude` with the profile's `CLAUDE_CONFIG_DIR` and `CLAUDE_REMOTE_PROFILE` set, forwarding all arguments received. Outside tmux the terminal SHALL attach to that window through a grouped view session of its own. Inside tmux, the launcher MUST NOT take over a client of another tmux server: when the current client belongs to the Remote Harness server it SHALL switch that client to the window; otherwise it SHALL attach the view session nested in the current pane, with the view's status line off, leaving the user's server, sessions and client untouched. For a profile with a provider, the launcher SHALL export the provider's `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` and `ANTHROPIC_SMALL_FAST_MODEL` (those configured), unset `ANTHROPIC_API_KEY` in the window, and read the provider key from the OS secret store (the `0600` file when present, else the macOS Keychain, else the Secret Service) only inside the new window, exporting it as `ANTHROPIC_AUTH_TOKEN`; the key MUST NOT appear on any command line nor in the launcher file. When no key is stored, the launcher MUST fail before creating the window with a message naming `remote-harness provider key <profile>`.

#### Scenario: Outside tmux
- **WHEN** the user runs `claudin --resume` in a terminal outside tmux
- **THEN** a window is created in the `claude-remote` session of the Remote Harness server with `claude --resume` and the terminal attaches to it

#### Scenario: Inside tmux
- **WHEN** the user runs `drclaude` in a pane of their own tmux server (their `tmux.conf`, their sessions)
- **THEN** the window is created in the `claude-remote` session of the Remote Harness server and shows nested in that pane, without a second status line; the user's client, sessions and windows are not changed, and detaching returns to their shell prompt

#### Scenario: Inside the Remote Harness server
- **WHEN** the user runs `drclaude` in a pane of a terminal attached to the Remote Harness server
- **THEN** the window is created and that client switches to it

#### Scenario: OpenRouter profile
- **WHEN** the user runs the launcher of a profile with provider `openrouter` and a stored key
- **THEN** the window runs `claude` with `ANTHROPIC_BASE_URL` set to the gateway, `ANTHROPIC_AUTH_TOKEN` read inside the window and `ANTHROPIC_API_KEY` unset, and `ps` never shows the key

#### Scenario: Missing key
- **WHEN** the user runs the launcher of a profile with a provider and no key is stored
- **THEN** no window is created and the message points to `remote-harness provider key <profile>`

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
- **THEN** the terminal attaches to the `claude-remote` session of the Remote Harness server; `remote-harness tmux ls` lists only that server's sessions

#### Scenario: Default server by choice
- **WHEN** `config.json` has `"tmuxSocket": null`
- **THEN** the launchers and the daemon use the user's default tmux server and `tmux.conf`, and no `tmux.conf` is generated

#### Scenario: Sessions from before the upgrade
- **WHEN** `remote-harness update` finishes while a `claude-remote` session exists on the user's default server
- **THEN** the install output says those sessions are no longer managed and names `tmux attach -t claude-remote` to reach them
