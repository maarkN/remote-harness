## MODIFIED Requirements

### Requirement: Push delivery
The daemon SHALL send a push to the registered tokens when a session finishes a turn (`Stop`, except one that keeps the session `running` because agent work is still in flight: the push follows the `Stop` that ends it), receives `Notification` or produces a permission request, unless a connected client has the app in the foreground. With a Firebase service account file the daemon SHALL send directly to FCM; without one it SHALL send through the push relay with each phone's grant. The config `push: "off"` (also set by `remote-harness push off`) MUST stop every push, live status updates included, and MUST apply to a running daemon without a restart.

#### Scenario: Session finishes
- **WHEN** `Stop` arrives and the app is in the background
- **THEN** the device receives "Session finished" with the profile

#### Scenario: Firebase not configured
- **WHEN** there is no service account and the phone registered with a relay grant
- **THEN** the daemon sends the push through the relay

#### Scenario: Turned off
- **WHEN** the user runs `remote-harness push off`
- **THEN** the running daemon sends no more pushes or live status updates until `remote-harness push on`

#### Scenario: Turn ends while a workflow runs
- **WHEN** `Stop` arrives with a `workflow` still running in `background_tasks` and the app is in the background
- **THEN** no "Session finished" push is sent; it is sent on the later `Stop` with no agent work in flight
