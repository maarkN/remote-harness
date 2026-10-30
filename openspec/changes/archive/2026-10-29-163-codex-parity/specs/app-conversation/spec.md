## MODIFIED Requirements

### Requirement: Codex sessions in the conversation
For a Codex session the mode chip SHALL show the session's permission profile (Read only, Workspace, Full access, a named profile as is, or the approval policy when the profile is unknown, `—` when both are), with Full access in the danger color; its accessibility label names the permission profile and the approval policy. On a controllable session tapping it SHALL open a picker with Read only and Workspace (the current one marked), the session's approval policy, and a note that full access is only available in the terminal; picking one sends `session.setMode` with `read-only` or `workspace` and errors are shown like Claude Code's. On a read-only session the chip is disabled. `exec` tool calls SHALL be labeled `exec(<command>)` with Command and Folder fields; `apply_patch` calls SHALL be labeled with the changed files and show the patch as a diff (added and removed lines colored, file headers as context). The new-session screen SHALL offer the worktree option for Codex profiles like for Claude Code ones. All labels MUST be translated.

#### Scenario: Mode chip
- **WHEN** a Codex session with permission profile `:workspace` and approval policy `on-request` is open
- **THEN** the chip reads "Workspace" and tapping it opens the picker with Workspace marked and "on-request" as the approval policy

#### Scenario: Full access
- **WHEN** a Codex session runs with permission profile `:danger-full-access`
- **THEN** the chip reads "Full access" in the danger color and the picker does not offer it

#### Scenario: Patch
- **WHEN** the conversation has an `apply_patch` call updating `src/app.css`
- **THEN** the card reads `apply_patch(app.css)` and its diff shows the `-` and `+` lines

#### Scenario: Worktree for Codex
- **WHEN** the user picks a Codex profile in New session
- **THEN** the worktree toggle is shown

#### Scenario: No worktree for Codex
- **WHEN** the user picks a Codex profile and a folder that is not a git checkout
- **THEN** the session starts without a worktree, the same as for Claude Code
