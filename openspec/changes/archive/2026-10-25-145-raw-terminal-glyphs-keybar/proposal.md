## Why

On Android the raw terminal showed `□□` for the `⏵⏵` of Claude Code's mode line (and boxes for the `⎿` under each tool call): no Android system font has U+23F5 or U+23BF, and the WebView has no fallback. On a 10-inch tablet the inspector's terminal key bar is a single scrolling row in a 320-point column, so a key is always cut at the screen edge (#344).

## What Changes

- The terminal swaps the characters a platform cannot draw for same-width text glyphs, from one table: `⏺` → `●` (already done for iOS), `⏵` → `►`, `⎿` → `└`.
- In the tablet inspector, the terminal key bar shows every key at once, wrapping into rows; the full-screen terminal keeps the scrolling row.

## Capabilities

### New Capabilities

### Modified Capabilities
- `raw-terminal`: "Terminal in the app" — glyph substitutes and the wrapped key bar in the inspector.

## Impact

- `apps/mobile/src/features/terminal/frame-write.ts` (table + tests), `TerminalScreen.tsx`, `features/conversation/components/KeyBar.tsx` (`wrap`), `features/inspector/InspectorPane.tsx`. JS only (OTA-deliverable).
