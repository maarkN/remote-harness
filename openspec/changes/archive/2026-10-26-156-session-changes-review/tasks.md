## 1. Protocol

- [x] 1.1 `ChangedFileSchema`, `CHANGES_DIFF_PAGE`; `changes.list` / `changes.result`, `changes.diff` / `changes.diffResult`; samples in the protocol tests

## 2. Daemon

- [x] 2.1 `infra/git.ts`: `parseNameStatus`, `parseNumstat`, `isGeneratedPath`, `GitClient.changes` and `GitClient.fileDiff`; Vitest for the parsers and the git calls (fake executor)
- [x] 2.2 `features/changes`: untracked line counting (`textStats`), list and paged diff with the path check; handlers; wiring in `main.ts`
- [x] 2.3 Tests: a real temporary repository (modified, renamed, deleted, untracked, binary), paging, path outside the list, folder outside git

## 3. App

- [x] 3.1 Pure helpers: unified diff → `DiffLine[]`, initial collapse rule, status labels; Vitest
- [x] 3.2 `useChanges` hook (list, per-file pages, throttled refresh on session changes)
- [x] 3.3 Changes screen and route `session/[id]/changes`; "Changes" in More options
- [x] 3.4 i18n strings in pt-BR, en-US and es-ES; web docs (using the app) in the three languages

## 4. Verify

- [x] 4.1 `turbo run typecheck test` and Biome green
- [x] 4.2 `npx expo export --platform ios` bundles
