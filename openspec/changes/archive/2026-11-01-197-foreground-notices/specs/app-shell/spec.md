## ADDED Requirements

### Requirement: In-app notices
While the app is in the foreground, when a session other than the one on screen finishes a turn, asks a tool permission, asks a question or has a plan ready for review, the app SHALL show a notice: a banner at the top of the screen with what happened ("Session finished", "Permission requested", "Has a question", "Plan ready for review") and the session's title. Tapping it SHALL open that session; it SHALL go away on its own after a few seconds or when dismissed, and a newer notice replaces the one shown. No notice SHALL appear for the session on screen (its screen shows the event), for a muted session or profile, for a request created more than a minute ago (replayed on reconnect or after switching computers) or in the offline demo. A finished turn SHALL give a haptic only while push notifications are on for this phone. The notice needs no daemon change: it is derived from the session and permission updates the app already receives. Texts MUST be translated (pt-BR, en-US, es-ES).

#### Scenario: Finished elsewhere
- **WHEN** the user is reading session A and session B's turn ends
- **THEN** a banner reads "Session finished" with B's title, and tapping it opens B

#### Scenario: Question in the open session
- **WHEN** the session on screen asks a question
- **THEN** no banner appears (the question card is already on screen)

#### Scenario: Muted profile
- **WHEN** a session of a muted profile asks a permission while another session is on screen
- **THEN** no banner appears

#### Scenario: Replayed request
- **WHEN** the app reconnects and the daemon lists a permission created ten minutes ago
- **THEN** no banner appears for it; the Waiting for you strip still lists it
