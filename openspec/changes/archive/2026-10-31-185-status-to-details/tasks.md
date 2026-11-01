## 1. Status sheet

- [x] 1.1 `StatusSheet` takes an optional details action and renders the **Session details** row (label, hint, chevron) above Close; `StatusBar` takes `onDetails`, closes its sheet and hands over to it once the sheet is gone (iOS cannot present a modal while another is dismissing); typecheck passes
- [x] 1.2 Session route passes its `openDetails` to the status bar; the same sheet the header title opens
- [x] 1.3 i18n keys `sessionStatus.details` / `sessionStatus.detailsHint` in pt-BR, en-US and es-ES; parity tests pass

## 2. Verify

- [x] 2.1 `openspec validate 185-status-to-details --strict`, `turbo run typecheck test`, Biome (worktree workaround), `expo export --platform ios`
