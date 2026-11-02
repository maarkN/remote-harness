## 1. Logic

- [x] 1.1 `commands/logic.ts`: `commandLines`, `commandScript` (`set -e` for several lines), `commandEcho`; `promptBlock` echoes every line; tests
- [x] 1.2 `use-command-run.ts`: sends the script, keeps the typed lines as the run's command

## 2. Sheet

- [x] 2.1 `CommandSheet.tsx`: multi-line field, Run / Command+Return, hint, size-limit guard, confirmation with every line, `$` echo in the panel
- [x] 2.2 i18n pt-BR, en-US, es-ES; web docs

## 3. Verify

- [x] 3.1 `turbo run typecheck test`, Biome, `expo export --platform ios`
