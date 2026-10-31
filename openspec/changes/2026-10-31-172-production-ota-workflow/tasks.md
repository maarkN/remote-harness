## 1. Workflow

- [x] 1.1 `.github/workflows/ota-production.yml`, mirroring `ota-development.yml`: push to `main` (same path filters) + `workflow_dispatch`, `concurrency: ota-production`, `OTA_SIGNING_KEY` + `OTA_PROD_TOKEN` secrets, `pnpm --filter @remote-harness/mobile ota:publish --channel production`

## 2. Verify

- [x] 2.1 `openspec validate production-ota-workflow --strict`
- [x] 2.2 YAML is well-formed (`actionlint` not available here; checked by hand against `ota-development.yml`'s structure)

## 3. Ops (outside this change)

- [ ] 3.1 Add the `OTA_PROD_TOKEN` repository secret from the server's `UPDATES_TOKEN` — whoever has SSH access to the server does this; the workflow no-ops until it exists
