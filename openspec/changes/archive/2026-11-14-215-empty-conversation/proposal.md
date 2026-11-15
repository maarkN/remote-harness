## Why

A session started from the app without a first prompt opens its conversation on "loading conversation…", which stays until the first message arrives (#554). Nothing is loading: the daemon already answered. Read in the code:

- The conversation's empty list shows the subscription error when there is one and otherwise `conversation.loading` (`ConversationScreen.tsx`, `ListEmptyComponent`), whatever has happened.
- The stream state (`features/conversation/store.ts`) has no "loaded" flag: an empty `transcript.page` reply leaves `entries = []` and `lastCursor = null`, exactly as before the reply, so the screen cannot tell "not answered yet" from "answered, nothing there".
- The daemon reads a missing transcript as empty and still answers `session.subscribe` with `entries: []`, watching the file; the first lines arrive later as `transcript.entries`. The app opens the conversation right after `session.started`, so a session with no prompt is always in this state.

## What Changes

- The conversation stream records that its first page arrived (`loaded`), from the daemon's reply or from the device's history cache; a failed subscription leaves it unset and keeps its error.
- The empty conversation shows, in order: the error when the subscription failed; "loading conversation…" only until the first page; then an empty state. A conversation the user can prompt says "Type your first prompt to start…"; a read-only one (no composer, such as a subagent) says "No messages yet". It goes away when the first entry arrives.
- New i18n keys in pt-BR, en-US and es-ES.
- Vitest: the store goes loading → loaded and empty → entries, and an error; the pure choice of the empty state.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-conversation`: new requirement "Empty conversation".

## Impact

- App: `features/conversation/store.ts`, a pure `empty-state.ts`, `ConversationScreen.tsx`, i18n catalogs, tests.
- No protocol or daemon change.
