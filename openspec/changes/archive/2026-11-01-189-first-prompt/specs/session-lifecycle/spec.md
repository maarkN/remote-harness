## ADDED Requirements

### Requirement: First prompt at start
`session.start` SHALL accept an optional `prompt`, a non-empty string of at most 8 KB. A larger prompt MUST be rejected with `too_large`, and a prompt for a profile whose agent CLI cannot take an initial prompt (Kimi CLI) with `bad_request`, both before anything is launched. The daemon SHALL hand the prompt to the agent CLI as its initial prompt, the way a user would from a terminal (`claude … -- <prompt>`, `codex … -- <prompt>`, `gemini`/`qwen … --prompt-interactive <prompt>`), so the CLI submits it itself as soon as it is ready and stays interactive; the prompt MUST reach the tmux window through the window's environment, never on the tmux command line, and MUST arrive intact, line breaks and shell characters included. A session started with a prompt registers and turns `running` on its own (its `SessionStart` and `UserPromptSubmit` hooks), so `session.started` is unchanged and the session's title follows the prompt as for any first prompt. Without `prompt`, the start behaves as before. Every logged start SHALL say whether it carried a prompt, never the prompt itself.

#### Scenario: Claude Code with a first prompt
- **WHEN** the app starts a Claude Code session with `prompt` "Review the open PR.\nList the risks."
- **THEN** the launcher receives the prompt in its environment, the window runs `claude … -- "<prompt>"` with both lines intact, and the session appears `running` with that prompt as its first turn

#### Scenario: Codex with a first prompt
- **WHEN** the app starts a Codex session with a `prompt`
- **THEN** `codex … -- "<prompt>"` starts its first turn at once, whose `SessionStart` hook registers the session

#### Scenario: Prompt too large
- **WHEN** `session.start` carries a `prompt` over 8 KB
- **THEN** the daemon replies `error` `too_large` and launches nothing

#### Scenario: Agent without an initial prompt
- **WHEN** `session.start` carries a `prompt` for a Kimi CLI profile
- **THEN** the daemon replies `error` `bad_request` and launches nothing

#### Scenario: No prompt
- **WHEN** `session.start` carries no `prompt`
- **THEN** the launcher gets no prompt variable and the window command is the same as before

### Requirement: First prompt field on the New session screen
The New session screen SHALL show an optional multi-line "First prompt" field under the Name field when the selected profile's agent takes an initial prompt (Claude Code, Codex, Gemini CLI, Qwen Code), and hide it otherwise (Kimi CLI). Its text, trimmed, SHALL be sent as `prompt` only when not empty. With a prompt, a successful start SHALL behave as without one (the session opens or the screen returns to the list, per the "Open the session after creating it" setting). A `too_large` rejection SHALL be shown as a translated error under Start. All texts MUST be translated.

#### Scenario: Start with a first prompt
- **WHEN** the user types "Run the tests and fix what fails" in First prompt and taps `Start session`
- **THEN** `session.start` carries that text as `prompt` and the conversation opens with the prompt as its first turn

#### Scenario: Blank field
- **WHEN** First prompt is empty or only whitespace
- **THEN** `session.start` carries no `prompt`

#### Scenario: Kimi CLI profile
- **WHEN** the selected profile runs Kimi CLI
- **THEN** the First prompt field is not shown
