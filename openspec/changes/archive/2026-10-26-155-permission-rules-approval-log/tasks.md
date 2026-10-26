## 1. Protocol

- [x] 1.1 Schemas `RuleFileSchema` / `ListedRuleSchema` and `ApprovalEntrySchema` in `domain.ts`
- [x] 1.2 Client `rules.list`, `rules.undo { ruleId }`, `rules.delete { file, rule }`, `approvals.list`; server `rules.result`, `approvals.result`; samples in the protocol tests

## 2. Daemon

- [x] 2.1 `withoutAllowRule` + `removeAllowRule` (read → merge → backup → atomic write, idempotent); `RulesLog.undo` uses it; Vitest for the merge, the backup and the no-op
- [x] 2.2 Rule listing: profile and project files, `app`/`hand` marking; Vitest
- [x] 2.3 `ApprovalLog` with `withinRetention` and `prune`; entry builder with `stepTarget` and the folder base name; Vitest for the sanitizing and the retention
- [x] 2.4 Broker: `respond`/`answer` take the deciding device, `onDecided` replaces `onRuleCreated`; broker tests updated
- [x] 2.5 Feature: handlers `rules.list`, `rules.undo`, `rules.delete`, `approvals.list`; logging of decisions and rule actions; daily prune; `DaemonContext.deviceName`
- [x] 2.6 CLI `approvals list`; `rules undo` logs the undo; strings in the three daemon catalogs
- [x] 2.7 Integration test: allow from a client is logged with the device; delete outside the listing is refused

## 3. App

- [x] 3.1 `expo-local-authentication` with `npx expo install`; Face ID prompt in `SYSTEM_PROMPTS` (three languages); `confirmIdentity` helper in `src/core`
- [x] 3.2 Pure helpers (grouping/labels of rules and activity entries) with Vitest
- [x] 3.3 Rules screen (undo, delete behind biometrics) and Activity screen (undo on "allowed always"); cards on the Permissions screen; routes
- [x] 3.4 i18n strings in pt-BR, en-US and es-ES
- [x] 3.5 Docs: READMEs and the web docs (using the app, daemon CLI, security) in the three languages

## 4. Verify

- [x] 4.1 `turbo run typecheck test` and Biome green
- [x] 4.2 `npx expo export --platform ios` bundles
