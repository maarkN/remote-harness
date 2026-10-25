## MODIFIED Requirements

### Requirement: Deep link and actions
Every push and the live status link SHALL carry the sending daemon's ID. Tapping the notification SHALL open the session on that computer, switching the active computer first when it is another one; the "Allow"/"Deny" actions MUST answer the request by connecting in the background to that notification's computer. Requests with an `interaction` (question or plan) MUST NOT offer these actions.

#### Scenario: Deny from the notification
- **WHEN** the user taps "Deny" on the notification
- **THEN** the app sends `permission.respond` with `deny` to the computer that sent it

#### Scenario: Question without actions
- **WHEN** Claude asks a question and the app is in the background
- **THEN** the push has no Allow/Deny actions and tapping it opens the session

#### Scenario: Notification from the other computer
- **WHEN** the desktop is active and the user taps a notification from the laptop
- **THEN** the app switches to the laptop and opens that session
