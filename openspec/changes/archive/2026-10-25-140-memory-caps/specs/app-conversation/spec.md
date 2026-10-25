## ADDED Requirements

### Requirement: Conversation memory
The app SHALL keep in memory, besides the conversations on screen, only the 3 most recently opened conversations (subagents count as conversations). When a conversation is closed it SHALL keep only its last 500 entries, older ones being loaded again from the daemon when the user scrolls up. A conversation on screen MUST NOT be dropped or trimmed. Transcript images SHALL be cached up to about 12 MB.

#### Scenario: Back to a recent conversation
- **WHEN** the user closes a conversation with 2,000 loaded entries and opens it again
- **THEN** it shows its last 500 entries at once and loads older ones on scroll

#### Scenario: Many conversations
- **WHEN** the user opens and closes five conversations in turn
- **THEN** only the last three stay in memory, and the first two are fetched again when reopened
