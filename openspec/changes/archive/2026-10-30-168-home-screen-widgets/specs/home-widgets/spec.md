## ADDED Requirements

### Requirement: Widget snapshot
The app SHALL build what its widgets show from the active computer's sessions, pending permission requests and usage limits with one pure function. The snapshot SHALL hold: the number of sessions waiting for the user (state `waiting` or with a pending request) and running (`running`); up to three sessions ordered with a pending permission first (oldest request first), then waiting, then running, then the most recently updated, each with its title, state, the time it entered that state and whether a permission is pending; the oldest pending request without an `interaction` (questions and plans are answered in the app) with its request ID and tool; the highest 5-hour and weekly usage percentages across the computer's profiles with their reset times; the computer's daemon ID and name; when it was built; the labels already translated in the app's language (pt-BR, en-US or es-ES) and the colors of the app theme. Ended sessions MUST NOT appear. Without a paired computer the snapshot SHALL be the "pair" state; the demo MUST NOT publish one.

#### Scenario: Pending permission first
- **WHEN** one session runs, another waits and a third has a pending `Bash` request
- **THEN** the snapshot lists the session with the request first, then the waiting one, then the running one, and counts 2 waiting and 1 running

#### Scenario: Question pending
- **WHEN** the only pending request is a question
- **THEN** its session is highlighted but the snapshot offers no Allow / Deny

#### Scenario: No computer
- **WHEN** the app has no paired computer
- **THEN** the widgets show the "pair" state, which opens the app

### Requirement: iOS widgets
The app SHALL offer one widget in the iOS widget gallery with these families: small (waiting and running counts, the time of the snapshot; a tap opens the session list), medium (up to three sessions with state, title and time, the pending permission highlighted, Deny and Allow for the oldest pending request, each session opening by deep link on its computer), Lock Screen circular (waiting count), rectangular (waiting and running counts and the 5-hour and weekly limits) and inline (counts). Home Screen families SHALL use the theme colors and Lock Screen families the system's vibrant rendering. The gallery name and description SHALL be localized in the three languages. Deny and Allow MUST be performed in the app's process and answered over a short-lived connection to the snapshot's computer, also when the app is not running.

#### Scenario: Allow from the Home Screen
- **WHEN** the app is closed and the user taps Allow on the medium widget
- **THEN** the request is answered on its computer, the buttons disappear at once and the widget then shows the fresh state

#### Scenario: Lock Screen limits
- **WHEN** the 5-hour window is at 72 % and the weekly one at 40 %
- **THEN** the rectangular Lock Screen widget shows both percentages

### Requirement: Android widgets
The app SHALL offer two home screen widgets on Android, small (2×2: counts) and medium (4×2: up to three sessions and the actions), with the same content as on iOS, drawn in the theme colors and with texts in the app's language. Taps (open the list, open a session, Allow, Deny) MUST work with the app closed: actions run as a background task that answers over a short-lived connection and then redraws the widgets. The widget picker's name and description SHALL be localized in the three languages.

#### Scenario: Deny with the app closed
- **WHEN** the app is not running and the user taps Deny on the medium widget
- **THEN** the request is denied on its computer and the widget redraws without it

#### Scenario: Widget added
- **WHEN** the user adds a widget while the app has published a snapshot before
- **THEN** it draws that snapshot right away

### Requirement: Widget refresh
While connected, the app SHALL publish the snapshot when sessions, pending requests or limits change (debounced) and when it goes to the background. On a widget refresh push and after answering from a widget, it SHALL connect to that computer for a moment, fetch the sessions and the pending requests, and publish a new snapshot. Widgets SHALL show how long ago their snapshot was built, so stale data is visible. Titles and other session content MUST only reach the widgets from the app on the device, never through a push.

#### Scenario: Permission while the app is closed
- **WHEN** a permission request arrives while the app is closed and the phone receives the widget refresh push
- **THEN** the app fetches the state in the background and the widgets show the request

#### Scenario: Stale snapshot
- **WHEN** the computer is off and no refresh arrives
- **THEN** the widgets keep the last snapshot and say how long ago it was updated
