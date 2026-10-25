## 1. Stores

- [x] 1.1 Theme store: `restored` flag set once the saved theme is read (saved or not); initial `system` from `Appearance.getColorScheme()`
- [x] 1.2 App icon store: `restored` flag set once the saved preference is read

## 2. Apply once

- [x] 2.1 Pure `iconToApply()` in `app-icon.ts`: nothing before both stores are restored, nothing when the target is the current icon or the one already requested this launch
- [x] 2.2 `useApplyAppIcon()` uses it on iOS and Android and remembers the requested icon
- [x] 2.3 Vitest cases for `iconToApply()` (not restored, unchanged, changed, already requested, Original)

## 3. Verify

- [x] 3.1 Typecheck, tests, Biome and `openspec validate --strict`
