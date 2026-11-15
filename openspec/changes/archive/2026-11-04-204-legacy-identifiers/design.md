## Context

See proposal.md → Why. The update runs in three processes: the old CLI (`remote-harness update`) fetches the new code and spawns `bash install.sh --update`, which builds and then runs the new CLI (`update --finish`), which rewrites launchers, hooks, shortcuts and the PATH block (`installAll`) and reinstalls the service, restarting the daemon. Sessions started before the update keep their tmux pane environment (`CLAUDE_REMOTE_PROFILE`) and the hook commands Claude Code read from `settings.json` at startup (old headers, old curl-config path). `dataHome()` is read on every `paths.*()` call, never cached. The ad-hoc signature of `Remote Harness.app`, and the privacy grants keyed by it, change whenever the bundle contents change.

## Goals / Non-Goals

- Goal: one `remote-harness update` migrates everything; a second run changes nothing (idempotent).
- Goal: sessions running through the update keep reporting hooks and keep their launchers working.
- Goal: no secret is lost: pairing (daemon identity) and provider keys survive.
- Non-goal: removing the `claude-remote` CLI alias or the symbolic link (a later deprecation step).
- Non-goal: preserving the macOS privacy grants across the bundle identifier change (impossible: they are keyed by the bundle).

## Decisions

- **Move + symbolic link, in bash and in the CLI**: `install.sh` moves `~/.claude-remote` to `~/.remote-harness` first thing in `main()` (before `$SRC_DIR` is used) and links the old path; the CLI does the same at startup (`migrateLegacyDataDir()`) for installs updated by hand. The link makes the old absolute paths baked into running sessions (hook curl config, launchers, the old CLI's `REMOTE_HARNESS_SRC`) keep resolving. Alternative considered: copying and keeping both; rejected (two states to keep in sync, double disk). Alternative: no link; rejected because every hook of a running session would fail until it restarts, and the old CLI process driving the update would lose its own files.
- **Real paths for what the new CLI writes**: `builtCliPath()` resolves symlinks, so the plist, the unit and the shortcuts written by `update --finish` (reached through the link) point at `~/.remote-harness/...`, never at the link.
- **Service migration inside `install()`**: both managers boot out / disable the legacy agent or unit and remove its file when it exists, before loading the new one; `status()` reports a legacy one as loaded (so `finishUpdate` reinstalls instead of printing "not installed"); `uninstall()` removes both. The new label `com.alvyntech.remoteharness.daemon` follows the store identifier family (`com.alvyntech.remoteharness`, #338). `BUNDLE_FORMAT` is bumped so the bundle is rebuilt with the new `CFBundleIdentifier`; the install output warns about the grants on the Mac where the legacy plist existed. Alternative considered: keeping `tech.doctorx.claude-remote` to preserve the grants; rejected by the owner (small install base, the issue asks for the rename).
- **Secrets copied, legacy left**: for the daemon identity and each profile's provider key, when the new service has no entry and the legacy one has, the value is written under the new service. The legacy entries are not deleted (a downgrade still finds them; the Keychain shows both until the user cleans up). Runs in `update --finish` and `install`, before launchers are regenerated (they read the provider key by service name).
- **tmux session renamed, not duplicated**: `rename-session` keeps windows, panes and the registry's pane ids; it runs only when the configured session (new default `remote-harness`) does not exist, a `claude-remote` session does, and the configured name is not the legacy one (a `config.json` pinning `claude-remote` wins). The "sessions from before the dedicated server" notice looks for both names on the default server and names the one found.
- **Hooks accept both header names; launchers export both profile variables**: the server reads `x-remote-harness-*` then `x-claude-remote-*`; generated commands use `${REMOTE_HARNESS_PROFILE:-$CLAUDE_REMOTE_PROFILE}`; the launcher exports `REMOTE_HARNESS_PROFILE` and mirrors it into `CLAUDE_REMOTE_PROFILE`, so a new pane also satisfies a `settings.json` not yet rewritten. `REMOTE_HARNESS_TMUX`, `<AGENT>_BIN`, `NO_ATTACH` and `PROMPT` keep the legacy name as fallback (cheap); `EXEC` is set and read by the launcher itself and just renames.
- **PATH block**: `removePathBlock` strips the legacy markers too, so `upsertPathBlock` replaces the old block instead of adding a second one; `uninstall` removes either.
- **Backup suffix**: constant change only; old `.bak-claude-remote` files are left where they are.

## Risks / Trade-offs

- [The move happens while the old daemon still runs] → it keeps working through the link until `update --finish` restarts it; its files are the same inodes.
- [A machine where `~/.remote-harness` already exists next to `~/.claude-remote`] → nothing is moved (the new directory wins, as before); the old one stays as data of its own.
- [macOS asks for folder access / notifications again] → stated in the install output and the PR; one-time.
- [The Keychain prompt when `security` copies entries] → entries created by the `security` CLI are readable by it without a prompt, as the daemon already relies on.
- [Windows (WSL)] → the data dir lives inside the distro and goes through the same `install.sh`; the logon task name was already migrated.

## Migration Plan

Ships with the next release; `remote-harness update` does everything. Rollback: an older build still finds its data through the link, its secrets under the legacy service, and would reinstall the legacy LaunchAgent next to the new one (two daemons) — not supported, document "update again".
