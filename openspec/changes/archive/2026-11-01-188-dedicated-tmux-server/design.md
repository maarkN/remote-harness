## Context

See proposal.md — Why. `TmuxClient` (`infra/tmux.ts`) runs `tmux -u <command>` with no socket flag, so it lands on the default server (`$TMUX_TMPDIR/tmux-<uid>/default`), as do the launcher script (`features/hooks/launcher.ts`) and the attach command of "Open in terminal" (`features/pane/terminal-focus.ts`). The daemon identifies its panes by the `$TMUX_PANE` the hooks send and by `list-panes -a`; pane ids are global to a server, so it never relied on the session name. The demo already proves the daemon works on another server: it sets `TMUX_TMPDIR` and passes `-S` to its own tmux calls. tmux reads `~/.tmux.conf` only when a server starts and `-f` replaces it; `-L` picks a socket name under `TMUX_TMPDIR`; nesting an attach inside another server's client requires `TMUX` to be unset.

## Goals / Non-Goals

**Goals:**
- One server name and one config file, passed everywhere tmux is invoked by Remote Harness (daemon, launchers, terminal focus, CLI, demo), so the user's tmux is never read or touched.
- A launcher run inside the user's tmux shows the session where the command was typed, without `switch-client` on their client.
- A way back (`tmuxSocket: null`) and a way to keep one's own bindings (`tmuxConfig: user`).

**Non-Goals:**
- Migrating sessions already running on the default server (they keep running there; the install output says how to reach them).
- A tmux configuration UI; the generated file is regenerated from `config.json`, not edited.
- Changing how sessions are discovered (`$TMUX_PANE`, `list-panes -a`): on a server of our own, `-a` lists only our sessions.

## Decisions

1. **A dedicated server (`-L remote-harness`) with a generated `-f` config, over the shared server without `switch-client`, or a dedicated server without nested attach.** Only a server of our own makes the behaviour independent of the user's `tmux.conf` and plugins (`destroy-unattached`, `remain-on-exit`, hooks, tmux-resurrect) and keeps `tmux ls` clean — the two acceptance criteria the shared-server option cannot meet. The config is generated (`features/tmux-server/conf.ts`, `renderTmuxConf`) and written by `install`/`setup`/`update` and by the daemon at start, so a daemon started by hand before `install` still finds it; `-f` is harmless on a running server (tmux reads it only when starting one), so every invocation passes it. The settings are few and TUI-oriented: `escape-time 10` (tmux's 500 ms delay is the one default users feel in Claude Code), `focus-events on`, `history-limit 50000`; the mouse stays at tmux's default so text selection keeps working as today. `tmuxConfig: user` appends `source-file -q` lines for `~/.tmux.conf` and `~/.config/tmux/tmux.conf`, so the user's settings override ours. The three options and their trade-offs are compared in the maintainer's notes (`.annotations/tmux-isolation-options.md`, local) and summarised in ADR 0006.
2. **Server addressing lives in `infra/tmux.ts`** (`TmuxServer = { socket, conf }`, `tmuxServerArgs`, a third `TmuxClient` constructor argument; `null` = default server), so the adapter stays the only place that knows the CLI and existing tests, which build `new TmuxClient(exec)`, keep their argument expectations. `features/tmux-server/conf.ts` maps the config to a `TmuxServer`, renders and writes the config, and checks for legacy sessions. `showInTerminal` reads the client's server to build the attach command.
3. **Inside tmux, nest in the current pane instead of `switch-client` or a new window on the user's server.** The launcher compares `${TMUX%%,*}` (the socket of the current client) with `#{socket_path}` of our server (asked of the launchers' session, which has no `destroy-unattached`): equal → the view is created detached and the client switched to it; different → the view is created by an attaching `new-session` run with `TMUX` unset, with `status off` on the view. Nesting shows the session exactly where the alias was typed, like running `claude` there, creates nothing on the user's server and returns to their prompt on detach; the cost is a nested tmux (same prefix → press it twice; rarely needed inside Claude Code). Opening a window on the user's server would require touching their server (the thing the issue complains about), and only printing an attach hint moves the user to another terminal.
4. **The client that creates the grouped view is the one that attaches to it (or switches to it), in one tmux command.** With `destroy-unattached on`, tmux (3.7 here) destroys an unattached view the moment the client that created it disconnects, so the previous launcher's two steps — create the view detached, then `attach-session` from a new process — lost the view in between (`can't find session`). All three paths now run a single `new-session … \; set-option destroy-unattached on \; select-window … [\; switch-client | \; set-option status off]`.
5. **`tmuxSocket: null` keeps the pre-change behaviour whole**, including `switch-client` when inside the (then shared) server, because the only alternative on a shared server is nesting an attach to the same server. `tmuxConfig` is ignored then: on a shared server, `-f` would configure the user's own tmux.
6. **`remote-harness tmux [args…]` as a thin passthrough** (commander keeps unknown options in the variadic argument with `allowUnknownOption`), defaulting to `attach-session -t =<tmuxSession>`, so `-L` and `-f` never have to be typed; the docs point at it for reattaching over SSH.
7. **The demo keeps `TMUX_TMPDIR`** and names its socket `remote-harness` under it, writing the same generated config, so the demo daemon (which inherits the env) and the demo's own tmux calls meet on one server. Its own `-S` stays, for the reason the script states (tmux falls back to the default server when `TMUX_TMPDIR` does not exist).

## Risks / Trade-offs

- [Sessions open during the upgrade stay on the default server and vanish from the app] → `install` (run by `update`) prints a line naming `tmux attach -t claude-remote`; they end normally when the user exits them.
- [`TMUX_TMPDIR` differs between the shell and the service] → the same exposure as today's default server (both resolve under `TMUX_TMPDIR`); unchanged.
- [Nested tmux inside the user's tmux: prefix captured by the outer tmux, a second status line] → status off on the view session; the prefix is rarely needed inside Claude Code; documented.
- [Users who liked their bindings inside Claude windows] → `tmuxConfig: "user"`, one line in `config.json`; `tmuxSocket: null` for the old behaviour entirely.
- [tmux older than 2.3 lacks `source-file -q`] → only used in `user` mode; tmux 2.3 is from 2016 and the installer installs current packages.

## Migration Plan

Ships with the next release; `remote-harness update` writes the config and the new launchers and restarts the service. Rollback is a config line (`"tmuxSocket": null`) or the previous version, which ignores the new keys.
