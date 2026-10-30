## ADDED Requirements

### Requirement: WSL direct path
Inside WSL the setup SHALL explain that phones reach the daemon through the connection relay whatever the networking mode, and SHALL offer mirrored networking (merged into `.wslconfig` with a backup) so that devices on the same network can also use the direct path.

#### Scenario: NAT networking
- **WHEN** WSL uses NAT networking and the user accepts mirrored networking
- **THEN** `networkingMode=mirrored` is merged into `.wslconfig` (with a backup) and the user is told to run `wsl --shutdown`

#### Scenario: Declined
- **WHEN** the user keeps NAT networking
- **THEN** the setup continues and phones connect through the relay

## REMOVED Requirements

### Requirement: WSL networking
**Reason**: The connection relay reaches a daemon inside WSL with any networking mode; no Tailscale address is needed.
**Migration**: Replaced by "WSL direct path".
