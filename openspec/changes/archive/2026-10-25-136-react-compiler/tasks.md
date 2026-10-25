## 1. Compiler

- [x] 1.1 `experiments.reactCompiler: true` in `app.config.ts`.
- [x] 1.2 `compiler:report` script listing compiled and skipped functions; list in the PR.

## 2. Validation

- [x] 2.1 `turbo run typecheck test`, Biome and `npx expo export --platform ios` green; the bundle contains compiled components.
- [x] 2.2 Smoke test on a Release simulator build against the demo: session list, conversation, composer, settings.
