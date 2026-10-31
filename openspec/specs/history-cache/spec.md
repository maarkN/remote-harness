# history-cache Specification

## Purpose
The history cache is the device's encrypted, read-only copy of each paired computer's conversations, transcript images and last session list, synced forward from the daemon (the source of truth), so conversations open at once and stay readable while the computer or the network is down.

## Requirements

### Requirement: Encrypted storage
The app SHALL keep the history cache in one SQLite database encrypted with SQLCipher, in the app's cache directory, with its rows partitioned by the computer's daemon ID. The key SHALL be a random 256-bit secret kept in SecureStore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, so it never reaches a backup. Transcript images SHALL be stored inside the encrypted database. No session content (entries, images, titles, paths) MUST be written to the device in clear. A database that cannot be opened with the key (a restored file without its key) SHALL be deleted and created again. The offline demo MUST NOT read or write the cache.

#### Scenario: File at rest
- **WHEN** the cache holds conversations and the database file is read without the key
- **THEN** none of its entries, images or session titles can be read

#### Scenario: Restored without the key
- **WHEN** the database file exists but the key does not match
- **THEN** the app deletes the file and starts an empty cache

### Requirement: Forward sync without gaps
For every conversation it shows (sessions and subagents), the app SHALL write the entries it receives (last page, live entries, resumes and older pages) to the cache, each entry at most once (by its key), together with the highest cursor received. The cache SHALL only hold a contiguous run of a transcript's lines: entries received after the cached cursor extend it; a resume that cannot cover everything since the cached cursor, or entries that do not follow the cached cursor, SHALL replace the cached copy; an older page SHALL extend it only when it ends where the cached copy starts. The cache is read-only: prompts, permission answers and other requests MUST NOT be queued on the device.

#### Scenario: Reopen after new output
- **WHEN** a conversation cached up to line 120 is opened and the daemon has written lines up to 140
- **THEN** the cached entries render first, the app subscribes from cursor 120 and lines 121–140 are added once each

#### Scenario: Too much written meanwhile
- **WHEN** the resume answers with the last page and `hasMore` (the daemon could not send everything since the cursor)
- **THEN** the cached copy of that conversation is replaced by that page

#### Scenario: No outbox
- **WHEN** the computer is unreachable and the user tries to send a prompt
- **THEN** nothing is stored to be sent later

### Requirement: Cache before network
Opening a conversation SHALL render its cached entries (the latest page) before the daemon answers, and scrolling up SHALL read older entries from the cache before asking the daemon. Transcript images SHALL be shown from the cache when there, and written to it once fetched. The last session list of each computer SHALL be cached; while the computer is unreachable after a cold start the list SHALL show it, with the time it was fetched, and its conversations SHALL open from the cache.

#### Scenario: Offline reopen
- **WHEN** the computer is asleep and the user opens a cached conversation
- **THEN** its entries and cached images show, with the offline notice

#### Scenario: Cold start offline
- **WHEN** the app starts with the computer unreachable
- **THEN** the session list shows the cached sessions with "offline list from" and their time

### Requirement: Cap and eviction
The cache SHALL stay under about 200 MB in total (entries and images of every computer). Over the cap, it SHALL delete whole conversations, least recently opened first, until it is under 90% of the cap; conversations on screen MUST NOT be evicted.

#### Scenario: Over the cap
- **WHEN** a write takes the cache over 200 MB
- **THEN** the least recently opened conversations not on screen are deleted until it is under 180 MB

### Requirement: Wipe on forget and revoke
When a computer is forgotten on the device, or its daemon revokes the device, the app SHALL delete every cached entry, image, search row and session list of that computer, with secure delete so the freed pages are overwritten.

#### Scenario: Forget
- **WHEN** the user forgets a computer in Settings
- **THEN** nothing of that computer remains in the cache

#### Scenario: Revoked
- **WHEN** the daemon closes the channel because the device was revoked
- **THEN** the computer is forgotten and its cache deleted

### Requirement: Search index
The cache SHALL keep an FTS5 full-text index over each cached entry's text (prompt and reply text, thinking, tool name and its main input, tool result content, system text), updated with the entries, for searching inside conversations.

#### Scenario: Indexed reply
- **WHEN** a reply containing "connection pool" is cached
- **THEN** a full-text query for "pool" over that computer's entries finds it
