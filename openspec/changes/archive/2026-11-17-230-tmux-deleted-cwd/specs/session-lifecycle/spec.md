## MODIFIED Requirements

### Requirement: Resume session
`session.resume` SHALL open a window with `claude --resume <sessionId>` in the session's original `cwd` with the correct profile. Like `session.start`, when the pane is gone shortly after the launcher returns (the agent CLI exited), the daemon MUST reply `error` `internal` naming the profile's actual agent ("<agent> exited right after starting") instead of `ack`, so the app does not report the window as opening. The app's Resume banner SHALL explain a failed resume like the New session screen explains a failed start: "Could not open <agent> in tmux: <reason>" for `internal`, and the New session screen's text for a directory that no longer exists (`invalid_cwd`). Every `session.resume` MUST be logged by the daemon: accepted resumes with the profile, session and pane, rejected ones with the error code and reason.

#### Scenario: Resume an ended session
- **WHEN** the app taps "Resume" on an ended session
- **THEN** the session becomes controllable again with the same history

#### Scenario: Agent exits right after resuming
- **WHEN** the launcher creates the window for the resume but Claude Code exits before the settle check (for example, its directory no longer exists)
- **THEN** the daemon replies `error` `internal` explaining that Claude Code exited, the Resume banner shows "Could not open Claude Code in tmux: Claude Code exited right after starting (…)" instead of "Opening…" and the Resume button can be tapped again, and the daemon logs the rejection with the code and reason

#### Scenario: Accepted resume is logged
- **WHEN** a `session.resume` opens a window that stays alive
- **THEN** the daemon log has an info line with the profile, the session and the pane
