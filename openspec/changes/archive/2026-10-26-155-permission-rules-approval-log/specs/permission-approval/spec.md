## MODIFIED Requirements

### Requirement: Always allow
With `always { rule, scope }`, the daemon SHALL approve the request and persist the rule in `permissions.allow`: scope `profile` in the profile's `settings.json`; scope `project` in the `.claude/settings.local.json` of the session's `cwd`. The rest of the file MUST be preserved and the rule recorded in the daemon's rules log, so any device or the CLI can undo it. Undoing removes the rule from the file it was written to by read → merge → backup next to the file (`<file>.bak-claude-remote`) → atomic write, and is idempotent.

#### Scenario: Project rule
- **WHEN** the app approves with `always { rule: "Bash(pnpm test:*)", scope: "project" }`
- **THEN** the project's `.claude/settings.local.json` now contains the rule and the next `pnpm test` does not ask for permission

#### Scenario: Undo
- **WHEN** the user runs `remote-harness rules undo <id>` or a device sends `rules.undo { ruleId }`
- **THEN** the rule is removed from the file it was written to, a backup of the previous file sits next to it, and the other keys of the file are unchanged

#### Scenario: Undo of a rule already gone
- **WHEN** the rule of a `rules.undo` is no longer in its file
- **THEN** the file is not written and the daemon answers `ack`

## ADDED Requirements

### Requirement: Rule listing
`rules.list` SHALL answer `rules.result` with the `permissions.allow` entries of the `settings.json` of every profile whose agent takes permission rules (scope `profile`) and of the `.claude/settings.local.json` of every project with a known session (scope `project`; a worktree's project rules live in its main checkout's file), grouped by file. Each rule SHALL be marked `app` (an app-created rule: in the rules log and still in its file, with the log ID and creation time) or `hand` (a hand-written rule). Files that do not exist or have no rules are left out.

#### Scenario: Both kinds in one file
- **WHEN** a project's `settings.local.json` holds `Bash(ls:*)` written by hand and `Bash(pnpm test:*)` created from the app
- **THEN** `rules.result` lists that file with scope `project`, `Bash(ls:*)` as `hand` and `Bash(pnpm test:*)` as `app` with its log ID

### Requirement: Rule deletion
`rules.delete { file, rule }` SHALL remove the rule from the file only when the file is one `rules.list` would list; any other path is rejected with `not_found`. The removal follows read → merge → backup next to the file → atomic write and is idempotent (a rule already gone answers `ack` without writing).

#### Scenario: Hand-written rule deleted
- **WHEN** a device sends `rules.delete` for `Bash(ls:*)` of a listed `settings.local.json`
- **THEN** the rule is gone from the file, the previous file is kept as `settings.local.json.bak-claude-remote` and the other keys are unchanged

#### Scenario: Path outside the listing
- **WHEN** a device sends `rules.delete` with `file: "/etc/hosts"`
- **THEN** the daemon answers `not_found` and writes nothing

### Requirement: Approval log
The daemon SHALL append to its approval log every Allow and Deny a device answers (`permission.respond`, and plan approvals through `permission.answer`) and every rule undo or delete, with the time, the action (`allow`, `deny`, `undo`, `delete`; `always` set for an allow that created a rule), the paired device (ID and name; none for the CLI), the session ID and the base name of its folder, the tool, and a short target from the live status table (`stepTarget`: base file name, command program, URL host). The tool input MUST NOT be logged; rule actions carry the rule text, already present in the settings file. Entries older than 30 days SHALL be dropped. `approvals.list` answers `approvals.result` with the entries, most recent first, at most 500; `remote-harness approvals list` prints them.

#### Scenario: Allow from a device
- **WHEN** the device "Pixel 9" allows `Bash` with `git commit -m "secret"` in a session in `~/code/app`
- **THEN** the log gets `allow` with that device, the session, folder `app`, tool `Bash` and target `git commit`, and nothing of the message

#### Scenario: Retention
- **WHEN** the log holds an entry from 31 days ago
- **THEN** `approvals.list` does not return it and the daemon drops it from the file

#### Scenario: Answer in the terminal
- **WHEN** a request is answered in the terminal or expires
- **THEN** nothing is logged
