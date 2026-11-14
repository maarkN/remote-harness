## 1. Protocol

- [x] 1.1 `CommandItemSchema` gains `prefix: z.enum(['/', '$']).default('/')`; verify the protocol tests pass and an item without `prefix` parses as `/`

## 2. Daemon

- [x] 2.1 Move the folder readers out of `features/autocomplete/commands.ts` into a shared module (skill folders with a depth, Markdown and TOML command files named by path, symlinks followed, folder signature); verify the existing Claude Code tests in `apps/daemon/test/autocomplete.test.ts` pass unchanged
- [x] 2.2 Tests first, with fixture folders and a temp home: Codex (profile `skills/`, `.system` as built-in, `~/.agents/skills`, `.agents/skills` and `.codex/skills` from a subfolder up to the repo root, prefix `$`), Gemini (`commands/**/*.toml` in the profile and `.gemini/`, `description` or the first prompt line, skills left out), Kimi (brand and generic folders, Kimi first on a clash, project root by `.git`, `skill:` and `flow:` names), Qwen (`.md` and `.toml` commands, one-level skills, `~/.agents/skills`), project over profile, signatures that change when a skill is added; verify they fail before 2.3
- [x] 2.3 One loader per agent, next to its built-in table in `<agent>-commands.ts`, wired into the four adapters' `commands` and `commandsSignature`; verify the tests of 2.2 pass and the Codex loader lists `hatch-pet` (`$`) from `~/.codex/skills` on this computer

## 3. App

- [x] 3.1 `applySuggestion` inserts `${prefix}${name} `, `sentCommand` matches `/name` and `$name` by each item's prefix (Vitest first); verify the tests pass
- [x] 3.2 `SuggestionList` shows the item's prefix before the name and in the accessibility label; verify typecheck

## 4. Docs

- [x] 4.1 `using-the-app.md` (en-US, pt-BR, es-ES), Sending prompts: per agent, where skills and commands are read from and how they run (`$name` for Codex skills, `/skill:name` for Kimi, Gemini skills by the model only); verify the web docs tests pass

## 5. Verification

- [x] 5.1 `turbo run typecheck test` (all packages but the Go relay) and Biome green
- [ ] 5.2 Pending, on a phone: in a session started from the app, per agent, a global skill shows under Profile and runs when sent, and a project skill under Project (Codex on this computer; Gemini CLI, Kimi CLI and Qwen Code are not installed here)
