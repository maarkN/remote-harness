## 1. Config and server addressing

- [x] 1.1 `tmuxSocket` (nullable, default `remote-harness`, exported `DEFAULT_TMUX_SOCKET`) and `tmuxConfig` (`minimal` | `user`) in `core/config.ts`; `paths.tmuxConf()`; `TmuxServer`, `tmuxServerArgs` and the server argument of `TmuxClient` in `infra/tmux.ts`; `features/tmux-server/conf.ts` with `tmuxServerOf`, `userTmuxConfs`, `renderTmuxConf`, `ensureTmuxConf` and `legacySessionsExist`; tests: config defaults/null/invalid, `TmuxClient` raw args with and without a server, the rendered config in both modes (quoting), `ensureTmuxConf` idempotent, `legacySessionsExist`

## 2. Launcher, terminal focus, daemon, install, CLI

- [x] 2.1 Launcher: `tmuxServer` option → a `tmux=(…)` array with `-L`/`-f`; inside `$TMUX`, socket comparison → `switch-client` or nested attach with the view's status off; tests: `zsh -n`, flags present, a fake tmux recording the nested attach (TMUX unset, `status off`) and the same-server switch; existing launcher tests untouched
- [x] 2.2 `attachCommand(paneId, server)` / `planShowInTerminal({ tmuxServer })` / `showInTerminal` reading the client's server; `main.ts` builds the client with `tmuxServerOf(config)` and calls `ensureTmuxConf`; `installAll` writes the config (line in the output), passes the server to the launchers and prints the legacy-sessions note; `remote-harness tmux [args…]` in `cli.ts`; tests for the attach command and the plan
- [x] 2.3 i18n: `install.tmuxConf`, `install.legacyTmuxSessions`, `cli.tmux.description`, `cli.tmux.args` in pt-BR, en-US and es-ES; parity test passes
- [x] 2.4 Demo: socket `remote-harness` under its `TMUX_TMPDIR`, the generated config written in its home and passed with `-f`; `pnpm --filter @remote-harness/daemon demo` still starts (typecheck of the script)

## 3. Decision records and docs

- [x] 3.1 `docs/adr/0006-dedicated-tmux-server.md` (accepted) and the "Remote Harness tmux server" entry in `GLOSSARY.md`
- [x] 3.2 Docs: `apps/web/content/{en-US,pt-BR,es-ES}/daemon.md` (config keys, launchers section with the nested behaviour and `remote-harness tmux`), `cloud-server.md` (reattaching), `README.md` diagram line

## 4. Verify

- [x] 4.1 `openspec validate 188-dedicated-tmux-server --strict`, `turbo run typecheck test`, Biome (worktree workaround); a real launcher run against a fake `TMUX` of another socket shows the nested attach and no `switch-client`
