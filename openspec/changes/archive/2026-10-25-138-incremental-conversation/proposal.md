## Why

Every `transcript.entry` rebuilt the whole conversation on the JavaScript thread: one store update per entry, a Map of all entries plus a full sort to merge it, a new object for every timeline item, the prompt history recomputed by a hidden sheet, and the full Myers diff of every visible Edit card again on each cell recycle. The cost grows with the transcript and spikes during tool-heavy turns (#358, part of #354).

## What Changes

- Live entries that arrive together are applied in one store update per frame; pending entries are applied before resubscribing and on unsubscribe.
- Entries that come after the last one, in order (the live case), are appended without the Map and the sort; anything else still merges, sorts and de-duplicates.
- The timeline lives in the store next to the entries and is extended as entries arrive: new entries add items, a tool call whose result arrives gets a new item, every other item keeps its object, so memoized rows do not re-render. Older pages and replaced entries rebuild it, equal to a full build.
- The prompt history is built only while its sheet is open.
- A tool call's diff is computed once per call (and language) and reused when the list recycles its cell.
- No protocol change: daemon-side batching ships with the connection relay epic (#362).

## Capabilities

### New Capabilities

### Modified Capabilities

No spec-level behavior changes (`skip_specs: true`): the conversation shows the same items, built with less work.

## Impact

- `apps/mobile/src/features/conversation/`: `batch.ts` (new), `timeline.ts` (`mergeEntries` append path, `extendTimeline`), `store.ts`, `ConversationScreen.tsx`, `diff.ts` (`cachedDiffForTool`), `components/ToolCallCard.tsx`, `components/PromptHistorySheet.tsx`; tests in `incremental.test.ts` and `store.test.ts`.
