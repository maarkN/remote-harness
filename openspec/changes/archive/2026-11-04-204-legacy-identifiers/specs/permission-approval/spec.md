## MODIFIED Requirements

### Requirement: Rule deletion
`rules.delete { file, rule }` SHALL remove the rule from the file only when the file is one `rules.list` would list; any other path is rejected with `not_found`. The removal follows read → merge → backup next to the file → atomic write and is idempotent (a rule already gone answers `ack` without writing).

#### Scenario: Hand-written rule deleted
- **WHEN** a device sends `rules.delete` for `Bash(ls:*)` of a listed `settings.local.json`
- **THEN** the rule is gone from the file, the previous file is kept as `settings.local.json.bak-remote-harness` and the other keys are unchanged

#### Scenario: Path outside the listing
- **WHEN** a device sends `rules.delete` with `file: "/etc/hosts"`
- **THEN** the daemon answers `not_found` and writes nothing
