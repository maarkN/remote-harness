## Why

Reviewing what an agent changed means asking it (tokens and context) or opening tool cards one at a time: the app shows diffs only per Edit/apply_patch call, and worktrees only report a dirty-file count (#369). A per-session view of the working tree against `HEAD` makes the review cheap and always available.

## What Changes

- Protocol: `changes.list { sessionId }` → `changes.result` (the checkout root and branch, and the files changed against `HEAD`: status added/modified/deleted/renamed, line counts, binary and generated flags) and `changes.diff { sessionId, path, offset? }` → `changes.diffResult` (the file's unified diff in pages of 2,000 lines).
- Daemon: a `changes` feature; every git call goes through `infra/git.ts` (`git diff HEAD -M --name-status/--numstat -z`, `git ls-files --others --exclude-standard -z`, per-file `git diff`, `--no-index` for untracked files). Untracked files are counted by the daemon (binary when they hold a NUL byte). A diff is only served for a path of the current change list.
- App: **Changes** in the session's "More options" menu opens a screen with the file list (status, `+n −m`), each file's diff on demand, lockfiles and generated files (`pnpm-lock.yaml`, `*.generated.ts`, `dist/`, …) and large diffs collapsed with only the counts, "binary changed" for binary files, and "Show the rest" past the page. It refreshes when the session changes and on pull.
- Available whatever the session is doing (no state gate). Commit, push and PR come in #370.

## Capabilities

### New Capabilities

- `session-changes`: reviewing (and, with #370, committing) a session's working-tree changes from the app.

### Modified Capabilities

_None._

## Impact

- `packages/protocol`: `ChangedFileSchema`, the two request/reply pairs.
- `apps/daemon`: `infra/git.ts` (parsers + `changes`/`fileDiff`), new `features/changes`, wiring in `main.ts`.
- `apps/mobile`: route `session/[id]/changes`, `src/features/changes` (hook, screen, pure diff parsing), menu item, i18n in pt-BR, en-US and es-ES.
