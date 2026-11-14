## MODIFIED Requirements

### Requirement: Flat list with filter chips
The list SHALL show every session that matches the current filter in one flat list, ordered by the chosen sort: **Recent** (default; newest `updatedAt` first, regardless of state) or **By state** (waiting first, then running, idle and ended, newest first inside each state). The sort SHALL be a ghost chip at the end of the filter row ("Recent ▾" / "By state ▾") that toggles on tap and is remembered on the device. Above the list the app SHALL show filter chips: `all` and one chip per profile (only when there is more than one profile), then `active` and `ended`; the selected chip is filled with the accent. The machine line's running and waiting counts SHALL apply two more state filters, `running` and `waiting` (only sessions in that state), which replace the `active` or `ended` chip while applied and count as filtering. A search box SHALL still filter by title and folder.

#### Scenario: Profile chip
- **WHEN** the user taps the "Work" chip
- **THEN** only the sessions of the Work profile remain, with no group header

#### Scenario: Single profile
- **WHEN** the daemon lists one profile
- **THEN** no profile chips are shown, only `active` and `ended`

#### Scenario: Recency by default
- **WHEN** an idle session was updated after a waiting one
- **THEN** the idle session is listed first and the waiting one keeps its warning border below it

#### Scenario: Back to the state order
- **WHEN** the user taps the sort chip
- **THEN** the list reorders waiting first and the chip reads "By state ▾", also after relaunching the app

#### Scenario: Waiting filter from the count
- **WHEN** the `waiting` filter is applied from the machine line
- **THEN** only waiting sessions are listed, neither the Active nor the Ended chip is selected, and the compact bar's filters button shows its dot

### Requirement: Header and machine line
The list screen header SHALL show the product mark (22 pt, accent) followed by "Sessions". On regular width (the sidebar header on wide screens) it SHALL keep both the new-session and settings actions on the right. On compact width (phones) the list SHALL draw this header itself as the first row of its collapsing header (the stack's navigation header is hidden there and the list keeps the top safe area) and it SHALL show only the settings action; the new-session action instead appears as a floating action button over the list (see "New session floating action button"). Under the header a machine line SHALL show, on its first line, the computer switcher (a connection dot — success when connected, danger when the token was rejected, warning otherwise —, the machine name and a chevron), "via relay" when that is the path, the number of sessions in the list and — only the parts that are non-zero — the number running and the number waiting. A second line below SHALL show, only when non-zero, the number of background tasks and running subagents across the list ("+N tasks") and, when at least one agent is known, the number of distinct agents and, when any has a running session, how many; with neither, there is no second line. The switcher SHALL keep a minimum width, stay tappable and never be drawn under another part: when the first line runs out of width its counts wrap to a new line, and the machine name is cut with an ellipsis only when the switcher alone is wider than the line. Tapping the running count SHALL toggle the `running` filter and tapping the waiting count the `waiting` filter (see "Flat list with filter chips"); the count of the applied filter is shown in the accent color.

#### Scenario: Connected
- **WHEN** the app is connected to "MacBook Pro" and the list shows 7 sessions, 3 running, 1 waiting, all Claude Code
- **THEN** the machine line reads "● MacBook Pro ▾ · 7 sessions · 3 running · 1 waiting", with "1 agent · 1 running" on the line below

#### Scenario: Long name and many counts on a narrow phone
- **WHEN** the active computer has a long name, 52 sessions, running and waiting sessions, background tasks and two agents, on an iPhone SE in es-ES
- **THEN** the switcher shows its dot, the start of the name and the chevron, the counts that do not fit move to the next line, and no text overlaps or is cut at the right edge

#### Scenario: Nothing running or waiting
- **WHEN** every session in the list is idle or ended
- **THEN** the machine line shows the session count with no running or waiting part

#### Scenario: Tap the running count
- **WHEN** the user taps "3 running" in the machine line
- **THEN** the list shows only the 3 running sessions and "3 running" turns to the accent color; tapping it again shows every session

#### Scenario: Tap the waiting count
- **WHEN** the user taps "1 waiting" in the machine line
- **THEN** the list shows only the waiting session

#### Scenario: Compact header has no new-session icon
- **WHEN** the session list shows in compact width (phone)
- **THEN** its header shows only the settings action, and a floating action button opens a new session instead

#### Scenario: Regular width keeps the header action
- **WHEN** the session list shows as the sidebar on regular width (iPad, wide Split View)
- **THEN** its header keeps both the new-session and settings actions, and no floating action button is shown
