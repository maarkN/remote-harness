## MODIFIED Requirements

### Requirement: Conversation memory
The app SHALL keep in memory, besides the conversations on screen, only the 3 most recently opened conversations (subagents count as conversations). When a conversation is closed it SHALL keep only its last 500 entries, older ones being loaded again when the user scrolls up: from the history cache first, else from the daemon. A conversation on screen MUST NOT be dropped or trimmed. Transcript images SHALL be cached in memory up to about 12 MB. While the computer is not connected the conversation SHALL show a translated offline notice saying that what is shown is the copy saved on the device.

#### Scenario: Back to a recent conversation
- **WHEN** the user closes a conversation with 2,000 loaded entries and opens it again
- **THEN** it shows its last 500 entries at once and loads older ones on scroll

#### Scenario: Many conversations
- **WHEN** the user opens and closes five conversations in turn
- **THEN** only the last three stay in memory, and the first two are read again from the history cache when reopened

#### Scenario: Offline notice
- **WHEN** a conversation is open and the connection to the computer drops
- **THEN** the conversation shows the offline notice and keeps its entries
