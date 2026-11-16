## 1. Model

- [x] 1.1 Tests first in `features/permissions/strip.test.ts`: the model lists every item oldest first (the old `oldest` / `next` / `more` cases rewritten on `items`); `stripItemKey`; `deckFront` keeps the front by key, falls back to the same index clamped when it is gone and to the oldest when never moved; `deckStep` wraps both ways; `deckEdges` is 0, 1, 2, 2 for 1, 2, 3, 5 items; verify they fail
- [x] 1.2 `strip.ts`: `StripModel` with `items`, and the four helpers; verify the tests pass

## 2. Strip

- [x] 2.1 `WaitingStrip`: one item unchanged; two or more as a deck (edges, counter pill in the header, front item's elapsed time), tap on the counter for the next, horizontal swipe for next / previous, the front card entering with an animation, no motion with Reduce Motion, announcements on move; "+N more" removed; verify typecheck and Biome
- [x] 2.2 Texts (counter label and hint, the move announcement) in pt-BR, en-US and es-ES, the `more` keys removed from the three; verify the i18n parity test

## 3. Verification

- [x] 3.1 `turbo run typecheck test` (all packages but the Go relay), Biome and `expo export --platform ios` green
- [x] 3.2 On the iOS simulator (iPhone 17 Pro, pt-BR, development build, the demo with two temporary extra requests, not committed): three items show as a deck with two edges and "1/3 ›"; the counter goes to 2/3, a right swipe back to 1/3, two left swipes to 3/3; Permitir on the third (a non-oldest item) answers it and the second comes forward with "2/2 ›" and one edge (caught mid-animation); Permitir again leaves one item, shown as before with "ESPERANDO VOCÊ · 1"; light and dark themes
- [ ] 3.4 Pending: the deck on the iPad list column and in the dracula, mocha and latte themes (same tokens, not looked at)
- [ ] 3.3 Pending: VoiceOver and TalkBack announcements, Reduce Motion on a device, and the deck on an Android phone
