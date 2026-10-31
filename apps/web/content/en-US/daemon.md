---
title: The daemon
description: CLI commands, the configuration file, the background service, updates and channels, the tray icon, logs.
applies: 0.7+
---

The daemon runs on the computer: it tails the session transcripts, drives tmux, receives Claude Code's hooks on `127.0.0.1` and serves the app on two paths with the same end-to-end encryption: directly, on a WebSocket that listens on every interface (the home network, or any VPN address of the computer), and through its connection relay, where it keeps a room open. `remote-harness --help` is the source of truth for the commands.

## Commands

| Command | What it does |
| --- | --- |
| `remote-harness setup` | Guided setup: accounts and aliases, hooks, service, pairing. `--yes` keeps the config, `--lang` picks the language. |
| `remote-harness start` | Runs the daemon in the foreground. `--dev` binds to `127.0.0.1` only and never uses a relay, `--host` sets the direct address. |
| `remote-harness pair` | Asks the running daemon for a pairing QR code: it pairs one phone and expires in 5 minutes. |
| `remote-harness doctor` | Checks the tools, the config, the profiles and their provider keys, the daemon identity, whether the connection relays answer, the service, push and the registered phones. |
| `remote-harness install` / `uninstall` | Installs or removes the launchers, the `PATH` entry, the hooks and the status line wrapper, without questions. |
| `remote-harness service install` / `uninstall` / `status` | The background service: a launchd LaunchAgent on macOS, a systemd user unit on Linux and WSL. |
| `remote-harness update` | Fetches the new version, rebuilds, refreshes the hooks and restarts the service. `--ref <branch|tag>` picks a version. |
| `remote-harness updates status` / `check` / `channel [main|development]` / `auto on|off` | The background update check. |
| `remote-harness push status` / `test` | Push mode in use and the registered phones; sends a test notification. |
| `remote-harness push off` / `on` | Stops (or resumes) every push and live status update from this computer, without restarting the daemon. |
| `remote-harness provider key <profile>` | Stores a profile's provider key (OpenRouter) in the OS secret store. `--stdin` reads it from a pipe. |
| `remote-harness devices list` / `revoke <id>` | The phones and tablets paired with this computer (ID, name, platform, paired, last seen); `revoke` disconnects one, which must pair again. |
| `remote-harness rules list` / `undo <id>` | The "always allow" rules created from the phone. |
| `remote-harness approvals list` | The approval log: what devices allowed, denied, undid and deleted (last 30 days). |
| `remote-harness commands [on|off]` | Shows, allows or forbids running shell commands from the app in a session's folder (off by default), applied to the running daemon. |

The old `claude-remote` command and `CLAUDE_REMOTE_*` variables keep working for installs made before the rename.

## Configuration file

`~/.remote-harness/config.json` (installs made before the rename keep using `~/.claude-remote`):

```json
{
  "profiles": [
    { "id": "personal", "name": "Personal", "configDir": "~/.claude", "color": "#D97757" },
    { "id": "work", "name": "Work", "configDir": "~/.claude-work", "color": "#61AFEF" }
  ],
  "wsPort": 7337,
  "hookPort": 7338,
  "defaultRuleScope": "project",
  "permissionTimeoutSec": 280,
  "questionTimeoutSec": 3300,
  "inputStrategy": "paste",
  "recentDays": 7,
  "tmuxSession": "claude-remote",
  "push": "auto",
  "update": { "channel": "main", "auto": false },
  "tray": true,
  "relays": ["wss://us.relay.remoteharness.app", "wss://br.relay.remoteharness.app"],
  "relay": "on",
  "direct": "on"
}
```

