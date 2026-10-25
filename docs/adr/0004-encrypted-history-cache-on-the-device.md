---
status: accepted
---

# Session content is cached on the device, encrypted and read-only

Until now session content lived only in the app's memory, so every reopened conversation was fetched again from the daemon, which now costs relay traffic and latency, and nothing could be read while the computer or the network was down. We decided to keep a history cache per computer on the device: an SQLCipher-encrypted SQLite database (with FTS5 for full-text search) and encrypted image files, keyed by a secret stored in SecureStore as this-device-only so it never reaches an iCloud backup. It is capped at about 200 MB with least-recently-used eviction and wiped when the computer is forgotten or the daemon revokes the device. The daemon stays the source of truth: the cache only syncs forward by cursor and is read-only, with no outbox, so a prompt or a permission answer is never sent late from the device.

## Considered Options

- **Memory only (as before)**: no content at rest on the phone, but slow reopens over the relay and nothing offline.
- **Cache plus outbox**: lets prompts be written offline, but delivers them late to a session whose state has moved on, and would tempt stale permission answers.
