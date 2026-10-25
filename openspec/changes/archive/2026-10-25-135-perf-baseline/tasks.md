## 1. Demo scenario

- [x] 1.1 `demo-data.ts`: line writer usable for appends (start index and parent), `transcriptLines` unchanged in output.
- [x] 1.2 `demo-perf.ts`: long, bursty and terminal sessions, deterministic generators, burst batches and the pane loop command; tests that every line parses and the long transcript has about 5,000 entries.
- [x] 1.3 `demo.mts --perf`: adds the sessions, appends a burst every 3 s while running, runs the pane loop; unchanged without the flag.

## 2. App measurements

- [x] 2.1 `features/performance/bench.ts`: pure frame-drop rule, scroll summary, render list and the Markdown row, with Vitest.
- [x] 2.2 Local store of this run's numbers; `use-performance.ts` records app ready and stalls locally always, traces only with collection on.
- [x] 2.3 Conversation render (`conversation_ready`) and scroll (`conversation_scroll`) measurement hooks wired into `ConversationScreen`.
- [x] 2.4 Settings → "Performance (this run)" card with Copy; i18n in pt-BR, en-US and es-ES.

## 3. Docs and validation

- [x] 3.1 `CONTRIBUTING.md`: running the scenario on a device, release builds, the before/after table.
- [x] 3.2 `turbo run typecheck test`, Biome and `npx expo export --platform ios` green.
