## 1. Geometry and assets

- [x] 1.1 `icons.mts`: Cursor Signal geometry (`MARK` cutout/arcs per weight, mask-based cutout), flat `#1C1A17` container with the mark in a 78 % box, favicon with 22 % corners, the four variant sources in `assets/icon/`; `pnpm --filter @remote-harness/mobile icons` regenerates every output
- [x] 1.2 Inspect the small outputs (notification 96 px, favicon 48 px, Live Activity 144 px, Linux symbolic 22 px, adaptive monochrome) and the app icon: the cutout stays visible, no gradient or glow

## 2. Prototypes and sources

- [x] 2.1 Designer sources under `docs/design/identity/branding/`; `shared.js` sprite with the new regular and bold symbols (`--cutout`, `--block`)
- [x] 2.2 `icons.html`: hero and construction section describe the Cursor Signal; `icon-ios`, `icon-android`, `splash` and `og-readme-banner` screens re-exported with headless Chrome

## 3. Specs and verification

- [x] 3.1 `product-identity` "Brand mark" and `app-shell` "App icon" deltas; `openspec validate 193-cursor-signal-mark --strict`
- [x] 3.2 `pnpm turbo run typecheck test`, Biome (worktree ignore tweak), `npx expo export --platform ios`
