## Why

No session opens from the app once the folder the Remote Harness tmux server started in is deleted (#606). Resume shows "Opening in the computer's tmux" and nothing opens; New session fails with "Claude Code exited right after starting". The server inherits the working directory of the first launcher that started it (here `~/workspaces/go-app-v2`, deleted later), and once that directory is gone tmux 3.7a ignores `new-window -c <dir>`: every new pane starts in the deleted directory (`PWD=.`, `getcwd` fails with `ENOENT`), Claude Code exits at once with "The current directory no longer exists (it was deleted or moved)" and the window closes with it. Reproduced on a throwaway tmux server: `-c` works until the server's starting folder is removed, then every new window lands there; a `cd` inside the window's command, or changing the live server's directory, fixes it. On top of that, `session.resume` never checks that the pane survived, so the app reported success for a window that had already closed, and the daemon logged nothing.

## What Changes

- The launcher's window command changes to the session's directory itself (`cd -- <dir> && exec <agent> …`), so the agent starts in the right folder whatever the tmux server's own directory is. `-c <dir>` stays, for tmux's own idea of the pane's path.
- When no launchers' session exists yet, the launcher creates it (which may start the tmux server) from the home folder, falling back to `/`, so a new server never lives in a project folder that can be deleted.
- `session.resume` runs the same settle check as `session.start`: when the pane is gone shortly after the launcher returns, it replies `error` `internal` "<agent> exited right after starting (pane … closed)" instead of `ack`. Resumes are logged like starts: accepted with the profile, session and pane, rejected with the code and reason.
- The app's Resume banner explains a failed resume the way the New session screen explains a failed start: "Could not open <agent> in tmux: <reason>" for `internal`, and the New session screen's text for a folder that no longer exists (`invalid_cwd`), instead of the generic "Something went wrong on <computer>".
- Tests: the generated launcher with a fake tmux (the `cd` in the window's command, the session created from the home folder), an end-to-end launcher run on a real tmux server whose starting folder was deleted (skipped without tmux), `LifecycleService.resume` when the pane closes right away, and the Resume banner's error text.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `launchers`: "Open session in tmux" — the window changes to the session's directory itself, and a new server is started from the home folder.
- `session-lifecycle`: "Resume session" — the settle check, the error, its text on the Resume banner and the log lines of a resume.

## Impact

- Daemon: `features/hooks/launcher.ts` (window command, session creation), `features/lifecycle/service.ts` (settle check shared by start and resume), `features/lifecycle/index.ts` (resume log lines), tests in `test/hooks.test.ts` and `test/lifecycle.test.ts`.
- App: `features/lifecycle/ResumeBanner.tsx` and a pure `resumeErrorMessage` next to `startErrorMessage`, reusing the existing `newSession.errors.*` texts (no new i18n keys). JavaScript only, so it can ship over the air.
- Existing computers get the new launchers on the next `remote-harness update` (it rewrites them through `install`). A tmux server already running in a deleted folder keeps that folder, but the launchers' `cd` no longer depends on it.
- No protocol change.
