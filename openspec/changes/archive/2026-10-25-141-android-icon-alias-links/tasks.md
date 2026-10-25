## 1. Deep links on the icon aliases

- [x] 1.1 Add `copyMainActivityFiltersToAliases` and the `withIconAliasDeepLinks` manifest plugin in `app.config.ts`; verify after `expo prebuild` that every `MainActivity<Theme>` alias has the `remoteharness` / `claude-remote` filter
- [x] 1.2 Vitest for the transform (copy, idempotence, no shared objects, other aliases untouched) in `scripts/app-config.test.ts`

## 2. Apply the icon only when the user leaves

- [x] 2.1 `withUserLeaveHintMainActivity` plugin: `MainActivity` emits `remoteHarnessUserLeaveHint` on stop after a user leave hint with no activity of its own started; verify the generated `MainActivity.kt` compiles in a release build
- [x] 2.2 `useApplyAppIcon` listens to that event on Android instead of `AppState`; Vitest that both sides use the same event name

## 3. Verification

- [x] 3.1 Android emulator, release build, fresh install: the camera prompt on the pairing screen leaves the app open and the icon unchanged; Home then switches to the Dark alias; turning the screen off does not switch; `resolve-activity` for `remoteharness:///` and `claude-remote://pair` resolves to the enabled alias
- [x] 3.2 `turbo run typecheck test` and Biome green
