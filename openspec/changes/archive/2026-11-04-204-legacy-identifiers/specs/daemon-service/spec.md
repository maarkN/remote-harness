## MODIFIED Requirements

### Requirement: Folder access attribution
When the Command Line Tools are available, the bundle executable SHALL be a compiled launcher that spawns the daemon as a child process (not `exec`), forwards SIGTERM, SIGINT, SIGHUP, SIGQUIT, SIGUSR1 and SIGUSR2 to it and exits with its status, so that macOS privacy prompts and grants name "Remote Harness". The bundle's `Info.plist` SHALL carry the Documents, Desktop, Downloads, removable and network volume usage descriptions, translated to pt-BR, en-US and es-ES. Reinstalling the service with unchanged launcher, icon and texts MUST leave the bundle untouched, so its signature and the grants survive `remote-harness update`. The one-time change of the bundle identifier to `com.alvyntech.remoteharness.daemon` rebuilds the bundle once; the update that does it SHALL say that macOS may ask for folder access and notifications again. Without the Command Line Tools the bundle SHALL fall back to a script that execs the same arguments, and `doctor` SHALL report it with the fix.

#### Scenario: First access to Documents
- **WHEN** a session in `~/Documents/project` makes the daemon read the folder for the first time
- **THEN** macOS asks whether "Remote Harness" may access the Documents folder

#### Scenario: Update keeps the grant
- **WHEN** the user granted access and then runs `remote-harness update`
- **THEN** the bundle is not rebuilt and the daemon keeps the access without a new prompt

#### Scenario: Identifier rename
- **WHEN** the first update with the `com.alvyntech.remoteharness.daemon` identifier runs on a Mac whose grants were given to the `tech.doctorx.claude-remote` bundle
- **THEN** the bundle is rebuilt once, the install output warns that macOS may ask again, and later updates leave the bundle untouched

#### Scenario: Stop the service
- **WHEN** launchd stops the job
- **THEN** the launcher forwards SIGTERM, the daemon shuts down and no node process is left behind

#### Scenario: No Command Line Tools
- **WHEN** the service is installed on a Mac without the Command Line Tools
- **THEN** the daemon runs through the script fallback and `doctor` says to install them and reinstall the service
