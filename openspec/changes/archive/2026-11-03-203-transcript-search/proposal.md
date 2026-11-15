## Why

The session search only matches titles and folders (#372): there is no way to find what was said in a conversation. The device half of that search has its index since #361 (the history cache's FTS5 table), but only over the entries the device has already cached. The computer holds every transcript, so the daemon must be able to answer "where was X said?" over all of them; the issue's own plan starts with the protocol message and the daemon search, which this change delivers. The app's sections and find-in-conversation come in a follow-up change on the same issue.

## What Changes

- New request `transcript.search { query, sessionId?, limit, cursor? }` and reply `transcript.searchResult { hits, nextCursor, scanned }` in `@remote-harness/protocol`, with the hit shape (`TranscriptSearchHitSchema`).
- The daemon searches the transcripts of the sessions it knows, newest session first and newest entry first inside each, or only one session's, through each agent's transcript format (`parser.ts` and its siblings stay the only code that knows the `.jsonl` lines). Pages are bounded in hits and in transcripts read; `nextCursor` continues them.
- Matching is whole-word, case- and accent-insensitive, over the same text the device indexes: `searchText()` moves from the app into the protocol package so both halves agree on what is searchable.
- Each hit carries the entry (`key`, `cursor`, `index`, `kind`, `timestamp`) and a snippet with the matched words' offsets, so the app can list highlighted snippets and open the session at the entry.
- The daemon logs only counts for a search, never the query or the hits.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `transcript-stream`: a new requirement, "Transcript search", for the request, its ordering, paging, the hit contents and the privacy rule.

## Impact

- `packages/protocol/src/{domain,client,server,index}.ts`, new `search-text.ts`.
- `apps/daemon/src/features/search/` (new: `match.ts`, `service.ts`, `index.ts`), registered in `main.ts`.
- `apps/mobile/src/core/storage/history/search-text.ts` re-exports the protocol function (no behaviour change in the app).
- Tests: `apps/daemon/test/search.test.ts`, protocol schema test. No i18n (no user-facing text yet).
