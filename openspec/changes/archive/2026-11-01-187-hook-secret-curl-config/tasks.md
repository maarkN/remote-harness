## 1. Secret files

- [x] 1.1 `paths.hookCurlConfig()` (`hook-secret.curlrc` next to `hook-secret`) and `rotateHookSecret()` in `core/secrets.ts`, with `ensureHookSecret()` reusing it; `features/hooks/hook-secret.ts` with `renderCurlConfig(secret)` (one `header` line, curl quoting) and `ensureHookSecretFiles()` covering fresh install, migration (secret without config → rotated), steady state and a stale config; tests in `test/hook-secret.test.ts` for the four cases, the 0600 modes and the escaping

## 2. Generated commands

- [x] 2.1 `HookInstallOptions.curlConfig`; the curl options of `settings-hooks.ts` (`buildHookEntry` SessionStart, `buildCodexHookEntry`, `buildGeminiHookEntry`, `postCommand` for Kimi) pass `-K <config>` and no secret header; `renderStatusLineScript({ port, curlConfig })` and `installStatusLineScript` likewise; `installAll` calls `ensureHookSecretFiles()`, passes the config path and prints the rotation line; existing tests updated (the ones that run the generated command against a live hooks server write a real curl config) and a regression test asserting that no command of any style, no Kimi table and the status line script contain the secret value, while the `http` entries still do
- [x] 2.2 i18n: `install.hookSecretRotated` and `doctor.hookCurlConfig` in pt-BR, en-US and es-ES; the parity test passes

## 3. Doctor and docs

- [x] 3.1 `doctor` checks that the curl config exists and holds the current secret (`hookCurlConfigMatches()` in `hook-secret.ts`, tested), with the `runInstall` hint
- [x] 3.2 `SECURITY.md` and `apps/web/content/{en-US,pt-BR,es-ES}/security.md` say where the secret lives and that curl reads it from a `0600` config file, never from a command line

## 4. Verify

- [x] 4.1 `openspec validate 187-hook-secret-curl-config --strict`, `turbo run typecheck test` in the daemon, Biome (worktree workaround); a generated SessionStart command run under `sh -c` shows no secret in `ps` while reaching the daemon
