## Why

Production OTA updates only go out by hand (`make publish-ota`), which needs the signing private key and the full `UPDATES_TOKEN` on whoever's machine runs it. `development` already publishes itself in CI on every push (`ota-development.yml`); production should work the same way, since `main` only moves on a release merge (see `CONTRIBUTING.md`'s branching model) — the gate is already the release PR, not an extra manual publish step.

## What Changes

- A new `ota-production.yml` workflow, mirroring `ota-development.yml`: triggers on `push` to `main` (paths: `apps/mobile/**`, `packages/protocol/**`, `pnpm-lock.yaml`, the workflow file itself) plus `workflow_dispatch`, one job at a time (`concurrency: ota-production`), no secrets visible to pull requests.
- Reuses the existing `OTA_SIGNING_KEY` secret (the signing key isn't channel-scoped). Needs a new secret, `OTA_PROD_TOKEN`, holding the server's full `UPDATES_TOKEN` (works for any channel, unlike the restricted `UPDATES_DEV_TOKEN`) — not set by this change; whoever has server access adds it to the repo's secrets.
- `make publish-ota` stays for an ad hoc/local publish; this just removes the requirement to run it for every normal release.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `updates-server`: the `ota-production.yml` workflow is a recognized publisher, alongside `make publish-ota`, `make publish-ota-dry` and `ota-development.yml`.

## Impact

`.github/workflows/ota-production.yml` (new). No app or daemon code changes. Ops: add the `OTA_PROD_TOKEN` repository secret before this can actually publish (the workflow's own "Check the secrets" step skips the publish silently when it's missing, same as `ota-development.yml` does for its own token).
