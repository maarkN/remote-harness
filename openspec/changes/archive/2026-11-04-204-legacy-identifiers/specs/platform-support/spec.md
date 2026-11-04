## MODIFIED Requirements

### Requirement: Background service per platform
`remote-harness service install` SHALL install a launchd LaunchAgent on macOS and a systemd user unit on Linux, both restarting the daemon when it stops; on Linux the setup MUST offer to enable lingering. The LaunchAgent SHALL be labelled `com.alvyntech.remoteharness.daemon` (also the bundle identifier of `Remote Harness.app`) and the unit SHALL be `remote-harness.service`; when the legacy `tech.doctorx.claude-remote` agent or `claude-remote.service` unit is installed, installing the service SHALL unload and remove it first, so one daemon runs.

#### Scenario: systemd user unit
- **WHEN** the user accepts the service on Linux
- **THEN** `~/.config/systemd/user/remote-harness.service` is written, enabled and started, and `remote-harness service status` shows it running
