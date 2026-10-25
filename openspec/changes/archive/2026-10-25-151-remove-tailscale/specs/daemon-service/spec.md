## MODIFIED Requirements

### Requirement: Login item identity
The LaunchAgent SHALL run the daemon through a `~/.remote-harness/Remote Harness.app` bundle (ad-hoc signed, with the app icon), so that macOS shows "Remote Harness" — and not Node's signer — in Login Items and in the background activity notice. The LaunchAgent's `ProgramArguments` SHALL be the bundle executable followed by node, `cli.js` and `start`; the bundle MUST NOT contain those paths. Installing SHALL remove a `Claude Remote.app` left by older versions. `service uninstall` MUST remove the bundle.

#### Scenario: Background activity notice
- **WHEN** the service is installed
- **THEN** macOS identifies the item as "Remote Harness"

#### Scenario: Old bundle
- **WHEN** the service is installed over an install that had `Claude Remote.app`
- **THEN** only `Remote Harness.app` remains and the LaunchAgent runs it

## REMOVED Requirements

### Requirement: Waiting for Tailscale
**Reason**: The direct path listens on every interface and the relay path needs no interface, so the service starts listening right away (ADR-0001).
**Migration**: Services installed before keep starting: the daemon accepts the old flag in their arguments and ignores it; `remote-harness service install` writes the new definition.
