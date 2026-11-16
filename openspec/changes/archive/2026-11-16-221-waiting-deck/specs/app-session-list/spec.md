## MODIFIED Requirements

### Requirement: Waiting strip
When at least one session is waiting for the user (a pending permission request of a session that has not ended, or a controllable session in the `waiting` state), the list screen SHALL pin a strip above the list. Its items are ordered oldest first. Each item SHALL show its agent badge, session title, profile tag and `Tool · argument`, and the answer buttons (Deny, Always, Allow) for a tool permission, or a status line ("has a question", "plan ready for review", "waiting for you") with an Open button for questions, plans and sessions without a request. With one item the strip SHALL show it with the header "WAITING FOR YOU · 1" and the elapsed time since the item, updated every second. With two or more items the strip SHALL be drawn as a deck: one item in front (the oldest at first) with one card edge peeking below it for two items and two edges for three or more, and in the header, instead of the session count, a counter "n/N ›" with the front item's position among the N items, next to the front item's elapsed time. Tapping the counter SHALL bring the next item to the front, and the first again after the last; swiping the front card to the left SHALL bring the next item and to the right the previous one. When the front item is answered or resolved elsewhere, the item that takes its place SHALL come forward with a short animation, or the previous one when it was the last. With Reduce Motion the deck SHALL not animate nor follow the finger. The counter SHALL be a button announced with its position (e.g. "2 of 3") and a hint that it shows the next one, and moving through the deck SHALL announce the new position and the session's title. The strip MUST NOT change the order of the list, and the waiting row keeps its warning border. Read-only sessions without a request and requests of ended sessions MUST NOT appear in it.

#### Scenario: One Bash permission pending
- **WHEN** one session waits for `Bash · gh pr create --fill`
- **THEN** the strip shows "WAITING FOR YOU · 1", the elapsed time, the session's badge, title and profile, "Bash · gh pr create --fill" and Deny / Always / Allow, with no card edge and no counter

#### Scenario: Two sessions waiting
- **WHEN** a second session asks a question while the first permission is still pending
- **THEN** the strip shows the first permission in front with one card edge below it and "1/2 ›" in the header, and the permission stays answerable

#### Scenario: Move through the deck
- **WHEN** three items wait and the user taps "1/3 ›", then swipes the front card to the right
- **THEN** the second item comes to the front with "2/3 ›", and the swipe brings the first back with "1/3 ›"

#### Scenario: Answer from the deck
- **WHEN** three items wait, the second is in front and the user taps Allow on it
- **THEN** the third item comes forward with an animation and the counter reads "2/2 ›"

#### Scenario: Reduce Motion
- **WHEN** Reduce Motion is on and the user answers the front item
- **THEN** the next item replaces it without animation

#### Scenario: Nothing waiting
- **WHEN** the last pending request is resolved
- **THEN** the strip disappears and the list keeps its order

#### Scenario: Read-only session marked waiting
- **WHEN** an older daemon reports a read-only session as `waiting` with no pending request
- **THEN** the strip does not show it
