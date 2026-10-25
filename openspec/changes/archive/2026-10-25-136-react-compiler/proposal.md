## Why

The React Compiler memoizes components and hooks automatically, which is a cheap, broad answer to the re-render problems the performance epic (#354) attacks one by one. `babel-plugin-react-compiler` already ships with babel-preset-expo, but the compiler is off (`experiments` only sets `typedRoutes`) (#356).

## What Changes

- `experiments.reactCompiler: true` in `apps/mobile/app.config.ts`; babel-preset-expo wires the compiler for the app's own code (not `node_modules`).
- `pnpm --filter @remote-harness/mobile compiler:report` lists the functions the compiler compiles and the ones it skips, with the reason, so later changes can see whether they made a component compile or stop compiling.
- No behavior change: skipped functions keep working without automatic memoization. The skips that matter for the epic (session list, composer, inspector) are handled in #357 and #358.

## Capabilities

### New Capabilities

### Modified Capabilities

No spec-level behavior changes (`skip_specs: true`): the app renders the same, only with fewer re-renders.

## Impact

- `apps/mobile/app.config.ts`, `apps/mobile/package.json` (script), `apps/mobile/scripts/compiler-report.mts`.
- JavaScript only: compatible with the current native builds and over-the-air updates.
