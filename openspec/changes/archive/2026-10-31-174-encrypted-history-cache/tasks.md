## 1. Storage

- [x] 1.1 `npx expo install expo-sqlite expo-crypto` (if missing); config plugin with `useSQLCipher: true` in `app.config.ts`
- [x] 1.2 `core/storage/history`: `SqlDatabase` port, schema/migrations (streams, entries, images, snapshots, FTS5 + triggers), `HistoryDb` queries (hydrate page, older page, write batch per sync plan, images, snapshots, LRU eviction, wipe)
- [x] 1.3 Opening with expo-sqlite: key from SecureStore (this device only), `PRAGMA key`, recreate on a bad key, cache directory; disabled in the demo
- [x] 1.4 Vitest against `node:sqlite`: writes/reads, duplicates, FTS query, eviction under the cap, wipe of one computer

## 2. Sync logic

- [x] 2.1 Pure `features/history/sync.ts` (extend/replace/restart/prepend rules) with tests
- [x] 2.2 Pure eviction plan and `searchText(entry)` with tests

## 3. Integration

- [x] 3.1 Active history bound to the active computer (open, switch, demo off); wipe on `forgetComputer` (forget and revoke)
- [x] 3.2 Conversation store: hydrate before subscribing, persist each batch / resume / older page, older entries from the cache first
- [x] 3.3 Images: read from the cache, write after a fetch, offline display
- [x] 3.4 Session list snapshot: write debounced, restore on start when no snapshot came yet
- [x] 3.5 Offline notice in the conversation; i18n pt-BR, en-US, es-ES

## 4. Verify

- [x] 4.1 `turbo run typecheck test`, Biome, `expo export --platform ios`
