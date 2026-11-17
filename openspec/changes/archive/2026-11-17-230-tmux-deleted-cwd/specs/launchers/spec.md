## MODIFIED Requirements

### Requirement: Open session in tmux
The launcher SHALL create (if it does not exist) the tmux session `remote-harness` (`tmuxSession` in `config.json`) on the Remote Harness tmux server (see "Dedicated tmux server") and open in it a new window named `<profile>:<directory>` running `claude` with the profile's `CLAUDE_CONFIG_DIR` and `REMOTE_HARNESS_PROFILE` set (`CLAUDE_REMOTE_PROFILE` too, for the hooks of sessions installed before the rename), forwarding all arguments received. The window's command SHALL itself change to the directory the launcher ran in before starting the agent (`cd -- <dir> && exec …`), in addition to tmux's `-c <dir>`, so the agent starts in that directory even when the tmux server's own working directory no longer exists (tmux then ignores `-c`). When the launcher creates the session, it SHALL run that tmux command from the home folder (`/` when the home folder is not reachable), so a tmux server it starts never keeps a project folder as its working directory. Outside tmux the terminal SHALL attach to that window through a grouped view session of its own. Inside tmux, the launcher MUST NOT take over a client of another tmux server: when the current client belongs to the Remote Harness server it SHALL switch that client to the window; otherwise it SHALL attach the view session nested in the current pane, with the view's status line off, leaving the user's server, sessions and client untouched. For a profile with a provider, the launcher SHALL export the provider's `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` and `ANTHROPIC_SMALL_FAST_MODEL` (those configured), unset `ANTHROPIC_API_KEY` in the window, and read the provider key from the OS secret store (the `0600` file when present, else the macOS Keychain, else the Secret Service) only inside the new window, exporting it as `ANTHROPIC_AUTH_TOKEN`; the key MUST NOT appear on any command line nor in the launcher file. When no key is stored, the launcher MUST fail before creating the window with a message naming `remote-harness provider key <profile>`.

#### Scenario: Outside tmux
- **WHEN** the user runs `claudin --resume` in a terminal outside tmux
- **THEN** a window is created in the `remote-harness` session of the Remote Harness server with `claude --resume` and the terminal attaches to it

#### Scenario: Inside tmux
- **WHEN** the user runs `drclaude` in a pane of their own tmux server (their `tmux.conf`, their sessions)
- **THEN** the window is created in the `remote-harness` session of the Remote Harness server and shows nested in that pane, without a second status line; the user's client, sessions and windows are not changed, and detaching returns to their shell prompt

#### Scenario: Inside the Remote Harness server
- **WHEN** the user runs `drclaude` in a pane of a terminal attached to the Remote Harness server
- **THEN** the window is created and that client switches to it

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
