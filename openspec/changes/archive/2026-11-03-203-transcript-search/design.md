## Context

See proposal.md → Why. The device indexes cached entries with FTS5 (`unicode61` tokenizer: whole tokens, case folded, diacritics removed) over `searchText(entry)` (`apps/mobile/src/core/storage/history/search-text.ts`). The daemon reads transcripts through `TranscriptFormat.parseLine(raw, cursor)` (Claude Code, Codex, Gemini, Kimi, Qwen formats), and `TranscriptFile` indexes line offsets for streaming and pages. Sessions and their `transcriptPath` live in `SessionStore` (`all()` is sorted by `updatedAt`, newest first).

## Goals / Non-Goals

- Goal: results the app can merge with the device's FTS hits without duplicates (same searchable text, same whole-word semantics, hit identified by session + entry key).
- Goal: bounded work per request, whatever the size of the transcripts.
- Non-goal: a persistent index on the computer. Transcripts are read on demand; a later change can add one if searches turn out slow.
- Non-goal: the app's UI (sections, find-in-conversation, merge with the cache): follow-up change on #372.
- Non-goal: searching subagent transcripts.

## Decisions

- **Matching mirrors FTS5 `unicode61`**: words are runs of letters and digits (`\p{L}\p{N}`), folded with NFD + mark removal + lower case; every query word must occur as a whole word. Alternative considered: substring search (`includes`); rejected because the two halves would disagree on what is a hit, breaking the merge.
- **`searchText()` moves to `@remote-harness/protocol`**: one definition for both halves (the protocol package already holds pure helpers such as `last-activity.ts`). The app's module re-exports it, so nothing else moves.
- **Streaming read, not `TranscriptFile`**: a search reads each transcript once, line by line (`FileHandle.readLines`), parsing with the session's format and dropping repeated keys for `upserts` formats, instead of loading the whole file in one buffer as `TranscriptFile.sync()` does. Hits of a session are collected, then reversed (newest first).
- **Opaque cursor `<sessionId>:<cursor>.<index>` or `<sessionId>:`**: the next page continues in that session at or below that entry (newest-first order), or from the session's end when it was not read yet. A session gone from the store restarts the search from the top. Alternative considered: offset paging; rejected because the session order changes with activity and offsets would skip or repeat hits.
- **Two bounds per page**: `limit` hits (max. 50) and 20 transcripts read, so a word no transcript contains cannot keep a request reading hundreds of files; the reply's `scanned` and `nextCursor` let the app keep going (and say how much was searched).
- **Snippet**: a window of at most 160 characters starting about a third before the first match, cut at whitespace when possible; ranges inside the window are shifted to snippet offsets and `cutStart`/`cutEnd` say where the app draws an ellipsis.
- **Privacy**: the handler logs hit and transcript counts only.

## Risks / Trade-offs

- [Large transcripts with many images make the read slow] → lines are streamed and parsed one at a time; the per-page transcript cap bounds the request; the app can show partial results while it pages.
- [Order within a page changes when a session gets new activity between pages] → accepted: pages are a best-effort continuation, as `nextCursor` names the session and entry, not an offset.
- [`searchText` changes later in one place only] → impossible now: both halves import the same function.

## Open Questions

- Whether the computer needs a persistent index (depends on real transcript sizes); decided after the app half ships.
