## ADDED Requirements

### Requirement: Agent ids
The protocol SHALL know the agent ids `claude`, `codex`, `gemini`, `kimi` and `qwen` on profiles and sessions. An agent id the parser does not know MUST read as absent (Claude Code) instead of rejecting the profile, the session or the message that carries it.

#### Scenario: Gemini session
- **WHEN** a `sessions.snapshot` carries a session with `agent: "gemini"`
- **THEN** it parses with agent `gemini`

#### Scenario: Future agent
- **WHEN** a `sessions.snapshot` carries a session with `agent: "future-cli"`
- **THEN** the message parses and that session has no agent
