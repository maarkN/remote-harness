## Why

Users type the same prompts again and again ("review this PR", "run the tests and fix what fails", "write the release notes") and there is no way to save and reuse them from the phone (#431). With the first prompt at start in place (#430), a saved prompt is also the natural way to start a session.

## What Changes

- Prompt templates saved on the device: a title and a text with placeholders (`{branch}`, `{folder}`, `{cwd}`, `{date}` filled in by the app; any other one asked when the template is used). Created, edited and deleted in Settings → Prompt templates.
- A templates picker in the conversation: "Prompt templates…" in the session options menu and a `{}` button in the keyboard toolbar; picking one appends the filled text to the prompt draft. The picker also saves the current prompt as a template and opens the management screen.
- "Use a template…" under the First prompt field of the New session screen, with the directory's branch and path as the placeholder context.
- Templates stay on the phone: secure storage, this device only, never sent to the daemon except as a prompt the user sends; they survive forgetting a computer. Sync with an account is out of scope (#420).

## Capabilities

### New Capabilities

- `prompt-templates`: storage and limits, placeholders, the picker in the composer and on the New session screen.

### Modified Capabilities

- `app-conversation`: "Session options menu" gains "Prompt templates…".
- `session-lifecycle`: "First prompt field on the New session screen" gains the "Use a template…" button.

## Impact

- App only: `apps/mobile/src/features/templates/` (pure logic with tests, store with secure persistence, picker sheet, editor, management screen, settings card), route `src/app/(main)/templates.tsx`, the session menu, the keyboard toolbar and composer props, the session route, the New session screen, the root layout (restore at start); i18n in pt-BR, en-US and es-ES.
- No protocol or daemon change; no native dependency (ships over the air).
