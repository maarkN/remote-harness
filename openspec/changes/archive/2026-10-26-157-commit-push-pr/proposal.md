## Why

After reviewing a session's changes (#369) the loop still closes on the computer: committing, pushing and opening the PR (#370). The worktree clean-up already commits and pushes (`commitAll`/`push` in `infra/git.ts`), so the plumbing exists; the app needs a reviewed, deliberate version of it.

## What Changes

- Protocol: `changes.commit` → `changes.committed`, `changes.push` → `changes.pushed`, `changes.pr` → `changes.prOpened`, `changes.generate` → `changes.generated`; `changes.result` gains the `origin` URL (credentials stripped), the default branch, the unpushed count and whether `gh` is installed.
- Daemon: partial commits of the selected files (hooks run), optional new branch first, push with upstream, PR through `gh pr create` (new `infra/github.ts`), GitHub compare link otherwise; commit message and PR title/body generated through the profile's agent CLI (the voice polish's call, with the diff on standard input). A session-state gate: refused with `session_busy` while the session is running, unless `force`.
- App: on the Changes screen, file selection, a message field with **Generate**, **Commit**, **Push** and **Open PR**, each behind a confirmation sheet (files, branch, remote); "create a branch first" on the default branch, a warning when pushing to `main`/`master`, the compare link without `gh`; disabled while the agent works, with "Do it anyway".
- Fixed daemon operations, not shell commands: no `shellCommands.enabled` gate.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `session-changes`: the change list carries remote/branch info; commit, push, PR, generated messages and the session-state gate.

## Impact

- `packages/protocol`: four request/reply pairs, fields on `changes.result`.
- `apps/daemon`: `infra/git.ts` (partial commit, branch, remotes, log), `infra/github.ts`, `features/changes` (actions, gate, generation), `features/agents` (one-shot prompt args).
- `apps/mobile`: Changes screen actions and sheets, pure helpers (branch name, compare URL display, gate), i18n in pt-BR, en-US and es-ES, web docs.
