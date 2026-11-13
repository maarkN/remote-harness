## 1. Layout

- [x] 1.1 The live timers in `SessionActivity.tsx` use `timerInterval` (count-up, from the state's start to a week later) with `lineLimit(1)` and a minimum scale factor; verify typecheck and Biome pass
- [x] 1.2 The expanded island's bottom region gets horizontal and bottom insets; verify typecheck and Biome pass

## 2. Verification

- [x] 2.1 `pnpm check` green
- [ ] 2.2 Render running, waiting and done from the daemon's `liveProps` on the iOS simulator, in en-US, pt-BR and es-ES: the lock screen timer reads digits with no ellipsis, and no row of the expanded island is cut by its corners or bottom edge
