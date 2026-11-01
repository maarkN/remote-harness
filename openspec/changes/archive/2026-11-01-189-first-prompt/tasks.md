## 1. Protocol

- [x] 1.1 `session.start` takes `prompt: z.string().min(1).optional()` with a doc comment; `packages/protocol/test/protocol.test.ts` accepts a start with a prompt and rejects an empty one (`pnpm --filter @remote-harness/protocol test`)

## 2. Daemon

- [x] 2.1 `AgentAdapter.promptArgs` (arguments before an initial prompt, `null` when the CLI has none): `['--']` for Claude Code and Codex, `['--prompt-interactive']` for Gemini CLI and Qwen Code, `null` for Kimi CLI; pinned in `apps/daemon/test/agents.test.ts`
- [x] 2.2 Launcher: when the agent has `promptArgs`, stash `CLAUDE_REMOTE_PROMPT`, unset it, pass it to the window with `-e` and append ` <promptArgs> "$CLAUDE_REMOTE_PROMPT"` to the command line; test with the fake tmux in `apps/daemon/test/hooks.test.ts` that a two-line prompt with quotes reaches `-e` intact, the command line ends with the literal expansion, and a start without a prompt adds nothing
- [x] 2.3 `LifecycleService.start` accepts `prompt`: `bad_request` for an agent without `promptArgs`, `too_large` over `MAX_FIRST_PROMPT_BYTES` (8 KB), both before `launch`; the launcher runs with `CLAUDE_REMOTE_PROMPT` in its environment; the `session.start` handler passes `msg.prompt` and logs `prompted`; tests in `apps/daemon/test/lifecycle.test.ts` (`pnpm --filter @remote-harness/daemon exec vitest run test/lifecycle.test.ts test/agents.test.ts test/hooks.test.ts`)

## 3. App

- [x] 3.1 `cleanFirstPrompt(input)` (trim, undefined when blank) and `canStartWithPrompt(agent)` in `features/lifecycle/new-session.ts`, with tests in `new-session.test.ts`
- [x] 3.2 New session screen: multi-line "First prompt (optional)" field under Name, shown only when `canStartWithPrompt`, sent as `prompt`; `startErrorMessage` maps `too_large`; i18n keys `newSession.firstPrompt`, `firstPromptPlaceholder`, `firstPromptHint`, `errors.promptTooLarge` in pt-BR, en-US, es-ES (parity test passes)

## 4. Verify

- [x] 4.1 `pnpm turbo run typecheck test`, Biome (with the worktree ignore tweak), `npx expo export --platform ios` in `apps/mobile`
