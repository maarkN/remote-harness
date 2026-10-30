## 1. Daemon

- [x] 1.1 Remove `infra/network.ts`, `--wait-tailscale` (old service arguments still accepted), Tailscale checks in `doctor` / `pair` / `service install`; service definitions without the flag (tests).
- [x] 1.2 Setup: pairing step instead of the Tailscale step; WSL offers mirrored networking for the direct path only (tests).
- [x] 1.3 i18n pt-BR / en-US / es-ES without Tailscale (parity tests).

## 2. App

- [x] 2.1 Setup guide and unreachable checklist without Tailscale (tests); pairing / timeout texts; i18n.
- [x] 2.2 Store metadata, local network copy, ATS / cleartext narrowed to the direct path.
- [x] 2.3 `ios-link`: only the site mode.

## 3. Docs

- [x] 3.1 Web docs and landing copy in three languages; docs test.
- [x] 3.2 README (both), SECURITY, CONTRIBUTING, CLAUDE.md, Makefile help; in-flight changes 25 and 27.

## 4. Validation

- [x] 4.1 `rg -i tailscale` only in archived changes, the PRD, `docs/design` and the ADR that records the decision.
- [x] 4.2 `turbo run typecheck test`, Biome, `npx expo export --platform ios`.
