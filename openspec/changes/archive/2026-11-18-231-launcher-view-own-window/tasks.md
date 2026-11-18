## 1. Launcher

- [x] 1.1 Tests first in `test/hooks.test.ts`. With the fake tmux, check the three paths:
  - Outside tmux: the attaching `new-session` creates a view that is not grouped (no `-t =s`), with a placeholder window. In the same command it links the new window into the view (`link-window -s @1 -t =<view>:`), selects it, kills the other windows (`kill-window -a -t =<view>:@1`), and sets `destroy-unattached on` and `detach-on-destroy on`.
  - Nested in another server's tmux: the same, plus `status off`, with `TMUX` unset.
  - Inside the Remote Harness server: `new-session -d …` with `detach-on-destroy off`, then `switch-client -t =<view>`.

  Verify the tests fail with the current launcher.
- [x] 1.2 `renderLauncher`: build the view from a placeholder window, `link-window`, `select-window` and `kill-window -a`, with `destroy-unattached on`. Set `detach-on-destroy on` for the attaching paths (plain and nested) and `off` for `switch-client`. Verify the tests in 1.1 and the existing launcher tests pass, and `zsh -n` passes on the generated launchers.
- [x] 1.3 End-to-end test on a real tmux server with a throwaway socket, skipped without `tmux`. The launchers' session has three windows and a view is built with the launcher's own view commands. Check that:
  - the view lists only its window;
  - killing that window destroys the view while the other windows keep running;
  - a view whose client went away is destroyed, and its window keeps running in the launchers' session.

  Verify it passes.

## 2. Verification

- [x] 2.1 `pnpm check` green (typecheck, tests, Biome with warnings as errors). Locally the Go relay is left out, because this Mac has no Go toolchain; it runs in CI.
- [x] 2.2 On this computer (tmux 3.7a), on a throwaway tmux server, with a client attached through a pty. Before the fix, the view showed another window once its own closed. With the generated launcher, check three things:
  - exiting the agent ends the client and leaves the other windows running;
  - detaching keeps the window;
  - a client of the same server goes back to the session it was on.
- [ ] 2.3 Pending, on the user's terminals: with several sessions open, exiting one returns its terminal to the shell in Ghostty, iTerm2 and Terminal.app, and from inside the user's own tmux.
