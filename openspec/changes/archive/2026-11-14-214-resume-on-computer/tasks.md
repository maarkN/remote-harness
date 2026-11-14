## 1. Cause

- [x] 1.1 Reproduce on the computer with Claude Code 2.1.318, default profile, in a test repository with the daemon's arguments (`--worktree`, `--name`, hooks off): no first prompt → no transcript and "No conversations found"; with a prompt, kept and removed worktree → listed by `claude -r` at the repository root and resumable; write the cause in the proposal and on the issue

## 2. Protocol and daemon

- [x] 2.1 `resumeArgs(agent, sessionId)` in `packages/protocol` with a test per agent (Vitest first); verify it passes
- [x] 2.2 The five adapters' `resumeArgs` call it; verify the daemon's lifecycle and agent tests pass unchanged

## 3. App

- [x] 3.1 Tests first in `features/sessions/details.test.ts`: the `resume` row (Claude Code in a worktree, Codex with a folder with spaces, a folder with a quote, Kimi), copyable, after the session id; verify they fail
- [x] 3.2 `resumeCommand` (pure, shell-quoting the folder) and the `resume` row in `sessionDetails`, keys `sessionDetails.labels.resume` and `sessionDetails.copyLabels.resume` in pt-BR, en-US and es-ES; verify the tests of 3.1 and the i18n parity tests pass

## 4. Docs

- [x] 4.1 `using-the-app.md` (en-US, pt-BR, es-ES), Starting, resuming and closing sessions: resuming an app-started session on the computer (first prompt, the profile's alias, folder or repository root, the command in Session details); verify the web docs tests pass

## 5. Verification

- [x] 5.1 `turbo run typecheck test` (all packages but the Go relay) and Biome green
- [x] 5.3 On the iOS simulator (iPhone SE, pt-BR, Release build, demo): Session details shows "Retomar no computador" with `cd /Users/demo/code/design-system && openrouter --resume <id>` and Copiar, after the session id
- [ ] 5.2 Pending, on a phone: Session details of a session started from the app shows the command; copied and run in a terminal on the computer, it reopens the session, for the default profile and for another one
