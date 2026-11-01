## 1. Sections and summaries

- [x] 1.1 `features/settings/sections.ts`: section keys, routes, `settingsSections(snapshot, t)` with the row summaries; `sections.test.ts` covers the order, the demo, and each summary in en-US and pt-BR (`pnpm --filter @remote-harness/mobile exec vitest run src/features/settings`)
- [x] 1.2 `SettingsScreen` becomes the sections list (icon, title, summary, chevron; version under the list), reading the stores into the snapshot

## 2. Section screens and routes

- [x] 2.1 `features/settings/SettingsSections.tsx`: `SettingsSectionScreen` and one screen per section composing the existing cards (demo rules kept); `PermissionsCard.tsx` removed
- [x] 2.2 Routes `src/app/(main)/settings/{index,computer,devices,appearance,profiles,sessions,notifications,voice,app}.tsx` replacing `settings.tsx`; the main layout registers them with the section titles; typecheck and `npx expo export --platform ios` pass

## 3. Texts, prototype and verification

- [x] 3.1 i18n `settings.sections.*` and `settings.summary.*` in pt-BR, en-US, es-ES; parity test passes
- [x] 3.2 `docs/design/identity/screens/settings-sections.html` (the list and the Notifications section) rendered to `settings-sections.png` with headless Chrome; `manifest.tsv` updated
- [x] 3.3 `pnpm turbo run typecheck test`, Biome (worktree ignore tweak), `openspec validate 192-settings-sections --strict`
