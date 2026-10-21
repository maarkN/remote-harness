## ADDED Requirements

### Requirement: Unreachable computer state
While the client is `reconnecting` and `unreachable` (the computer answered no connection attempt at all — distinct from a token rejection and from a brief reconnect that never reached `unreachable`) and there is nothing live to show, the session list SHALL show a checklist of what to check instead of an empty list: the computer is on and awake, Tailscale is running and signed in on the computer, Tailscale is running and connected on this phone with the same account, and the daemon is running on the computer. It SHALL offer **Try again** (retries immediately, skipping the backoff wait), **Open Tailscale** (the installed app via its own URL scheme, falling back to its store listing when not installed) and a link to the troubleshooting guide, plus an indicator that the app keeps retrying by itself. The iPad detail pane SHALL show the same checklist instead of its "select a session" empty state under the same condition. When a session snapshot from an earlier successful fetch is still available, the list SHALL keep showing it instead, with a compact "offline list from {{time}}" notice and a **Try again** action above it in place of the full checklist. The state SHALL disappear by itself as soon as the connection opens. All labels MUST be translated and use theme tokens only.

#### Scenario: Nothing cached and unreachable
- **WHEN** the client is `reconnecting` and `unreachable` and no sessions snapshot has ever been fetched
- **THEN** the list shows the checklist with Try again, Open Tailscale and the troubleshooting link, instead of an empty list

#### Scenario: Stale list kept visible
- **WHEN** the client is `reconnecting` and `unreachable` but a sessions snapshot was already fetched earlier
- **THEN** those sessions stay visible, with a compact "offline list from {{time}}" notice and Try again above them

#### Scenario: Not shown for a token rejection
- **WHEN** the client's status is `unauthorized`
- **THEN** neither the checklist nor the compact notice is shown, even if the computer was unreachable moments before

#### Scenario: Not shown during a brief reconnect
- **WHEN** the connection drops and reopens within the backoff window without ever being counted `unreachable`
- **THEN** neither the checklist nor the compact notice appears

#### Scenario: iPad detail pane
- **WHEN** no session is selected on a regular-width layout and the client is `reconnecting` and `unreachable`
- **THEN** the detail pane shows the same checklist instead of "Select a session"

#### Scenario: Disappears on reconnect
- **WHEN** the connection opens again
- **THEN** the checklist or the compact notice is gone immediately
