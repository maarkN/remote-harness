## 1. Protocol

- [x] 1.1 `Session.permissionProfile` (nullable, default `null`), `CodexPresetSchema` (`read-only`, `workspace`) and `PermissionRequestInfo.rules` (default `true`), with schema tests for older payloads

## 2. Daemon

- [x] 2.1 Codex format: read the permission profile from `turn_context` / `thread_settings_applied` (active profile, else sandbox policy) in the summary meta and in line updates; tests
- [x] 2.2 Carry `permissionProfile` through `TranscriptSummary`, the transcript update and the session service/store; tests
- [x] 2.3 Adapter: `worktreeArgs` → `['--worktree']`, `renameCommand`, `presets` (Codex `/permissions <id>`), `polish.parse`; Codex `polish.args` with `codex exec --json --ephemeral …`; tests for each capability
- [x] 2.4 Lifecycle: submit the rename command once when a named session registers; tests
- [x] 2.5 Mode service: Codex presets through `/permissions <id>`, `mode_forbidden` for full access, `session_busy` with a pending request; tests
- [x] 2.6 Permission broker: `rules` on the request from the adapter; test
- [x] 2.7 Voice polish and generated messages use `polish.parse`; voice polish sends an empty stdin; tests
- [x] 2.8 Wire the input service into the lifecycle and mode features in `main.ts`

## 3. App

- [x] 3.1 `codexProfileLabel` / tone helpers and `canStartInWorktree` for Codex; tests
- [x] 3.2 `CodexPermissionsChip` with the two-preset picker replacing `ApprovalPolicyChip`; session details show the permission profile
- [x] 3.3 Hide Always for `rules: false` in the card and the waiting strip, with the note
- [x] 3.4 i18n in pt-BR, en-US and es-ES (chip, picker, note, polish hint); demo fixtures updated

## 4. Verify

- [x] 4.1 Typecheck, tests and Biome green; `npx expo export --platform ios` bundles
