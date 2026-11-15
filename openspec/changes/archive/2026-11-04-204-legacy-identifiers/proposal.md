## Why

The product was renamed to Remote Harness (#81), but what an install registers on the computer still carries the old name (#85): the data directory `~/.claude-remote`, the LaunchAgent `tech.doctorx.claude-remote`, the unit `claude-remote.service`, the Keychain service `claude-remote`, the tmux session `claude-remote`, the hook headers `x-claude-remote-*`, the launcher variables `CLAUDE_REMOTE_*`, the backup suffix and the shell PATH block markers. Every one of them shows up to users (`launchctl list`, `systemctl --user`, Keychain Access, `tmux ls`, `~/.zshrc`) and every one needs a migration that runs on `remote-harness update` without breaking a running install. The owner decided on 2026-11-03 to move the data too, while the install base is small.

## What Changes

- **Data directory**: `~/.claude-remote` is moved to `~/.remote-harness` once (installer and CLI start), with a symbolic link left at the old path for the sessions, hooks and launchers still running from it; the "use the legacy directory when it exists" fallback goes away.
- **Service**: the LaunchAgent becomes `com.alvyntech.remoteharness.daemon` (also the bundle identifier of `Remote Harness.app`, in the family of the store identifier `com.alvyntech.remoteharness`) and the unit `remote-harness.service`; installing the service unloads and removes the legacy agent or unit first, and `status` still sees a legacy one as loaded so the update restarts it. **BREAKING for macOS grants**: the new bundle identifier rebuilds the bundle once, after which macOS asks again for folder access and notifications; the update says so.
- **Secrets**: Keychain and Secret Service entries move to the service `remote-harness` (copied on update; the legacy entries stay).
- **tmux**: the default session is `remote-harness`; a live `claude-remote` session is renamed on update when the configured session does not exist and `config.json` does not pin the old name.
- **Hooks and launchers**: headers `x-remote-harness-secret|pane|profile` (the daemon accepts the legacy ones), launcher variables `REMOTE_HARNESS_PROFILE|NO_ATTACH|TMUX|<AGENT>_BIN|EXEC|PROMPT` (launchers still export `CLAUDE_REMOTE_PROFILE`, generated commands fall back to it), backup suffix `.bak-remote-harness`, PATH block `# >>> remote-harness >>>` (the legacy block is replaced).
- The `claude-remote` CLI alias stays for now (deprecation window), as the spec already says.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `product-identity`: "Data directory" is rewritten (moved once, link left, no fallback) and a new requirement "Identifiers on the computer" lists the names and the migration rules.
- `launchers`: session name and variables in "Open session in tmux"; the legacy-sessions notice in "Dedicated tmux server" names the session found.
- `session-lifecycle`: "New session" names the `remote-harness` session.
- `platform-support`: "Background service per platform" names the label and the unit and requires the legacy one to be replaced.
- `daemon-service`: "Folder access attribution" records the one-time bundle rebuild and the warning.
- `hooks-integration`, `permission-approval`: the backup suffix in their scenarios.
- `codex-sessions`, `gemini-sessions`, `kimi-sessions`, `qwen-sessions`: the launcher path in their scenarios.

## Impact

- `install.sh` (data move, default data dir, messages), `install.ps1` (temp and backup names).
- Daemon: `core/paths.ts`, `core/secrets.ts`, `core/config.ts`, `cli.ts`, `transport/hooks-server.ts`, `features/hooks/{receiver,settings-hooks,launcher,installer}.ts`, `features/status-line/wrapper.ts`, `features/lifecycle/service.ts`, `features/service/{launchd,systemd}.ts`, `features/tmux-server/conf.ts`, `features/setup/install.ts`, `features/updates/channel.ts`, `features/wsl/wsl-conf.ts`, i18n catalogs (new install lines in pt-BR, en-US, es-ES), `scripts/demo.mts`.
- Docs: `apps/web/content/*/daemon.md`.
- Tests: the suites that name the identifiers, plus new ones for the migrations.
- No protocol or app change.
