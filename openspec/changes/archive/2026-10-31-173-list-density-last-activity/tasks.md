## 1. Protocol

- [x] 1.1 `LastActivitySchema` and `lastActivity` (nullable, default `null`) on `SessionSchema`
- [x] 1.2 Pure `previewText` and `lastActivityOf` in `packages/protocol/src/last-activity.ts`, exported, with Vitest tests (markdown, cut, tool targets, skipped kinds, sidechain, fallback time)

## 2. Daemon

- [x] 2.1 `readTailEntries(path, format, bytes)` in the transcript feature (partial first line dropped), with tests
- [x] 2.2 `features/last-activity`: tracker with a 3 s throttle and trailing refresh, triggered by store changes and hook events, keeping `updatedAt`; tests with fake timers
- [x] 2.3 Wire it in `main.ts` (transcript feature exposes the tail reader); `lastActivity: null` in every record the sessions service creates
- [x] 2.4 Check push payload builders never read `lastActivity`

## 3. App

- [x] 3.1 Density store (`compact` default, persisted) restored at app start
- [x] 3.2 Expanded preview line in `SessionRow` (kind icon, two lines, relative time, accessibility label)
- [x] 3.3 Density chip after the sort chip (header row and filters sheet) and a switch in Settings → Appearance
- [x] 3.4 i18n keys in pt-BR, en-US and es-ES
- [x] 3.5 Offline demo: `lastActivity` from the fixture transcripts, refreshed when the demo appends entries; demo test

## 4. Verify

- [x] 4.1 `turbo run typecheck test` and Biome green; `expo export --platform ios` bundles
