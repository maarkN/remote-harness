## 1. Protocol

- [x] 1.1 Add `TranscriptSearchHitSchema` and the search constants to `domain.ts`, `transcript.search` to the client schema and `transcript.searchResult` to the server schema, and verify a protocol test parses a request with defaults and a reply
- [x] 1.2 Move `searchText()` into `packages/protocol/src/search-text.ts` (exported from the package) and make the app's `search-text.ts` re-export it, and verify the app's `search-text.test.ts` and typecheck still pass (the offline demo answers the new request with an empty page)

## 2. Daemon

- [x] 2.1 `features/search/match.ts`: `fold`, `queryTerms`, `matchRanges` (whole word, case- and accent-insensitive, all terms required) and `snippetAround`, and verify the unit tests in `apps/daemon/test/search.test.ts` pass
- [x] 2.2 `features/search/service.ts`: `TranscriptSearch.search()` reading each session's transcript through its format, newest first, with the cursor codec and both page bounds, and verify the service tests (ordering, paging, one session, unknown session, missing file, transcript cap, repeated keys) pass
- [x] 2.3 `features/search/index.ts` registering `transcript.search` with count-only logging, wired in `main.ts`, and verify `pnpm --filter @remote-harness/daemon typecheck` passes

## 3. Verification

- [x] 3.1 `pnpm turbo run typecheck test` and Biome on the worktree are green
