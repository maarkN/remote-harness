## 1. App

- [x] 1.1 `retention.ts`: recent list, eviction beyond 3 closed streams, trimming to 500 entries (tests).
- [x] 1.2 Store: open counts, trim on close, evict, replace on a resume with `hasMore` (tests).
- [x] 1.3 Image cache 12 MB; link renderer per text.

## 2. Daemon

- [x] 2.1 `since` reports the gap; a resume replies `hasMore` with it (tests).

## 3. Validation

- [x] 3.1 `turbo run typecheck test`, Biome and `npx expo export --platform ios` green.
