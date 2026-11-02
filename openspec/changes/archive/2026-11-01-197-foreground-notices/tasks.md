## 1. Logic

- [x] 1.1 `features/notices/select.ts`: `finishedSessions`, `requestKind`, `isFresh`, `announces`, `noticeFor`; tests
- [x] 1.2 `features/notices/store.ts` (current notice, the session on screen, show / dismiss) and `use-notices.ts` (store diffs, haptic by the push toggle)

## 2. UI

- [x] 2.1 `NoticeBanner.tsx`: top banner with icon, texts and Dismiss, tap opens the session, auto-dismiss, reanimated in/out; mounted with the hook in the main layout
- [x] 2.2 i18n pt-BR, en-US, es-ES (`notices.*`)

## 3. Verify

- [x] 3.1 `turbo run typecheck test`, Biome, `expo export --platform ios`
