# session-changes Specification

## Purpose
Review a session's working-tree changes against `HEAD` from the app (file list with counts, per-file diffs) without asking the agent.

## Requirements

### Requirement: Change list
`changes.list { sessionId }` SHALL answer `changes.result` with the root and branch of the git checkout that contains the session's folder (worktrees included) and its files changed against `HEAD` (against the empty tree before the first commit): staged, unstaged and untracked files (ignored files left out). Each file SHALL carry its path relative to the root, the previous path when renamed, the status (`added`, `modified`, `deleted`, `renamed`; untracked files are `added`), the added and deleted line counts (`null` when unknown), `binary`, and `generated` for lockfiles and generated output (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, other common lockfiles, `*.generated.*`, `*.min.js`, `*.map`, files under `dist/` or `build/`). A folder outside git answers `root: null` and no files. Every git call MUST go through `infra/git.ts`. It is answered whatever the session is doing.

#### Scenario: Modified, renamed and untracked files
- **WHEN** the session's checkout has `src/a.ts` edited (3 lines added, 1 removed), `old.ts` renamed to `new.ts` and an untracked `notes.md` of 4 lines
- **THEN** `changes.result` lists `src/a.ts` modified `+3 −1`, `new.ts` renamed from `old.ts`, and `notes.md` added `+4 −0`

#### Scenario: Outside git
- **WHEN** the session's folder is not in a git checkout
- **THEN** the reply has `root: null` and an empty file list

### Requirement: File diff
`changes.diff { sessionId, path, offset? }` SHALL answer `changes.diffResult` with the unified diff of that file against `HEAD` (an untracked file as a whole addition), as lines starting at `offset` (default 0), at most 2,000 per reply, with the diff's total line count. The path MUST be one of the session's current change list; any other path is rejected with `not_found`. A binary file answers `binary: true` and no lines.

#### Scenario: Paged diff
- **WHEN** a file's diff has 2,500 lines and the app asks without an offset, then with `offset: 2000`
- **THEN** the first reply has lines 0–1999 and `total: 2500`, the second lines 2000–2499

#### Scenario: Path outside the list
- **WHEN** the app asks for the diff of `../../etc/passwd`
- **THEN** the daemon answers `not_found` and runs no diff

### Requirement: Changes screen
"Changes" in the session's More options menu SHALL open a screen with the checkout's branch and the changed files (status, path, `+added −deleted`). Each file's diff is loaded when the file is expanded and shown with additions and deletions colored. Files that are `generated`, or whose diff passes 400 changed lines, start collapsed with only the counts; binary files show "binary changed" without a diff. Past 2,000 lines a "Show the rest" button loads the next page. The screen SHALL refresh when the session changes (throttled) and on pull to refresh. Outside git it says so; an older daemon shows a "not supported" note.

#### Scenario: Generated file collapsed
- **WHEN** the change list has `pnpm-lock.yaml` and `src/a.ts` with 10 changed lines
- **THEN** `src/a.ts` shows its diff and `pnpm-lock.yaml` only its counts until tapped
