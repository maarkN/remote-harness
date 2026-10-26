# session-changes Specification

## Purpose
Review a session's working-tree changes against `HEAD` from the app (file list with counts, per-file diffs) without asking the agent.

## Requirements

### Requirement: Change list
`changes.list { sessionId }` SHALL answer `changes.result` with the root and branch of the git checkout that contains the session's folder (worktrees included) and its files changed against `HEAD` (against the empty tree before the first commit): staged, unstaged and untracked files (ignored files left out). Each file SHALL carry its path relative to the root, the previous path when renamed, the status (`added`, `modified`, `deleted`, `renamed`; untracked files are `added`), the added and deleted line counts (`null` when unknown), `binary`, and `generated` for lockfiles and generated output (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, other common lockfiles, `*.generated.*`, `*.min.js`, `*.map`, files under `dist/` or `build/`). The reply SHALL also carry what the commit, push and PR actions need: the `origin` remote URL without credentials (`null` without one), the default branch (`origin/HEAD`, `null` when unknown), the number of commits not on any remote, and whether `gh` is installed. A folder outside git answers `root: null` and no files. Every git call MUST go through `infra/git.ts` and every `gh` call through `infra/github.ts`. It is answered whatever the session is doing.

#### Scenario: Modified, renamed and untracked files
- **WHEN** the session's checkout has `src/a.ts` edited (3 lines added, 1 removed), `old.ts` renamed to `new.ts` and an untracked `notes.md` of 4 lines
- **THEN** `changes.result` lists `src/a.ts` modified `+3 −1`, `new.ts` renamed from `old.ts`, and `notes.md` added `+4 −0`

#### Scenario: Remote without credentials
- **WHEN** `origin` is `https://user:token@github.com/acme/app.git`
- **THEN** the reply's remote is `https://github.com/acme/app.git`

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

### Requirement: Commit from the app
`changes.commit { sessionId, paths, message, newBranch?, force? }` SHALL commit exactly the selected files of the change list (a rename takes its old path along; other files, staged or not, stay as they are) with the message, running the repository's hooks. Paths outside the change list and an empty message are rejected with `bad_request`. With `newBranch`, the daemon first creates and switches to that branch (a name `git check-ref-format --branch` refuses, or one that exists, is `bad_request`). It answers `changes.committed` with the new commit's short hash and the branch.

#### Scenario: Partial commit
- **WHEN** the change list has `a.ts` and `b.ts` (with `b.ts` already staged by the agent) and the app commits only `a.ts`
- **THEN** the commit holds `a.ts` only and `b.ts` is still staged

#### Scenario: New branch from the default branch
- **WHEN** the session is on `main` and the app commits with `newBranch: "fix-login-redirect"`
- **THEN** the commit is on the new branch `fix-login-redirect` and `main` is unchanged

### Requirement: Push and pull request from the app
`changes.push { sessionId, force? }` SHALL push the current branch to `origin`, creating its upstream, and answer `changes.pushed` with the branch and GitHub's "compare & open PR" URL when `origin` is on GitHub (`null` otherwise). `changes.pr { sessionId, title, body, force? }` SHALL push, then open a pull request with `gh pr create` against the default branch and answer `changes.prOpened` with its URL; without `gh` it is rejected with `not_found` (the app then pushes and shows the compare link). A detached HEAD is rejected with `bad_request`.

#### Scenario: Pull request with gh
- **WHEN** `gh` is installed and the app sends `changes.pr` on branch `fix-login-redirect`
- **THEN** the branch is pushed and the reply carries the PR URL `gh` printed

#### Scenario: Push without gh
- **WHEN** `gh` is not installed and `origin` is `git@github.com:acme/app.git`
- **THEN** `changes.pushed` carries `https://github.com/acme/app/compare/fix-login-redirect?expand=1`

### Requirement: Generated messages
`changes.generate { sessionId, kind, paths? }` SHALL propose a commit message (`kind: "commit"`, from the diff of the selected paths) or a PR title and body (`kind: "pr"`, from the commits and the diff stat against the default branch) through the session profile's agent CLI, the one the voice polish uses (Claude Code `-p` with a small model and no tools; the diff goes in on standard input, cut at 60,000 characters). It answers `changes.generated { title, body }`. A profile whose agent has no such CLI call, or one routed through a model provider, is rejected with `not_found`; a failed call with `internal`. Nothing of the diff is logged.

#### Scenario: Commit message
- **WHEN** the app asks for a commit message for `src/login.ts`
- **THEN** the reply has a one-line title and an optional body written from that file's diff

### Requirement: Session state gate
Commit, push and PR SHALL be refused with `session_busy` while the session is `running`, unless the request has `force: true`; they are allowed while it is `idle`, `waiting` or `ended`. These are fixed daemon operations, not shell commands: they do not depend on `shellCommands.enabled`.

#### Scenario: Agent working
- **WHEN** the app sends `changes.commit` without `force` while the session is running
- **THEN** the daemon answers `session_busy` and commits nothing

### Requirement: Commit, push and PR in the app
The Changes screen SHALL let the user pick files (all selected by default; generated files included) and type a commit message, with **Generate** filling it. **Commit**, **Push** and **Open PR** each open a confirmation sheet with the files (for a commit), the branch and the remote. On the default branch the commit confirmation offers to create a new branch first, named from the message's first line. Pushing to `main` or `master` adds a warning. Open PR fills a title and body (Generate available) and, without `gh`, pushes and offers GitHub's compare link instead. While the session is running the buttons are disabled with "Wait for the agent to finish", and a "Do it anyway" link sends the action with `force` after a warning.

#### Scenario: Commit on main
- **WHEN** the session is on `main` (the default branch) and the user taps Commit
- **THEN** the sheet lists the selected files, shows `main` and `origin`, and offers "Create branch fix-login-redirect first"

#### Scenario: Agent working
- **WHEN** the session is running
- **THEN** Commit, Push and Open PR are disabled with "Wait for the agent to finish" and "Do it anyway"
