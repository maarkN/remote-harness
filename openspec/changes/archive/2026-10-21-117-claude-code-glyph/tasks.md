## 1. Claude glyph

- [x] 1.1 Put the Claude spark path in a pure module (`apps/mobile/src/ui/agent-icons/paths.ts`, no `react-native` import) and draw it in `ClaudeIcon.tsx` with `react-native-svg` (`Path`, `fill={color}`, 24×24 viewBox).
- [x] 1.2 Vitest: the app's Claude path appears verbatim in the landing's `claude` mark (`apps/web/src/agent-marks.ts`), so the two can't drift.
- [x] 1.3 Update `agent-icons/README.md`: `ClaudeIcon` is the real mark (lobe-icons 1.95.1, MIT, shared with the landing; Anthropic's trademark, covered by the README and footer notes); the others remain placeholders.

## 2. Verification

- [x] 2.1 `pnpm check` green.
- [x] 2.2 `npx expo export --platform ios` bundles; the glyph fits the 14–24 px badge sizes (icon at 60% of the badge, ink on `#D97757`, identical in all five themes since agent colors are fixed).
