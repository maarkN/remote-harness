## 1. Expo project slug

- [x] 1.1 `slug: 'remote-harness'` in `app.config.ts`

## 2. Live-status deep links

- [x] 2.1 App (`logic.ts`, `use-live-status.ts`): construct `remoteharness://session/<id>` links; keep `sessionIdFromActivityUrl` accepting both schemes
- [x] 2.2 Daemon (`features/live-status/index.ts`): construct `remoteharness://session/<id>` for both the `link` prop and the push-to-start `url`
- [x] 2.3 Update the tests that assert the old literal

## 3. App storage keys

- [x] 3.1 `updates.ts`, `voice-language-store.ts`, `voice-interaction-store.ts`, `voice-polish-store.ts`: new `remote-harness.*` key, migrated from the old `claude-remote.*` key on first read, through a shared `readMigratedKey` helper in `core/storage/migrate-key.ts`
- [x] 3.2 No new Vitest coverage for the SecureStore call sites themselves — same as `credentials.ts`'s own untested legacy-key migration, since `expo-secure-store` is a native module Vitest doesn't exercise here

## 4. Verify

- [x] 4.1 `pnpm turbo run typecheck test`; `npx biome check --error-on-warnings apps packages openspec`; `openspec validate app-identity-finish --strict`
