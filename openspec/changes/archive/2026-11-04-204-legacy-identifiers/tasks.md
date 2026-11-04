## 1. Data directory

- [x] 1.1 `install.sh`: default `DATA_DIR` to `~/.remote-harness`, add `migrate_data_dir` (move + symbolic link, skipped with the `HOME` override, when the old path is a link or the new directory exists) called first in `main()`, with the step message in pt-BR, en-US and es-ES; verify with a bash test that sources the script in a temp `HOME`
- [x] 1.2 `core/paths.ts`: `dataHome()` without the legacy fallback, `migrateLegacyDataDir()`; `cli.ts` calls it before anything reads the config and `builtCliPath()` resolves symlinks; verify `paths` tests cover move, link, override and no-op

## 2. Service and secrets

- [x] 2.1 `launchd.ts`: new label, legacy label booted out and its plist removed in `installService` when present, `serviceStatus` falls back to the legacy label, `uninstallService` removes both, `BUNDLE_FORMAT` bumped; verify the launchd tests (fake `launchctl`) for both the migrated and the clean cases
- [x] 2.2 `systemd.ts`: new unit, legacy unit disabled and removed in `install` when present, `status` fallback, `uninstall` both; verify the systemd tests
- [x] 2.3 `secrets.ts`: service `remote-harness` with a `service` parameter on both OS stores and `migrateLegacySecrets(kind, exec, profileIds)`; verify a test with a fake `security` that copies the identity and a provider key and skips entries already present
- [x] 2.4 `cli.ts`: `finishUpdate` and `install` run the secrets migration before `installAll` and print the counts; `service install` and `finishUpdate` warn about the macOS grants when the legacy plist existed; `channel.ts` detects both labels; verify typecheck and the updates test

## 3. tmux, hooks, launchers and files

- [x] 3.1 `config.ts`: default `tmuxSession` `remote-harness`, `LEGACY_TMUX_SESSION`, backup suffix; `tmux-server/conf.ts`: `renameLegacySession` and `legacySessionsExist` over both names; `setup/install.ts` renames once and names the session found; verify the tmux-server and install tests
- [x] 3.2 Hooks: new header names with legacy fallback in `hooks-server.ts` and `receiver.ts`; `settings-hooks.ts` and `status-line/wrapper.ts` read `${REMOTE_HARNESS_PROFILE:-$CLAUDE_REMOTE_PROFILE}`; verify the hooks, hook-secret, status-line and kimi tests, including a request with the legacy headers
- [x] 3.3 `launcher.ts`: `REMOTE_HARNESS_*` variables (with the fallbacks described in design.md), both profile variables exported, PATH block markers renamed and the legacy block replaced; `lifecycle/service.ts` sets the new variables; verify the launcher, lifecycle and provider tests, including a rc file with the old block
- [x] 3.4 `installer.ts` and `wsl-conf.ts` backup/temp names, `install.ps1` names, `scripts/demo.mts` headers and variable; verify the wsl test and `bash -n install.sh`

## 4. Texts and docs

- [x] 4.1 i18n: `install.tmuxSessionRenamed`, `install.secretsMigrated`, `install.serviceRelabelled` in the three catalogs; verify the i18n parity test
- [x] 4.2 `apps/web/content/*/daemon.md`: the data directory note and the unit name; verify the web tests

## 5. Verification

- [x] 5.1 Every test file that named a legacy identifier updated; `pnpm turbo run typecheck test` and Biome green on the worktree
