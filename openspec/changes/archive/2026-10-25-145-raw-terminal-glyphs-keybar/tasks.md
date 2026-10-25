## 1. Glyphs

- [x] 1.1 `GLYPH_SUBSTITUTES` in `frame-write.ts` (`⏺` → `●`, `⏵` → `►`, `⎿` → `└`) applied by `frameLines`; Vitest covers the mode line, a tool result and that every substitute is a single non-emoji code point
- [x] 1.2 Check the choice against the fonts: no font of an API 37 Android image has U+23F5 or U+23BF, while the substitutes are covered by Android, JetBrains Mono and Menlo

## 2. Key bar

- [x] 2.1 `KeyBar` `wrap` option (every key, wrapped into rows); `TerminalScreen` `wrapKeys`, set by the inspector; typecheck green

## 3. Verification

- [x] 3.1 10.1" Android tablet emulator, release build, paired with the demo daemon: the inspector terminal shows `►► accept edits on` and `└` lines, and all 20 keys in four rows with none cut off
- [x] 3.2 `turbo run typecheck test` and Biome green
