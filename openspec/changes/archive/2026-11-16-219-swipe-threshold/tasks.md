## 1. Threshold logic

- [x] 1.1 Tests first in `features/sessions/swipe.test.ts`: the panel width of two actions (168 pt), the full-swipe distance (half of a 393 pt row; panel + 24 on a narrow row), the side armed by a translation, and the regression of #559 (the resting open position never arms); verify they fail against the old 150 pt constant
- [x] 1.2 `features/sessions/swipe.ts`: `panelWidth`, `fullSwipeDistance`, `armedSide` (worklet) and the release tracker (`startDrag` / `arm` / `release`: fires only the side armed while a drag is in progress); verify the tests pass

## 2. Row

- [x] 2.1 `SwipeableRow`: `friction={1}`, overshoot on, the row width measured on layout, a reaction that arms and disarms each side with a haptic, firing only from the release callbacks while dragging, the outermost action stretching past the panel, a tapped action closes the row; verify typecheck and Biome

## 3. Undo after hiding

- [x] 3.1 `ui/UndoBar` (message, action, 5 s timer, screen reader announcement, fade in and out) and the "Session hidden" / "Undo" texts in pt-BR, en-US and es-ES; verify the i18n parity test
- [x] 3.2 `SessionsScreen`: every hide shows the bar (clear of the new-session button), Undo un-hides, a newer hide replaces it; verify typecheck

## 4. Verification

- [x] 4.1 `turbo run typecheck test` (all packages but the Go relay), Biome and `expo export --platform ios` green
- [x] 4.2 On the iOS simulator (iPhone 17 Pro, pt-BR, demo, development build): an 80 pt drag or flick reveals Silenciar / Fixar and Mais / Encerrar (or Ocultar) and runs nothing; a 200 pt drag (under half of the 402 pt row) still runs nothing; past half the row "Encerrar" stretches, and on release the session is muted / unmuted or the close confirmation opens; a full swipe on the read-only session hides it and shows "Sessão oculta · Desfazer" clear of the + button, Desfazer brings it back (6 → 5 → 6 sessions), and left alone the bar leaves after 5 s with the session still hidden
- [ ] 4.3 Pending: the haptic tick on crossing, on an iPhone and an Android phone; the swipe on iPad (master column) and on Android
