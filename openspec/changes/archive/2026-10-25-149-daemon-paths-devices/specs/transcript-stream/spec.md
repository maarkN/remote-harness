## MODIFIED Requirements

### Requirement: Real-time streaming
After `session.subscribe`, the daemon SHALL send the new entries of each read of the transcript as one `transcript.entries` message (the entries in order, each with its increasing `cursor`) less than 1 s after they are written to the file.

#### Scenario: New response
- **WHEN** Claude writes a response to the transcript of a subscribed session
- **THEN** the app receives a `transcript.entries` with the corresponding entry

#### Scenario: Tool-heavy turn
- **WHEN** one read of the transcript finds 30 new entries
- **THEN** the app receives them in a single `transcript.entries`

### Requirement: Cursor-based resumption
With `sinceCursor`, the daemon SHALL send the entries after the cursor before the new ones when at most 200 lines were written after it; when more were, the reply SHALL be the last page (50 entries) with `hasMore: true`, and the app MUST then replace the entries it had with the reply instead of merging them, so the conversation never shows a gap, and load older pages on scroll. Without `sinceCursor`, the daemon MUST send the last page (50 entries).

#### Scenario: Reconnection
- **WHEN** the app reconnects and subscribes with `sinceCursor` 120
- **THEN** it receives the entries starting from cursor 121, without duplicates

#### Scenario: Long disconnection
- **WHEN** the app reconnects with `sinceCursor` 120 after 5,000 lines were written
- **THEN** it receives the last page with `hasMore: true`, shows only those, and loads older ones on scroll
