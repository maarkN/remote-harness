## MODIFIED Requirements

### Requirement: Update from the app
The daemon SHALL answer `daemon.update.check` with its update info (running version, channel, last check, the available update and whether it is a downgrade, what blocks updating, whether sessions are busy, and the last or current run), saving a given channel to the config first. It SHALL answer `daemon.update.start` by running the `remote-harness update` flow for the channel in a process that survives the service restart, and broadcast `daemon.update.info` whenever the run changes. It MUST refuse to start when it does not run from the installer's checkout, when it runs from sources, when it is not under a service manager, when a run is in progress or when no update is available, saying why. The refusal MUST be checked before a run is recorded, so a refused start leaves no failed run, and the reply SHALL say "an update is already running", "cannot update: <blocker>" or "already up to date". The run recorded for a start MUST NOT count as an update in progress when that same start spawns the updater; a start refused after its run was recorded (the offer went away meanwhile) SHALL reply with the same specific reason, never a generic one, and put the run record back as it was. The tray's "Update now" and automatic updates SHALL start the same way. The daemon MUST be able to start a later update after the updater exited without restarting it (for example "Already up to date"), and it SHALL check the channel again right away in that case. A failure to start the updater SHALL be recorded as a failed run with its error. The app SHALL show these reasons translated, and an update that keeps the version but has a newer commit as "<version> · new commits (<commit>)".

#### Scenario: Update from the phone
- **WHEN** the app sends `daemon.update.start` for `main` and 0.13.0 is available
- **THEN** the app receives `fetching`, `building` and `restarting`, the daemon restarts, and after reconnecting the app sees 0.13.0 with the run `done`

#### Scenario: Development clone
- **WHEN** the daemon runs from a development clone
- **THEN** the info says `not-installer` and `daemon.update.start` is refused

#### Scenario: Switch channel
- **WHEN** the app checks with channel `development`
- **THEN** the config's `update.channel` becomes `development` and the info shows the development version

#### Scenario: Updater found nothing to do
- **WHEN** an update run ends with "Already up to date" and exit code 0, and later the checker finds `bcf5378` on `development`
- **THEN** "Update the computer" starts the updater for `bcf5378`

#### Scenario: Refused while running
- **WHEN** the app asks to update while an update runs
- **THEN** the request is refused with "an update is already running" and no failed run is recorded

#### Scenario: Same version, newer commit
- **WHEN** the running version is 0.13.0 and `development` has 0.13.0 at commit `bcf5378`
- **THEN** the app reads "0.13.0 · new commits (bcf5378) is available"

#### Scenario: Start not refused by its own run
- **WHEN** 0.13.0 is available, no update runs and the app sends `daemon.update.start`
- **THEN** the daemon records the run, spawns the updater and replies with the run at `fetching`, instead of "could not start the updater: nothing to update"

#### Scenario: Update now from the tray
- **WHEN** an update is available and the user chooses "Update now" in the tray
- **THEN** the updater starts and the run is followed like one started from the app

#### Scenario: Offer gone before the spawn
- **WHEN** the start passed the first check but the available update was cleared before the updater was spawned
- **THEN** the reply says "already up to date" and the run record is the one from before the start
