## 1. Demo script

- [x] 1.1 Spawn the daemon as `node --import tsx src/cli.ts start --dev` so `stop` waits for the daemon itself
- [x] 1.2 `--clean` removes the demo's data home even without a manifest; the refusal for that folder alone suggests `--clean`

## 2. Verify

- [x] 2.1 Stop with SIGINT and SIGTERM, with and without `--perf`: nothing the demo created is left
- [x] 2.2 A leftover `.remote-harness-demo/state.json` from the old script: the start refuses with the hint, `--clean` removes it
- [x] 2.3 `turbo run typecheck test` and Biome green
