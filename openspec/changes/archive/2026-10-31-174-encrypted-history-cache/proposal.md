## Why

Every reopened conversation is fetched again from the daemon, which costs relay traffic and latency, and nothing can be read while the computer or the network is down (#361). ADR 0004 settled the approach: an encrypted, read-only history cache on the device, synced forward from the daemon, which stays the source of truth. #366 (daemon ID per computer), #358 and #360 are done, so the cache can now be keyed per computer and sit under the in-memory limits.

## What Changes

- A history cache on the device: one SQLCipher-encrypted SQLite database (`expo-sqlite` with `useSQLCipher`), its key a random 256-bit secret in SecureStore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, the file in the app's cache directory (out of backups). Rows are partitioned by daemon ID.
- Conversations (and subagent conversations) are written to it as they arrive: the last page, entries streamed live, resumes and older pages. Opening a conversation renders the cached entries first, then subscribes from the cached cursor; a resume that cannot cover the gap replaces the cached copy, so the cache never holds a gap. Scrolling up reads older entries from the cache before asking the daemon.
- Transcript images are cached in the same encrypted database once fetched, and shown from it, also offline.
- The last session list of each computer is cached too, so after a cold start with the computer unreachable the list (with "offline list from …") and its conversations stay readable.
- An offline notice in the conversation while the computer is not connected ("Offline · saved copy").
- About 200 MB in total; least-recently-opened conversations (never the open ones) are evicted first.
- Everything of a computer is deleted when it is forgotten or revokes the device. The offline demo never touches the cache.
- FTS5 table over the entries' text, kept in sync, for #372.
- Read-only: no outbox; prompts and permission answers are never queued on the device.

## Capabilities

### New Capabilities
- `history-cache`: the device's encrypted, read-only copy of each computer's conversations, images and last session list: storage and key, forward sync without gaps or duplicates, offline reading, cap and eviction, wipe, search index.

### Modified Capabilities
- `app-conversation`: "Conversation memory" — older entries come from the history cache before the daemon; the offline notice.

## Impact

- New native dependency `expo-sqlite` (config plugin with `useSQLCipher`); the fingerprint runtime version changes, so it ships in a store build, not over the air.
- `apps/mobile/src/core/storage/history/` (database adapter, schema, queries), `apps/mobile/src/features/history/` (pure sync, eviction and search-text logic, binding to the active computer), changes to `features/conversation/store.ts`, `features/images/use-transcript-image.ts`, `features/sync/use-daemon-sync.ts`, `core/connection/connection-store.ts` (wipe on forget/revoke), `ConversationScreen` (offline notice), i18n in pt-BR, en-US, es-ES.
- No protocol or daemon change.
