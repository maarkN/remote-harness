## 1. Layout

- [x] 1.1 Lock screen card in `SessionActivity.tsx`: header row with the session name, the profile · machine · folder line, timer at 26 pt, phrase with the glyph row beside it while working, current step line, then progress bar / small buttons / hint; waiting without the phrase and glyphs; padding 10 pt vertical and 4 pt between rows; verify typecheck and Biome pass
- [x] 1.2 Expanded Dynamic Island: session name, pill with glyphs (waiting: pill with the current step), then the buttons (waiting) or the phrase and the current step line; no folder or progress bar; verify typecheck and Biome pass

## 2. Verification

- [x] 2.1 `pnpm check` green
- [ ] 2.2 Render working, waiting, done and closed from the daemon's `liveProps` on the iOS simulator (lock screen and expanded island), on the smallest supported iPhone and on iPad, in en-US, pt-BR and es-ES, with a long title and a todo list: no row clipped, Deny / Allow fully visible
- [ ] 2.3 On a physical iPhone, Deny and Allow on the lock screen and in the expanded island answer the permission
