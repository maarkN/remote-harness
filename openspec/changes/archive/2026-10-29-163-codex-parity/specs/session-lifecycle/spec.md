## MODIFIED Requirements

### Requirement: Session name at start
`session.start` SHALL accept an optional `name`, trimmed, on one line, without control characters and at most 80 characters; anything else MUST be rejected with `bad_request`. When the profile's agent has a display-name flag (Claude Code), the daemon SHALL pass `--name <name>` to the launcher as a single argument; when the agent names sessions with a command instead (Codex `/rename`), the daemon SHALL submit that command once the session registers. For every agent, the daemon SHALL set the session's title to the name as soon as the session registers, including when it registers after `session.started`. Without `name`, the title rules are unchanged.

#### Scenario: Named session
- **WHEN** the app starts a Claude Code session with `name` "Rate limit on login"
- **THEN** the launcher receives `--name "Rate limit on login"` and the list shows that title before the first prompt

#### Scenario: Codex
- **WHEN** a Codex session is started with a name
- **THEN** no name flag is passed, `/rename <name>` is submitted once the session registers, and the session's title in the app is the name

#### Scenario: Invalid name
- **WHEN** `session.start` carries a name with a line break
- **THEN** the daemon replies `error` `bad_request`
