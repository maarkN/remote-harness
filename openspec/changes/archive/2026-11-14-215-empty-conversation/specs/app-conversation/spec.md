## ADDED Requirements

### Requirement: Empty conversation
While a conversation has no entries, its list SHALL say why: the subscription's error when it failed; "loading conversation…" only until the first page of the conversation arrived (from the daemon's reply to the subscription or from the history cache on the device); and, once it arrived empty, an empty state instead of the loading text. The empty state of a conversation with a prompt composer SHALL invite the first prompt ("Type your first prompt to start…"); a read-only conversation (no composer, such as a subagent's) SHALL say "No messages yet". The empty state SHALL go away when the first entry arrives. All texts MUST be translated (pt-BR, en-US, es-ES).

#### Scenario: New session without a prompt
- **WHEN** the user starts a session from the app with no first prompt and the daemon answers the subscription with no entries
- **THEN** the conversation shows "Type your first prompt to start…" instead of "loading conversation…"

#### Scenario: First prompt sent
- **WHEN** the empty state is shown and the first entry of the conversation arrives
- **THEN** the empty state goes away and the entry is shown

#### Scenario: Still loading
- **WHEN** the conversation is open and the daemon has not answered the subscription yet, with nothing cached
- **THEN** it shows "loading conversation…"

#### Scenario: Subscription failed
- **WHEN** the subscription fails
- **THEN** the conversation shows the error, not the loading text or the empty state

#### Scenario: Empty subagent
- **WHEN** a subagent's conversation is open and its first page arrived empty
- **THEN** it shows "No messages yet"
