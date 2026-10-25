## MODIFIED Requirements

### Requirement: Cursor-based resumption
With `sinceCursor`, the daemon SHALL send the entries after the cursor before the new ones, from at most the last 2,000 lines of the transcript; when that cap leaves out lines written after the cursor, the reply's `hasMore` SHALL be `true`, and the app MUST then replace the entries it had with the reply instead of merging them, so the conversation never shows a gap. Without `sinceCursor`, the daemon MUST send the last page (50 entries).

#### Scenario: Reconnection
- **WHEN** the app reconnects and subscribes with `sinceCursor` 120
- **THEN** it receives the entries starting from cursor 121, without duplicates

#### Scenario: Long disconnection
- **WHEN** the app reconnects with `sinceCursor` 120 after 5,000 lines were written
- **THEN** it receives the entries of the last 2,000 lines with `hasMore: true`, shows only those, and loads older ones on scroll
