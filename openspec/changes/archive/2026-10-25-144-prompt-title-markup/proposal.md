## Why

A session whose prompt was pasted shows the raw wrapper tag (`<pasted_content id=…>…`) as its name in the app list, the session header and the live status (#350). The `UserPromptSubmit` hook takes the prompt as is, and the transcript's last-prompt fallback does not skip markup either.

## What Changes

- One pure helper, `promptTitle()`, turns a prompt into a title without markup: the user's own words around pasted blocks; else the first line of the pasted content; for a slash command, the command and its arguments (`/review 123`); harness context (`<system-reminder>`, command output) never counts; nothing left → no title (the folder name stays).
- `UserPromptSubmit` and the transcript metadata (first prompt, then last prompt) both use it; a plain first prompt still wins over a first slash command.
- A title that is still raw markup is replaced on the next prompt, and on the next rescan (daemon restart, resume). Names given with `/rename` or from the app still win.

## Capabilities

### New Capabilities

### Modified Capabilities

- `session-registry`: a new requirement for titles derived from prompts.

## Impact

- `apps/daemon/src/features/sessions/prompt-title.ts` (new) with `prompt-title.test.ts`; `service.ts` (`UserPromptSubmit`), `transcript-meta.ts` (`extractMeta`); tests in `test/sessions.test.ts`.
- No protocol or app change.
