## 1. Title helper

- [x] 1.1 `promptTitle()` and `isCommandPrompt()` in `sessions/prompt-title.ts`, with Vitest cases in `test/prompt-title.test.ts`: plain text, text + pasted block, only a pasted block, `<command-name>` with and without args, `<system-reminder>`, unclosed blocks, empty.

## 2. Callers

- [x] 2.1 `UserPromptSubmit`: title from `promptTitle()` while the title is the folder name or raw markup; a prompt with no title leaves it (tests in `sessions.test.ts`).
- [x] 2.2 `extractMeta`: first plain prompt, else first command, else last prompt, all through `promptTitle()`; a custom title still wins (tests).

## 3. Validation

- [x] 3.1 `turbo run typecheck test` and Biome green.
