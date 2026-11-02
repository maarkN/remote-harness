## 1. Logic

- [x] 1.1 `commands/logic.ts`: `isShellBlock(language)`, `shellCommandText(code)` (console prompts stripped); tests
- [x] 1.2 `commands/run-context.ts` (the session screen provides `run`, consumers read it) and `command-menu.ts` (Copy / Run on the computer: action sheet on iOS, alert on Android)

## 2. UI

- [x] 2.1 `CommandSheet`: `initialCommand` prefills the field when it opens; session screen keeps the prefill and provides the context around the conversation
- [x] 2.2 `ToolCallCard`: long press and accessibility actions on a `Bash` call; `Markdown` code block: the same for shell blocks
- [x] 2.3 i18n pt-BR, en-US, es-ES; web docs

## 3. Verify

- [x] 3.1 `turbo run typecheck test`, Biome, `expo export --platform ios`
