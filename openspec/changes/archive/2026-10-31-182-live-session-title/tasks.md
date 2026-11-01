## 1. Title precedence

- [x] 1.1 `prompt-title.ts`: raw commands (`/…`, `!…`) count as commands; `TitleSource`, `replacesTitle()`, `promptTitleSource()`, `renameTitle()` with tests
- [x] 1.2 `extractMeta` reports `titleSource`; `TranscriptSummary.titleSource` (Claude Code adapter), with tests
- [x] 1.3 `SessionService` remembers each live session's title source: `SessionStart` and `restore()` from the summary, `UserPromptSubmit` replaces only a weaker title, `/rename <name>` names at once, `setCustomTitle()` for names from the transcript; test SessionStart → `/clear` → `/model` → "fix the tests" → `/rename`

## 2. Names from the transcript

- [x] 2.1 `TranscriptService.open()` applies the backlog's latest `custom-title`; the transcript feature hands names to `SessionService.setCustomTitle` (`main.ts`), with a test

## 3. Verification

- [x] 3.1 Daemon typecheck, tests and Biome; to check on a computer: a terminal-started session named from its first plain prompt and renamed with `/rename` while the app lists it
