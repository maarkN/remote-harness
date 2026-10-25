This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Performance

The floor is the iPad 9th gen and the Redmi 8 (3 GB, slow JavaScript thread). These rules come from the performance epic (#354):

- **React Compiler is on** (`experiments.reactCompiler`). It skips functions it cannot compile: no ref reads or writes during render (sync refs in a layout effect), no `try/finally` in components and hooks. Check with `pnpm --filter @remote-harness/mobile compiler:report` that a change does not add skipped functions.
- **List rows** (FlashList) are memoized components with plain props. `renderItem` and every callback handed to rows stay stable (`useStableCallback` from `core/utils`); never build arrays, objects or closures for a row inline in `renderItem`. Pass `extraData` as a memoized value.
- **Zustand**: select the fields a component shows, never a whole store or a whole map. Derived arrays go through `useShallow`. A screen that does not show a session's status line or activity time reads it with `useStableSession` (`features/sessions`), not `s.sessions[id]`.
- **Transcript**: entries and their timeline live in the transcript store (`extendTimeline`, live entries batched per frame); never rebuild the whole conversation during render. Expensive per-item work (diffs, markdown) is cached per entry object or done when the item is shown.
- **Streams** (pane frames, timers) run only while their screen is visible: `useIsFocused()` and the app in the foreground.
- **Memory**: closed conversations keep their last 500 entries and only the 3 most recent stay in memory; the image cache holds about 12 MB. Do not add caches without a bound.
- **Measure**: performance changes post before/after numbers from the demo's `--perf` scenario and Settings → Performance (this run), on release builds of the iPad 9th gen and the Redmi 8 (`CONTRIBUTING.md` → Performance numbers).
