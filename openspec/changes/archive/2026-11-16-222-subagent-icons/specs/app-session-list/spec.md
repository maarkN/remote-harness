## MODIFIED Requirements

### Requirement: Row anatomy
Each row SHALL show: the agent badge (20 pt rounded square in the agent's fixed color with its two-letter code), the title and the relative time on the first line; the folder, the branch (`⎇`), a `worktree` hint when the folder is under `.claude/worktrees`, and the shared-checkout warning on the second line; the state pill (running = accent, waiting = warning, idle = success, ended = muted), the pending-permission badge, a plain `read-only` pill, the profile tag (name in the profile color), a muted glyph when the session or its profile is muted, the subagents' state icons (see the `subagents` capability) and the background-tasks pill on the third line, with a chevron at the end, in both list densities. A waiting row SHALL keep the warning border and a selected row the accent border. The agent color MUST NOT change with the state.

#### Scenario: Waiting Claude Code session
- **WHEN** a Claude Code session of the Work profile waits for a permission in a worktree
- **THEN** its row shows the `cl` badge, the title, "4 min", the folder, the branch, "worktree", the warning border, the "waiting" pill and "Work" in the profile color

#### Scenario: Muted session with subagents
- **WHEN** a muted session has two subagents
- **THEN** the third line shows the muted glyph and two subagent icons
