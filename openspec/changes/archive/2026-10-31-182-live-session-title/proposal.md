## Why

A session started in the terminal shows up in the app named after its folder or its first slash command and keeps that name while it runs; the right name only appears after Resume (issue #474). While a session is live the daemon names it from hooks only: `UserPromptSubmit` takes the first prompt whatever it is, so `/clear` or `/model` becomes the title and, since it no longer equals the folder name, nothing replaces it. Hook payloads carry commands as typed (`/clear`), which `isCommandPrompt` did not recognise (it only knew the transcript's markup). A name given with `/rename` reached the app only while its transcript was being followed, and never from the backlog read when a conversation is opened. Resume goes through `extractMeta`, which applies the right precedence, hence the difference.

## What Changes

- **Title precedence while the session runs**, the same as `extractMeta`: a name (`/rename`, `--name`) wins over a prompt, a plain prompt wins over a slash command or shell line, anything wins over the folder name or raw markup; the first of a kind stays. `SessionService` remembers what gave each live session its title (`TitleSource`); `extractMeta` and the Claude Code `readSummary` report it.
- **Commands typed as is** (`/clear`, `!ls`) count as commands in hook payloads.
- **`/rename <name>`** names the session at once from the hook; a `custom-title` in the transcript does too, now through the service, including the one found in the backlog when a conversation is opened.
- Tests: `prompt-title` (raw commands, precedence, rename), `sessions` (SessionStart → `/clear` → "fix the tests" → `/rename`), `transcript meta` (title source), `transcript` (backlog name).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-registry`: the "Prompt-derived title" precedence holds while the session runs, not only when its transcript is read.

## Impact

`apps/daemon/src/features/sessions` (`prompt-title.ts`, `transcript-meta.ts`, `service.ts`), `features/agents/types.ts` (`titleSource`), `features/transcript` (`service.ts` backlog, `index.ts` wiring), `main.ts`. No protocol or app change.
