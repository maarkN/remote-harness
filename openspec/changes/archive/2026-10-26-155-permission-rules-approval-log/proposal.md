## Why

The app can create always-allow rules ("allow always" on a permission card) but cannot show or undo them, and nothing records what was approved from a device (#368). A rule that turns out too broad can only be undone from the CLI (`remote-harness rules undo`), and the PRD (§12) promised an undo in the app.

## What Changes

- Protocol: `rules.list` → `rules.result` (the always-allow rules of the profiles' `settings.json` and of the `settings.local.json` of projects with known sessions, grouped by file with the scope, each rule marked app-created or hand-written), `rules.undo` (an app-created rule, by its log id), `rules.delete` (any rule of a listed file) and `approvals.list` → `approvals.result`.
- Daemon: deleting a hand-written rule (and undoing an app-created one) follows the user-file rule: read → merge → backup next to the file → atomic write, idempotent. Only files the daemon itself lists can be touched.
- Daemon: an **approval log** (`approvals.jsonl`): every Allow and Deny answered from a device (permission cards and plan approvals) and every rule undo or delete, with the paired device (ID and name), the session and its folder name, the tool, a short target sanitized by the live status table (`stepTarget`: base file name, command program, host) and the time; never the tool input. Entries older than 30 days are dropped.
- CLI: `remote-harness approvals list`; `rules undo` from the CLI is logged too (device: this computer).
- App: Settings → Permissions gets **Rules** (grouped by file and scope; Undo for app-created rules, Delete for hand-written rules behind biometric confirmation) and **Activity** (the approval log, with Undo on "allowed always" rows while their rule is still there).
- App: `expo-local-authentication` for the biometric confirmation (Face ID prompt text in the three languages).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `permission-approval`: always-allow rules can be listed, undone and deleted over the protocol; the approval log.
- `app-permissions`: the Rules and Activity screens.

## Impact

- `packages/protocol`: new client/server messages and the rule/approval schemas.
- `apps/daemon/src/features/permissions`: rule listing and removal, approval log, broker reports who decided; `cli.ts` (`approvals list`), i18n catalogs; `DaemonContext` gains a device-name lookup.
- `apps/mobile`: two new routes under Settings → Permissions, a biometric helper in `src/core`, i18n in pt-BR, en-US and es-ES; a new native dependency (new build; the fingerprint runtime keeps OTA updates off older builds).
