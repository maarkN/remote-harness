## Context

The daemon only tails a transcript while someone subscribes to it (the app's conversation screen, live status, permissions). Sessions in the list are mostly not subscribed, so `lastActivity` cannot depend on the stream: it has to be read on demand. `updatedAt` already moves on every hook event and on transcript activity (throttled to 5 s), which is the signal that something new is in the transcript.

## Goals / Non-Goals

**Goals:** a cheap, bounded read per refresh; one place that turns normalized entries into the preview (shared by the daemon and the app's offline demo); no change to the list order or to push payloads.

**Non-Goals:** collapsible groups (dropped after #153); keeping a history of activities; previews of subagents.

## Decisions

- **Extraction in `@remote-harness/protocol`** (`lastActivityOf(entries, fallbackAt)`, `previewText`): it works on `TranscriptEntry`, already the protocol's normalized form, so the `.jsonl` stays known only to the transcript formats. The app's demo builds its sessions with the same function, so the demo and a real daemon cannot drift. Walks backwards and takes the first `user`, `assistant_text`, `tool_use` or `system`/`command` entry that is not a sidechain; a user entry with only images is skipped.
- **Tool text** is `Name(target)` like the TUI writes it, the target being the base name of `file_path`/`notebook_path`/`path`, else the first line of `command`, else `pattern`, `url` or `description`; just `Name` when none. Only over the authenticated WS, so the command's first line is acceptable here (push never sees it).
- **Markdown stripping** is a small regex pass (fences, inline code ticks, bold/italic markers, headings, quotes, list bullets, links and images to their text), then whitespace collapsed and cut to 200 characters with `…`. Good enough for a 2-line preview; the conversation screen still renders the real markdown.
- **Tail read** (`readTailEntries` in the transcript feature): the last 64 KiB of the file, the first partial line dropped, each line through the agent format's `parseLine`. If no candidate is found and the file is bigger, one retry with 1 MiB (a huge tool result line can fill the first window). It never indexes the file, so the recent scan's read-only sessions don't load whole transcripts into memory.
- **Tracker** (`features/last-activity`): listens to `store.onChange` (new session, new `updatedAt`, new `transcriptPath`) and to `hook` events, and refreshes each session at most once every 3 s with a trailing run (timers injected for tests). It writes `{ lastActivity, updatedAt: <current> }`, so the store sees no newer stamp and the list order is untouched; it keeps the previous value when the tail yields nothing. Its own write does not change `updatedAt`, so it does not trigger itself.
- **App density** is a small SecureStore-backed Zustand store like the sort store. `SessionRow` reads it directly, so memoized rows re-render when it flips; FlashList v2 measures the new heights itself.

## Risks / Trade-offs

- [A burst of 100+ read-only sessions at startup triggers that many tail reads] → each read is 64 KiB and async; acceptable once at start, and only for sessions without a value yet.
- [Regex markdown stripping can leave odd characters in exotic markdown] → preview only, cut to two lines.
