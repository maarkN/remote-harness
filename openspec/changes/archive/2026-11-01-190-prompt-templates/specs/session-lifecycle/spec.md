## MODIFIED Requirements

### Requirement: First prompt field on the New session screen
The New session screen SHALL show an optional multi-line "First prompt" field under the Name field when the selected profile's agent takes an initial prompt (Claude Code, Codex, Gemini CLI, Qwen Code), and hide it otherwise (Kimi CLI). Under the field, a "Use a template…" button SHALL open the templates picker (see `prompt-templates`), whose pick fills the field. Its text, trimmed, SHALL be sent as `prompt` only when not empty. With a prompt, a successful start SHALL behave as without one (the session opens or the screen returns to the list, per the "Open the session after creating it" setting). A `too_large` rejection SHALL be shown as a translated error under Start. All texts MUST be translated.

#### Scenario: Start with a first prompt
- **WHEN** the user types "Run the tests and fix what fails" in First prompt and taps `Start session`
- **THEN** `session.start` carries that text as `prompt` and the conversation opens with the prompt as its first turn

#### Scenario: Start from a template
- **WHEN** the user picks a template with "Use a template…" and taps `Start session`
- **THEN** `session.start` carries the template's filled text as `prompt`

#### Scenario: Blank field
- **WHEN** First prompt is empty or only whitespace
- **THEN** `session.start` carries no `prompt`

#### Scenario: Kimi CLI profile
- **WHEN** the selected profile runs Kimi CLI
- **THEN** the First prompt field is not shown
