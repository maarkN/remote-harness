# Agent & provider icons

`ClaudeIcon` draws Claude Code's spark, the glyph it shows in the terminal: the same path as the
landing's mark (`apps/web/src/agent-marks.ts`), from lobe-icons (`@lobehub/icons-static-svg`
1.95.1, MIT, https://github.com/lobehub/lobe-icons), kept in `paths.ts` and checked against the
landing by `agent-icons.test.ts`. "Claude" and "Claude Code" are trademarks of Anthropic, PBC; the
README and the site footer carry the trademark note.

The other icons (`CodexIcon`, `KimiIcon`, `QwenIcon`, `OpenRouterIcon`) are **neutral
placeholders** — a diamond, a triangle, a hexagon and an outlined fork. They are not OpenAI's,
Moonshot's, Alibaba's or OpenRouter's actual marks.

## Replacing a placeholder with the real mark

For each company:

1. Get the current brand/logo guidelines and an official SVG or vector source directly from that
   company (their brand page, press kit, or developer docs).
2. Confirm nominative use (identifying a compatible tool, no implied endorsement) is allowed, and
   note any restriction on modifying the mark (most require it to stay unmodified except for a
   monochrome recolor).
3. Replace only that id's component file, keeping its exported name and the `{ size, color }` props
   (`AgentIconProps` in `types.ts`) so every caller (`AgentBadge`, `ProviderChip`) needs no changes.
4. Record the asset's source and terms somewhere in the repo (e.g. this file, or
   `apps/mobile/assets/brands/README.md` if one exists) so the license basis is traceable.
5. If a company's guidelines forbid the use needed here, leave that one id's placeholder in place —
   `agentIconFor` and the fallback to the two-letter code/text-only chip keep working either way.
