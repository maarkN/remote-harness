## 1. Layout logic

- [x] 1.1 Tests first in `features/conversation/session-menu.test.ts`: `sessionSheet` keeps the menu's order without Close session (returned apart), gives each cell its short label and, for the toggles, its on state (key bar, hands-free, follow output, live status), and passes the disabled reason through; verify they fail
- [x] 1.2 `sessionSheet` in `session-menu.ts`; verify the tests pass

## 2. Shared sheet

- [x] 2.1 `ui/Sheet`: modal bottom sheet (backdrop sibling that closes it, Android back, Esc, safe area, rounded top, optional header with title and close button, scrolling content, at most 560 pt and centered on regular width); exported from `ui`; verify typecheck

## 3. Session sheet

- [x] 3.1 `SessionSheet`: summary, icon grid (lucide icon per action, short label, highlighted toggles, Subagents dot, dimmed disabled cells and the reason), details (`SessionDetailsList`), Close session apart; ↑ / ↓ / Enter keyboard navigation; verify typecheck and Biome
- [x] 3.2 Session route: the title, the folder, the status line's details, ⋮ (an icon button with the subagents dot) and ⌘⇧O open the sheet; `SessionDetailsSheet` and `ActionMenu` removed; verify typecheck
- [x] 3.3 Short labels and the sheet's texts in pt-BR, en-US and es-ES; verify the i18n parity test

## 4. Verification

- [x] 4.1 `turbo run typecheck test` (all packages but the Go relay), Biome and `expo export --platform ios` green
- [x] 4.2 On the iOS simulator (iPhone 17 Pro, pt-BR, demo, development build): the title and ⋮ open the same sheet (summary, grid, "Detalhes da sessão", "Encerrar sessão" apart) and ⋮ keeps the subagents dot; the "Dark mode toggle" grid holds Terminal, Comando, Subagentes (with the dot), Atalhos, Mãos livres, Modelos de prompt, Histórico, Alterações and Acompanhar (highlighted while on); Acompanhar turns following off and the next sheet announces "Acompanhar a saída"; Modelos de prompt closes the sheet and opens the templates picker; Terminal opens the terminal screen; Encerrar sessão opens the close confirmation; the ended Terraform session shows Terminal, Atalhos, Mãos livres, Modelos de prompt and Encerrar sessão disabled with the read-only reason, the others enabled; light and dark. The React Compiler report keeps 48 skipped functions
- [ ] 4.3 Pending: the sheet on iPad (centered, inspector layout) and on Android (back button), and VoiceOver / TalkBack labels
