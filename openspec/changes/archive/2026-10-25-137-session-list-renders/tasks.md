## 1. Session list

- [x] 1.1 Memoized `SessionListItem` with plain props and stable callbacks; stable `renderItem` and `extraData`.
- [x] 1.2 Field selectors for mute and pins; layout-effect ref sync; 150 ms search debounce; memoized nested subagents.

## 2. Other subscribers

- [x] 2.1 Waiting strip (`stripCandidates`, tests), new-session form, muted-sessions sheet.
- [x] 2.2 `stableSessionSelector` (tests) for the session route and the inspector; composer reads state and profile only; details list reads its session by id.

## 3. Validation

- [x] 3.1 `turbo run typecheck test`, Biome and `npx expo export --platform ios` green.
