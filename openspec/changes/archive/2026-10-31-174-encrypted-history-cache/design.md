## Context

`features/conversation/store.ts` keeps streams in memory (#358, #360): the last page on subscribe, live `transcript.entries`, resumes with `sinceCursor` (a reply with `hasMore` replaces what the app had), older pages with `session.history`. Images come one by one with `transcript.image`. The session list lives only in memory. ADR 0004 fixes the shape of the cache; this design picks the storage layout and the sync rules.

## Decisions

- **One database for all computers, rows keyed by daemon ID** (not one file per computer). Eviction is one LRU over every conversation, the 200 MB total is one `SUM`, and a computer's wipe is a `DELETE … WHERE computer = ?` with `PRAGMA secure_delete = ON` and a WAL checkpoint (`TRUNCATE`), so freed pages are zeroed. One key, one open connection.
- **Images in the database** (`images` table, base64 text as the daemon sends it) instead of separately encrypted files: SQLCipher encrypts them with everything else, they share the eviction and wipe, and there is no file-encryption code to write. A 5 MB image is a fine SQLite value.
- **File in the cache directory** (`Paths.cache`): out of iCloud/device backups, and the OS may reclaim it under storage pressure, which a cache tolerates. A file restored or kept without its key fails to open (`file is not a database`); it is deleted and created again.
- **Key**: 32 random bytes (`expo-crypto`), hex, in SecureStore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; set as a raw key (`PRAGMA key = "x'…'"`) right after opening, which skips SQLCipher's passphrase KDF on every start.
- **Contiguous runs** (pure, `features/history/sync.ts`): each stream row keeps `floor` (lowest cursor cached), `lastCursor`, and `complete` (the run reaches line 0). Everything from `floor` to `lastCursor` is cached, so the app can resume from `lastCursor` and page older entries from the cache down to `floor`. Rules: live/resume entries extend the run when the app's previous cursor equals the cached `lastCursor` (or the stream is new); otherwise (a reset, a failed write, an evicted row) the run restarts at the batch; a resume reply with `hasMore` replaces it; an older daemon page (`before = B`) extends it only when `B` equals `floor`. Entries are upserted by key, so duplicates collapse.
- **Hydrate before subscribing**: a stream not in memory loads its cached latest page (200 entries) first and the subscription waits for it, so the resume cursor is the cached one and the in-memory list never joins two disjoint runs.
- **Adapter seam**: `SqlDatabase` (the subset of expo-sqlite's async API used) is implemented by expo-sqlite in the app and by `node:sqlite` in Vitest, so the schema, queries, eviction and wipe are tested against a real SQLite with FTS5.
- **Search index**: an external-content FTS5 table over `entries.text` maintained by triggers; `searchText(entry)` (pure) picks what goes into it. #372 adds the query side.
- **Session list**: one `snapshots` row per computer (sessions JSON and when it was fetched), written debounced after changes, read when the app starts on a computer and no snapshot has arrived yet.
- **Wipe hook**: `forgetComputer` (also reached on revoke) calls the history wipe for that daemon ID.

## Risks / Trade-offs

- [SQLCipher + FTS5 on the native builds is not stated in the docs] → verify on device; the schema creation fails loudly and the app then runs without a cache (memory only, as before).
- [Writes on the JS thread during bursts] → entries are written once per batch (the batcher already groups a frame), in one transaction.
- [Native dependency] → needs a store build; the fingerprint runtime keeps the OTA from reaching older binaries.
