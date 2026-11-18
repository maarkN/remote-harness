## 1. Tmux path

- [x] 1.1 Tests first: `resolveTmuxBin` returns what `which tmux` prints when it is an absolute path; when `which` fails or prints nothing, the first existing location in order (`/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, Linuxbrew, snap); null when none exists. `TmuxClient.absoluteBin()` runs the lookup once, returns `bin` itself when it is already absolute, and falls back to `bin` when nothing is found. Verify they fail
- [x] 1.2 `resolveTmuxBin` and `TmuxClient.absoluteBin()` in `infra/tmux.ts`; `install` uses `resolveTmuxBin` (falling back to `tmux` as before); verify the tests in 1.1 and the install tests pass

## 2. Attach command

- [x] 2.1 Tests first in `test/terminal-focus.test.ts`: `attachCommand` starts with the given absolute tmux path; `planShowInTerminal` gives `/bin/sh -c <command>` to Ghostty, WezTerm, kitty, Alacritty, Linux and WSL; iTerm2's AppleScript runs `/bin/sh -c '<command>'` with the command quoted for the shell; Terminal.app's `do script` runs `/bin/sh -c '<command>'`; every opening command starts with the absolute path; `showInTerminal` resolves the path through the client. Verify they fail
- [x] 2.2 `attachCommand(paneId, tmuxBin, server)`, `/bin/sh -c` in every app and platform, `tmuxBin` in `planShowInTerminal` and `showInTerminal`; verify the tests in 2.1 and the rest of `terminal-focus.test.ts` pass

- [x] 2.3 Found while verifying (3.1): with iTerm2 not running, `tell application "iTerm2"` does not compile (-2740) because the name resolves to a terminfo entry registered as `iTerm2.app`. iTerm2 and Terminal.app are addressed by bundle id; the exact-script tests updated; verify they pass and that `osacompile` compiles both scripts with iTerm2 closed (the by-name form fails)

## 3. Verification

- [x] 3.1 On this Mac, with a throwaway tmux server and no client attached: the exact steps `planShowInTerminal` returns for Ghostty open a window attached to the session's pane (`tmux list-clients` shows a client); for iTerm2 and Terminal.app, whose AppleScript needs an Automation grant this shell does not have, the generated scripts compile with `osacompile` and the command line they hand over, run by `/bin/sh` in a pseudo-terminal, attaches a client; then the server is killed
- [x] 3.2 `pnpm check` green (typecheck, tests, Biome with warnings as errors); locally without the Go relay, which has no toolchain on this Mac and runs in CI
- [ ] 3.3 Pending, on the user's Mac after `remote-harness update`: clicking a tmux session in the tray with no client attached opens it in iTerm2, Ghostty and Terminal.app
