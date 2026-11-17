## 1. Launcher

- [x] 1.1 Tests first in `test/hooks.test.ts`: with the fake tmux, the window's command line starts with `cd -- <dir> && exec` and still ends with the agent's arguments (and `-- "$REMOTE_HARNESS_PROMPT"` with a first prompt), and the `new-session` that creates the launchers' session runs from the home folder while its `-c` is the launcher's directory; verify they fail
- [x] 1.2 `renderLauncher`: keep the launcher's directory in `dir`, prefix the window's command with `cd -- <dir> && exec`, and run the creating `new-session` from `$HOME` (`/` when unreachable); verify the tests in 1.1 and the existing launcher tests pass, and `zsh -n` on every generated launcher
- [x] 1.3 An end-to-end test (skipped without `tmux`): a real tmux server on a throwaway socket started from a temporary folder that is then deleted, a launcher run in another folder with `REMOTE_HARNESS_NO_ATTACH` and a fake agent that writes its working directory; the agent reports the launcher's folder. Verify it fails with the launcher from before 1.2 (stash) and passes after

## 2. Resume

- [x] 2.1 Tests first in `test/lifecycle.test.ts`: `resume` with a settle time whose pane is gone fails with `internal` "Claude Code exited right after starting (pane … closed)" (and "Codex …" for a Codex profile), does not link the session, and a later tap launches again; with the pane alive it links as before; verify they fail
- [x] 2.2 `LifecycleService`: one settle check shared by `start` and `resume`, run inside the launch `resume` keeps for repeated taps; verify the tests in 2.1 and the existing lifecycle tests pass
- [x] 2.3 `session.resume` handler logs `session resumed` (profile, session, pane) and `session.resume rejected` (profile, session, code, reason); a test with a capturing logger, or the handler's test if there is one; verify it passes

## 3. App

- [x] 3.1 Tests first: `resumeErrorMessage` (next to `startErrorMessage`) gives "Could not open Claude Code in tmux: <reason>" for `internal` (the session's agent, e.g. Codex), the New session screen's text for `invalid_cwd`, and the generic texts for the rest; verify they fail
- [x] 3.2 `resumeErrorMessage` and the Resume banner using it; verify the tests pass and the banner shows the error with the Resume button enabled again

## 4. Verification

- [x] 4.1 `pnpm check` green (typecheck, tests, Biome with warnings as errors); locally without the Go relay, which has no toolchain on this Mac and runs in CI
- [x] 4.2 On this computer (tmux 3.7a), with the launcher from this branch rendered for a real Claude Code profile: on a throwaway tmux server whose starting folder was deleted, `claude --resume <an old session>` stays running in the session's folder (before, it exited with "The current directory no longer exists"); the `session.resume` log lines are covered by the handler test (real router and pino logger)
- [ ] 4.3 Pending, on the phone: Resume and New session from the app after `remote-harness update` with this change
