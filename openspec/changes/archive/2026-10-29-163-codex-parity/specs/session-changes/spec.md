## MODIFIED Requirements

### Requirement: Generated messages
`changes.generate { sessionId, kind, paths? }` SHALL propose a commit message (`kind: "commit"`, from the diff of the selected paths) or a PR title and body (`kind: "pr"`, from the commits and the diff stat against the default branch) through the session profile's agent CLI, the one the voice polish uses (Claude Code `-p` with a small model and no tools, or Codex `exec` with a read-only sandbox; the diff goes in on standard input, cut at 60,000 characters). It answers `changes.generated { title, body }`. A profile whose agent has no such CLI call, or one routed through a model provider, is rejected with `not_found`; a failed call with `internal`. Nothing of the diff is logged.

#### Scenario: Commit message
- **WHEN** the app asks for a commit message for `src/login.ts`
- **THEN** the reply has a one-line title and an optional body written from that file's diff

#### Scenario: Codex session
- **WHEN** the app asks for a commit message in a Codex session without a provider
- **THEN** the daemon writes it through `codex exec` and answers `changes.generated`
