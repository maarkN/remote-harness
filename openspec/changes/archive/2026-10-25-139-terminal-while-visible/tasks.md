## 1. Terminal

- [x] 1.1 `frame-write.ts`: full or changed-row writes with carried SGR styles; tests.
- [x] 1.2 Page `writeFrame` (full redraw only on resize), regenerated with `pnpm xterm`.
- [x] 1.3 `TerminalView` draws at most once per display frame; a reloaded page redraws in full.
- [x] 1.4 `TerminalScreen` subscribes only while focused and in the foreground.

## 2. Validation

- [x] 2.1 `turbo run typecheck test`, Biome and `npx expo export --platform ios` green.
