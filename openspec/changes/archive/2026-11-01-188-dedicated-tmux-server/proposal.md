## Why

Remote Harness runs its sessions on the user's default tmux server, in a session named `claude-remote`. People who already use tmux (an editor inside tmux, their own `tmux.conf`) get conflicts (#433): their `tmux.conf` applies to our windows (a global `destroy-unattached on` kills our session, `remain-on-exit` keeps dead panes alive, hooks and plugins such as tmux-resurrect act on our windows), our sessions clutter their `tmux ls`, and a launcher run inside their tmux takes over their current client with `switch-client`.

## What Changes

- The launchers and the daemon use a **dedicated tmux server**, `tmux -L remote-harness`, started with a small generated config (`~/.remote-harness/tmux.conf`: Esc reaches the agent at once, focus events, a larger history) instead of the user's `tmux.conf`. Two config keys: `tmuxSocket` (the server name, default `remote-harness`; `null` goes back to the user's default server and config) and `tmuxConfig` (`minimal`, the default, or `user`, which also loads the user's own `tmux.conf` on top).
- A launcher run inside tmux never takes over the user's client: when that client belongs to another server (the user's own tmux), the session is attached nested in the current pane, with the status line off; when it already belongs to the Remote Harness server, the client switches as before. Outside tmux the terminal attaches as before. In every case the tmux client that creates the launcher's grouped view is the one that attaches to it, in one command: with current tmux (3.7), a view created detached with `destroy-unattached on` vanished before the separate `attach-session` reached it, so attaching through an alias failed with `can't find session`.
- "Open in terminal (tmux)" and `pane.focus` act on the Remote Harness server: a terminal already attached to it switches, otherwise a new terminal window attaches with `tmux -L remote-harness`.
- `remote-harness tmux [args…]` runs tmux against the Remote Harness server (no arguments: attach to the launchers' session), so users never have to remember `-L`. `install` writes the tmux config and, when sessions from before this change are still on the default server, says how to reach them.
- The demo keeps its own `TMUX_TMPDIR` sandbox and uses the same server name and config.
- ADR 0006 records the decision; `GLOSSARY.md` gains "Remote Harness tmux server"; docs in en-US, pt-BR and es-ES.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `launchers`: "Open session in tmux" — the window opens on the Remote Harness tmux server and a launcher inside another server's tmux nests instead of switching the client; a new requirement "Dedicated tmux server" — the server, its config, the `tmuxSocket` / `tmuxConfig` keys, `remote-harness tmux`, the note about sessions left on the default server.
- `daemon-config`: a new requirement "tmux server config" — the two keys, their defaults and validation.

"Open in terminal (tmux)" (`desktop-updates`) and `pane.focus` (`raw-terminal`) keep their requirements: they still switch an attached client or open a terminal that attaches to the session's pane; which server that is follows from the new launchers requirement.

## Impact

- `apps/daemon/src/core/config.ts` (keys), `core/paths.ts` (`tmux.conf`), `infra/tmux.ts` (server flags), a new `features/tmux-server/conf.ts` (config rendering, legacy session check), `features/hooks/launcher.ts`, `features/pane/terminal-focus.ts` and `show-in-terminal.ts`, `features/setup/install.ts`, `main.ts`, `cli.ts` (`tmux` command), `scripts/demo.mts`, the three i18n catalogs, `docs/adr/0006-dedicated-tmux-server.md`, `GLOSSARY.md`, `README.md`, `apps/web/content/*/daemon.md` and `cloud-server.md`.
- No protocol change. Sessions started before the upgrade keep running on the user's default tmux server but are no longer seen by the daemon until they are started again from a launcher; `install` (run by `update`) prints how to reach them.
