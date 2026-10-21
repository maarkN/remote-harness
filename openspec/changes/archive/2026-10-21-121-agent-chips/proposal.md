## Why

Issue #304: the landing's "Works with" strip lists Claude Code, OpenRouter models, then Codex CLI, Kimi and Qwen Code as "soon". Codex is supported since #108, so it must not be marked as coming, and the order does not match the product's agent order (Claude Code, Codex, Kimi, Qwen, then providers).

## What Changes

- "Works with" chips in the order Claude Code, Codex CLI, Kimi, Qwen Code, OpenRouter models; Codex styled like Claude Code (no dashed border, no "soon"); Kimi and Qwen keep "soon"; OpenRouter keeps "via profiles".
- Copy that says which agents are supported now names Codex too, in en-US, pt-BR and es-ES: the meta description and hero lead, the FAQ "Which agents are supported?", the "How it works" agents node (its alias list gains a Codex profile with the Codex mark), the requirements chip (`claude` or `codex` on PATH), and the docs (index, getting started requirements).
- README already lists Codex as supported and Kimi / Qwen as planned; the store metadata does not name agents. No change there.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-landing`: the "Works with" strip's order and which agents it marks as coming.

## Impact

`apps/web/src/landing.ts` (`agents()`, `how()`), the three catalogs (aliases become `{ mark, text }`), `apps/web/content/*/index.md` and `getting-started.md`, `apps/web/test/landing.test.ts`.