- `profiles`: one per Claude Code account. `id` is the alias (the launcher's name), `configDir` the account's `CLAUDE_CONFIG_DIR`, `color` the tag color in the app. Optional `agent` (`claude` by default) and `provider` (below).
- `wsPort`, `hookPort`: the app and the hooks ports.
- `defaultRuleScope`: where "always allow" rules go by default, `project` or `user`.
- `permissionTimeoutSec`: how long the daemon holds a permission request for the phone before the terminal dialog takes over. The request stays in the app as "Answer in the terminal" until the session moves on.
- `questionTimeoutSec`: the same for questions and plan approvals (3300 by default). A question still open after 10 minutes sends one reminder push. The hook timeout written into the agent's settings covers both, and `remote-harness install` or `update` rewrites it.
- `inputStrategy`: `paste` (default) or `type` for prompts sent from the phone.
- `recentDays`: how far back ended sessions are listed.
- `tmuxSession`: the tmux session the launchers use.
- `language`: `pt-BR`, `en-US` or `es-ES` for the CLI, the setup and the push texts; the system language when absent.
- `push`: `auto` (your Firebase service account when present, else the relay) or `off`.
- `update`: the channel `update` and the background check follow, and whether updates apply by themselves.
- `tray`: the menu bar / tray icon.
- `relays`: the connection relays the daemon may use. At start it measures them and keeps its room on the fastest, moving only when that one goes down; replace the list to [self-host](#self-hosting-the-connection-relay).
- `relay`: `off` keeps the daemon off the relays (phones reach it only directly). `direct`: `off` stops listening for direct connections (only the relay). Not both. `start --dev` never uses a relay.
- `trayPermissions`: whether the tray offers Allow / Always allow / Deny for a waiting permission (on by default; also under the tray's Preferences).
- `shellCommands`: `enabled` (off by default; change it with `remote-harness commands on|off`), `timeoutSec` (300) and `maxOutputKb` (1024) for the commands run from the app.

Edits to the file take effect when the daemon restarts (`remote-harness service install` again, or restart from the tray).

## Profiles and OpenRouter

A profile can route Claude Code through OpenRouter instead of the Anthropic account. The easiest way is `remote-harness setup` → "Add an OpenRouter profile": it asks the name, the alias, the folder (`~/.claude-openrouter`), an optional default model and the key (hidden), checks the key with OpenRouter and shows the credits left when the key can read them. Running the setup again lists these profiles and lets you keep them, replace the key or remove the profile (its launcher, hooks and key; the folder stays).

By hand: add a `provider` with `kind: "openrouter"` and, optionally, `baseUrl` (another Anthropic-compatible gateway), a default `model` and a `smallFastModel`.

```json
{
  "id": "openrouter",
  "name": "OpenRouter",
  "configDir": "~/.claude-openrouter",
  "color": "#8A8784",
  "provider": { "kind": "openrouter", "model": "anthropic/claude-sonnet-5.5" }
}
```

Then `remote-harness install` regenerates the launchers and `remote-harness provider key openrouter` stores the key in the same secret store as the daemon's own keys (Keychain on macOS, Secret Service or a `0600` file on Linux). The launcher reads it only inside the tmux window, never on a command line, and the daemon only uses it to show your credits in the app. `doctor` reports whether each provider profile has a key.

## Codex profiles

A profile can run OpenAI Codex CLI instead of Claude Code: set `"agent": "codex"` and point `configDir` at the Codex home (`CODEX_HOME`, `~/.codex` by default). `remote-harness setup` offers `~/.codex` when Codex has used it.

```json
{ "id": "cdx", "name": "Codex", "configDir": "~/.codex", "color": "#2FBF8F", "agent": "codex" }
```

`remote-harness install` writes the profile's launcher (it opens `codex` with `CODEX_HOME` set) and merges the daemon's hooks into `<CODEX_HOME>/hooks.json`, next to your own and with a backup; your `config.toml` is not touched. **Codex asks once to trust new hooks**: open `codex` and choose "Trust all and continue" (or review them in `/hooks`). Until then its sessions are listed read-only and approvals stay in the terminal. `doctor` checks that `codex` is on the `PATH` and that the hooks are installed.

What works like Claude Code: the session list (recent rollouts under `sessions/`), the conversation, prompts, photos and keys, starting and resuming from the phone (in a worktree with `codex --worktree`, and with a name, sent as `/rename`), push, live status, approvals with Allow / Deny, Polish dictation and generated commit messages (through `codex exec`). Differences: the mode chip shows the permission profile and switches between read only and workspace (`/permissions`, Codex 0.164 or later); full access only in the terminal. There is no "Always" (Codex hooks cannot add rules) and no provider.

## Gemini CLI profiles

A profile can run Google's Gemini CLI: set `"agent": "gemini"` and point `configDir` at a Gemini config folder, which is always named `.gemini` (`~/.gemini` by default; for another one, `~/work/.gemini`, the launcher sets `GEMINI_CLI_HOME=~/work`). `remote-harness setup` offers `~/.gemini` when Gemini CLI has used it.

```json
{ "id": "gem", "name": "Gemini", "configDir": "~/.gemini", "color": "#E3729E", "agent": "gemini" }
```

`remote-harness install` writes the profile's launcher (it opens `gemini`) and merges the daemon's hooks into `<configDir>/settings.json`, next to your own hooks and settings and with a backup. **Gemini CLI runs no hooks in a folder it does not trust**: when `gemini` asks, trust the folder (or use `/permissions`). Until then its sessions there are listed read-only and approvals stay in the terminal. `doctor` checks that `gemini` is on the `PATH` and that the hooks are installed.

What works like Claude Code: the session list (recent session files under `tmp/`), the conversation (shell commands, file edits and searches shown like Claude Code's), prompts, photos and keys, starting and resuming from the phone, push and live status. Approvals: Gemini CLI hooks cannot approve a tool, so when its approval dialog opens the phone gets Allow / Deny and the daemon presses the dialog's own keys in the terminal ("Allow once" or Esc); if the dialog was already answered there, the app says so. Differences: no "Always", no mode switch (and never YOLO), no worktree or name at start, no Polish dictation or generated messages, and no provider.

## Kimi CLI profiles

A profile can run Moonshot's Kimi CLI: set `"agent": "kimi"` and point `configDir` at the Kimi data dir (`KIMI_SHARE_DIR`, `~/.kimi` by default). `remote-harness setup` offers `~/.kimi` when Kimi CLI has used it.

```json
{ "id": "km", "name": "Kimi", "configDir": "~/.kimi", "color": "#5B9BF5", "agent": "kimi" }
```

`remote-harness install` writes the profile's launcher (it opens `kimi` with `KIMI_SHARE_DIR` set) and adds the daemon's hooks to `<configDir>/config.toml` as `[[hooks]]` tables, at the end and with a backup; every other line of the file stays as it is. If your `config.toml` sets `hooks = [...]` as a single key, install leaves it alone and `doctor` reports the hooks as missing: turn it into `[[hooks]]` tables first. `doctor` checks that `kimi` is on the `PATH` and that the hooks are installed.

What works like Claude Code: the session list (recent sessions under `sessions/`), the conversation (shell commands, file edits and searches shown like Claude Code's), prompts, photos and keys, starting and resuming from the phone, push and live status. Approvals: Kimi CLI has no hook for them, so while a Kimi session runs the daemon looks at its tmux pane every second; when the approval panel shows, the phone gets Allow / Deny and the daemon presses the panel's own keys ("Approve once" or "Reject"). Answered in the terminal, the request goes away by itself. Differences: no "Always" (no "approve for this session" either), no plan mode, yolo or afk from the app, no worktree or name at start, no Polish dictation or generated messages, and no provider. A turn cancelled with Esc stays "running" in the app until the next prompt.

## Launchers and aliases

Each profile gets a small zsh launcher in `~/.remote-harness/bin/<alias>` (added to the `PATH` of `~/.zshrc` and `~/.bashrc`). Run the alias instead of `claude`, with the same arguments: it opens Claude Code in a window of the `claude-remote` tmux session with the right `CLAUDE_CONFIG_DIR` and attaches your terminal to it. The plain `claude` command is never changed.

## Background service

`remote-harness service install` keeps the daemon running after you close the terminal and starts it at login: a LaunchAgent on macOS (shown as a Login Item), a systemd user unit on Linux (`~/.config/systemd/user/claude-remote.service`). On Linux servers you reach over SSH, the setup offers `loginctl enable-linger`, so the service survives logout; [Cloud server](/en/docs/cloud-server/) covers running the daemon on a cloud VM. Without systemd (containers, some WSL setups) run `remote-harness start` yourself, for example in a tmux window. On WSL the setup can also create a Windows scheduled task that starts the distribution at logon.

`remote-harness service status` shows whether it is loaded; the tray menu can restart it.

## Updates and channels

The service checks its channel on the git remote every 6 hours and shows a desktop notification when there is a new version (never in a development clone). `remote-harness update` applies it; `remote-harness updates auto on` lets the daemon update by itself, only when no session is running or waiting and no permission is pending, and never to an older version. `remote-harness updates channel development` follows the integration branch; going back to `main` warns that it installs an older version.

## Tray icon

The service daemon shows a menu bar icon on macOS (a small Swift helper built on first start with the Command Line Tools) and a tray icon on Linux (`python3` with GTK 3 and AyatanaAppIndicator3 or AppIndicator3). The menu shows the running sessions and the pending permissions (answer them from there), starts a new session, shows the pairing code, checks or applies updates, picks the channel, opens the logs, the config and the documentation, and restarts the daemon. **Pair a phone** shows the pairing QR code right in the menu on macOS, the address and the pairing in the terminal; each code is single use and expires in 5 minutes. **Preferences** toggles the permission answers in the menu, the keep-awake mode and push notifications, applied at once, and opens the config file for the rest. Under the service, **Quit** either hides the icon or stops the service until the next login. `"tray": false` turns it off; without the helper the daemon runs headless. In WSL the icon appears in the Windows notification area: the daemon starts a small helper on the Windows side through interop (Windows PowerShell compiles it at start; nothing is installed in Windows), so it shows up at logon with the logon task and goes away when the daemon stops. It has the same menu as the Linux tray, update notifications become Windows notifications, and actions that open a terminal use Windows Terminal.

On macOS the icon opens a popover instead of a menu: the computer with its paths (direct and/or relay, never an address), the waiting permission as a card with Deny / Always / Allow, up to five sessions (click to open one in the terminal, right-click to rename or close it), the paired devices with whether they are online, and the quick actions. Its **Preferences** window has tabs for General, Profiles (rename a profile), Notifications, Network (the direct path's addresses, the connection relay and its home relay, the devices connected now), Devices (each paired device, with **Revoke…**), Pairing, Updates and Advanced. On Linux the menu follows the same order, and each device has a **Revoke…** submenu.

## Self-hosting the connection relay

When the phone cannot reach the computer directly, the daemon and the app meet on a connection relay: `us.relay.remoteharness.app` and `br.relay.remoteharness.app` by default. The relay only forwards traffic that the daemon and the app encrypt end to end; it cannot read sessions, prompts or files, and it keeps no logs of what passes through or of IP addresses. Running your own takes one container:

```sh
docker build -t remote-harness-relay apps/relay
docker run -d --restart unless-stopped -p 8080:8080 remote-harness-relay
```

Put it behind a proxy that terminates TLS (Traefik, Caddy, nginx) so it is reached over `wss://`, and set `RELAY_CLIENT_IP_HEADER` to the header the proxy fills with the client address (`X-Real-Ip`, for example) so the per-address limits see the real client. `GET /healthz` answers `{"status":"ok"}`. Limits come from the environment: `RELAY_MAX_DEVICES` (10 phones per computer), `RELAY_MAX_FRAME_BYTES` (8 MB), `RELAY_ROOM_RATE_BYTES` and `RELAY_ROOM_BURST_BYTES` (bandwidth per computer), `RELAY_IDLE_TIMEOUT`, `RELAY_IP_CONNECTS_PER_MINUTE`, `RELAY_IP_BURST` and `RELAY_IP_MAX_CONNS`.

Then list it in the daemon's configuration file, instead of the default relays or before them:

```json
{ "relays": ["wss://relay.example.com"] }
```

Pair the phone again afterwards: the pairing code tells the app which relay to use.

## Data and logs

Everything the daemon keeps lives in `~/.remote-harness/`: `config.json`, `state.json` (the known sessions), `secrets/` (provider keys when the file store is used), `models-cache.json`, `bin/` (launchers), `logs/` and `src/` (the source the installer built). Attach the logs to a bug report after removing tokens and session content.

Environment variables: `REMOTE_HARNESS_HOME` moves the data directory, `REMOTE_HARNESS_TOKEN_STORE=keychain|secret-tool|file` forces the secret store (the daemon's keys and the provider keys), `REMOTE_HARNESS_LANG` sets the language.
