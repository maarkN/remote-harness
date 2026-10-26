## Context

#369 added `features/changes` (`ChangesService.list/diff`) and `GitClient.changes/fileDiff`. `GitClient.commitAll` (`--no-verify`) and `push` serve the worktree clean-up. The voice polish runs the profile's agent CLI one-shot (`claude -p … --model haiku --output-format json --allowedTools ''`).

## Goals / Non-Goals

**Goals:** commit exactly what the user picked; never touch other staged work; one gate for "agent busy" enforced by the daemon; nothing of the diff or the messages in logs.

**Non-Goals:** amend, rebase, pull, merge, choosing the PR base, non-GitHub hosting providers' PR APIs, signing configuration.

## Decisions

- **Partial commit with `--only`.** `git add -A -- <paths>` (untracked and deleted files of the selection, renames with their old path) then `git commit -m <message> --only -- <paths>`: git commits the selected paths' state and leaves the rest of the index alone. Hooks run (this is a reviewed commit, unlike the clean-up's save) with a 2-minute timeout. Alternative — reset the index first: rejected, it would discard what the agent staged.
- **New branch from the app.** The app proposes `branchNameFrom(message)` (lowercase words of the first line, `-` joined, 40 characters); the daemon checks it with `git check-ref-format --branch` and that it does not exist, then `git switch -c`. The default branch comes from `origin/HEAD`; without it the app treats `main`/`master` as the default.
- **Push / PR.** `git push -u origin HEAD` (existing). `gh` lives in `infra/github.ts` (`which gh`, `gh pr create --title --body --head <branch> [--base <default>]`, 60 s, URL = last line of stdout). The compare URL comes from a pure `githubCompareUrl(remote, branch)` for `https://`, `ssh://` and scp-like remotes; the remote URL loses any `user:password@` before it leaves the daemon.
- **Generation.** The agent adapter's polish call becomes a generic one-shot (`oneShot.args(prompt, systemPrompt)`); polish keeps its prompt. Commit: the selected paths' diff; PR: `git log <default>..HEAD` subjects and bodies plus `git diff --stat <default>...HEAD`. The input is cut at 60,000 characters and passed on standard input; 45 s timeout. The reply's first line is the title, the rest the body.
- **Gate in the daemon, mirrored in the app.** Pure `actionAllowed(state, force)`; the app disables the buttons from the same session state and sends `force` after "Do it anyway".

## Risks / Trade-offs

- [A pre-commit hook that waits for input] → the 2-minute timeout ends it; git's message reaches the app.
- [`gh` not logged in] → `gh`'s error reaches the app; the compare link stays available after a push.
- [The agent CLI writes a poor message] → it only fills the field; the user edits before committing.
