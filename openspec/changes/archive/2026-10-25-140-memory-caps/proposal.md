## Why

Memory only grew during an app run: every visited conversation or subagent kept all its loaded entries, the image cache held up to 32 MB of base64 in the JavaScript heap, and the markdown link renderer's key set grew as the list recycled cells. The iPad 9th gen and the Redmi 8 (3 GB) set the limit. A resume after a long disconnection also left a silent gap: the daemon capped the reply to the last 2,000 lines and the app merged it with what it had (#360, part of #354).

## What Changes

- Closed conversations: only the 3 most recently opened stay in memory; a conversation keeps its last 500 entries when closed (older ones page back on scroll). Open conversations are never dropped or trimmed.
- Image cache down from 32 MB to 12 MB of base64.
- The markdown link renderer is created per text, so recycled cells no longer grow its key set.
- Resume: the daemon answers `hasMore: true` when the 2,000-line cap left lines after the cursor out, and the app then replaces its entries with the reply instead of leaving a gap.
- The evicted conversations move to the encrypted history cache later (#361).

## Capabilities

### New Capabilities

### Modified Capabilities
- `transcript-stream`: a capped resume says so with `hasMore`.
- `app-conversation`: conversation memory limits.

## Impact

- `apps/mobile/src/features/conversation/` (`retention.ts` with tests, `store.ts` and its tests, `components/Markdown.tsx`), `features/images/use-transcript-image.ts`.
- `apps/daemon/src/features/transcript/` (`transcript-file.ts` `since` returns the gap, `service.ts`), tests.
