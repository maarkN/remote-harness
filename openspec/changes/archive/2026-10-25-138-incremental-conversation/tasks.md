## 1. Store

- [x] 1.1 `createBatcher`: one store update per frame for live entries; flush before resubscribing and on unsubscribe (tests).
- [x] 1.2 `mergeEntries` append path keeping existing entries (tests).
- [x] 1.3 `extendTimeline` kept in the stream state, equal to `buildTimeline` at every step (tests for live turns, older pages, late calls).

## 2. Screen

- [x] 2.1 Conversation reads the store's timeline; prompt history built only while its sheet is open; tool diffs cached per call (tests).

## 3. Validation

- [x] 3.1 `turbo run typecheck test`, Biome and `npx expo export --platform ios` green.
