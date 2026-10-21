## 1. Pure logic

- [x] 1.1 `apps/mobile/src/features/sessions/collapse.ts`: `markTransforms(expandedSlot, compactSlot)` → translate/scale of each end, scaling the 22 pt glyph around its center; Vitest.

## 2. Screen

- [x] 2.1 Compact list route hides the stack header; `SessionsScreen` keeps the top safe area in that mode.
- [x] 2.2 Title row (mark slot, "Sessions", settings) as the first row of the collapsing header on compact width.
- [x] 2.3 Single animated mark between the two slots; the compact bar gets a mark slot and the settings button.

## 3. Verification

- [x] 3.1 `pnpm check` green and `npx expo export --platform ios` bundles.
