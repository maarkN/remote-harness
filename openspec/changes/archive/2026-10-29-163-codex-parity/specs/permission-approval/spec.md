## ADDED Requirements

### Requirement: Always only where rules apply
For a permission request with `rules: false` the app SHALL NOT offer the Always action, in the conversation card and in the waiting strip, and the card SHALL show a short translated note that this agent cannot save always-allow rules from the app and the terminal's own "don't ask again" option should be used instead. An `always` sent anyway for such a request MUST be refused with `bad_request`, writing no rule and leaving the request open.

#### Scenario: Codex request
- **WHEN** a permission request with `rules: false` is shown
- **THEN** the card has Deny and Allow only, plus the note about always-allow rules

#### Scenario: Claude Code request
- **WHEN** a permission request with `rules: true` is shown
- **THEN** the card has Deny, Always and Allow as before
