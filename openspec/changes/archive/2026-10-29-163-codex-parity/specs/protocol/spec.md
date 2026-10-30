## MODIFIED Requirements

### Requirement: Agent mode on sessions
`Session` SHALL carry `approvalPolicy`: the Codex approval policy of the session (`on-request`, `never`, `untrusted`, `granular`, or another value Codex reports), `null` for Claude Code sessions and until known; and `permissionProfile`: the Codex permission profile (`:read-only`, `:workspace`, `:danger-full-access` or a named profile), `null` for Claude Code sessions and until known. Both MUST default to `null` so messages from older daemons stay valid. `permissionMode` keeps describing Claude Code sessions. The protocol SHALL define the Codex presets the app may request with `session.setMode`: `read-only` and `workspace`; full access is never one of them.

#### Scenario: Older daemon
- **WHEN** an app parses a session without `approvalPolicy` or `permissionProfile`
- **THEN** it reads `approvalPolicy: null` and `permissionProfile: null`

#### Scenario: Codex presets
- **WHEN** the app lists the Codex presets it can request
- **THEN** they are `read-only` and `workspace`

## ADDED Requirements

### Requirement: Permission requests carry whether rules apply
`PermissionRequestInfo` SHALL carry `rules`: whether the agent accepts always-allow rules with the answer (`true` for Claude Code, `false` for Codex). It MUST default to `true` so requests from older daemons stay valid.

#### Scenario: Older daemon request
- **WHEN** an app parses a permission request without `rules`
- **THEN** it reads `rules: true`
