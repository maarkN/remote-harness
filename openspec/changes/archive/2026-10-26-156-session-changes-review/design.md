## Context

`infra/git.ts` (`GitClient`) is the only place that runs git; it already answers `checkout(dir)` and `worktreeInfo(dir)`. The app renders `DiffLine[]` with `DiffView` (conversation tool cards).

## Goals / Non-Goals

**Goals:** a cheap list call (no diff text), diffs fetched per file and paged, no file outside the change list ever read.

**Non-Goals:** staging, committing and pushing (#370); diffs against a base branch; word-level diffs; watching the file system from the daemon.

## Decisions

- **Two diff calls, merged by path.** `git diff <base> -M --name-status -z` gives status and rename pairs, `git diff <base> -M --numstat -z` the counts (`-` for binary). Both parsers are pure and tested. `<base>` is `HEAD`, or git's empty tree when the repository has no commit yet. Alternative `git status --porcelain=v2` — rejected: no line counts.
- **Untracked files counted by the daemon.** `git ls-files --others --exclude-standard -z` lists them; the feature reads each (up to 1 MiB; bigger ones get `null` counts) and counts lines, binary when the first 8 KiB hold a NUL byte. Running `git diff --no-index` per file only to count would cost one process per file.
- **Diff paging on raw lines.** The daemon runs the per-file diff, splits it into lines and returns a page (2,000) with the total; the app parses the unified diff (`diff --git`/`index`/`---`/`+++` headers dropped, `@@` as a separator). Untracked files use `git diff --no-index -- /dev/null <path>` (exit code 1 means "differences").
- **Path check.** `changes.diff` recomputes the list and serves only a listed path, so `--no-index` can never read an arbitrary file.
- **Generated detection in the daemon** (`isGeneratedPath`, a fixed table with tests), so the app and #370 share one answer.
- **Refresh from the app.** The screen re-asks when the session's `updatedAt`/`state` change (at most every 3 s) and on pull; no daemon file watcher.

## Risks / Trade-offs

- [Huge repositories make `git diff` slow] → 15 s timeout per call; the error reaches the app as a message.
- [A diff of a huge file is big to produce] → only paged out to the app; the daemon still holds it once per request, acceptable for a personal tool.
