## MODIFIED Requirements

### Requirement: Works with strip
Under the hero, the "Works with" strip SHALL show one chip per agent or provider, each with its mark, in this order: Claude Code, Codex CLI, Gemini CLI, Kimi, Qwen Code, OpenRouter models. Every agent chip SHALL be shown as available, with no "soon" tag; OpenRouter SHALL carry a translated "via profiles" note. Every text on the page that says which agents are supported (FAQ, how it works, requirements, docs) SHALL agree with the strip in the three languages.

#### Scenario: Codex is supported
- **WHEN** a visitor looks at the "Works with" strip
- **THEN** Codex CLI is the second chip, styled like Claude Code and without the "soon" tag

#### Scenario: Gemini is supported
- **WHEN** a visitor looks at the "Works with" strip
- **THEN** Gemini CLI is the third chip, styled like Claude Code and without the "soon" tag

#### Scenario: Kimi is supported
- **WHEN** a visitor looks at the "Works with" strip
- **THEN** Kimi is the fourth chip, styled like Claude Code and without the "soon" tag

#### Scenario: Agents still coming
- **WHEN** a visitor looks at the "Works with" strip
- **THEN** no agent chip is dimmed or tagged "soon"

#### Scenario: Qwen Code is supported
- **WHEN** a visitor looks at the "Works with" strip
- **THEN** Qwen Code is the fifth chip, styled like Claude Code and without the "soon" tag, and OpenRouter comes last with "via profiles"

#### Scenario: FAQ agrees
- **WHEN** a visitor opens "Which agents are supported?" in any language
- **THEN** the answer names Claude Code, Codex CLI, Gemini CLI, Kimi CLI and Qwen Code as supported and no agent as planned
