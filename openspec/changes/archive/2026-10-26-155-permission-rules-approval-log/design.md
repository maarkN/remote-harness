## Context

`RulesLog` (`features/permissions/rules-log.ts`) appends every app-created rule to `rules-log.jsonl` and the CLI can list and undo them; the undo writes the settings file without a backup. The broker learns the rule file only after the hook answer (`onRuleCreated`), and the router handler is the only place that knows which connection (and so which paired device, `connection.deviceId`) answered. The live status already has the fixed sanitizing table (`stepTarget` in `features/live-status/status.ts`).

## Goals / Non-Goals

**Goals:** one place that turns a decision into a log entry; the daemon never writes a file it did not itself list; the log keeps nothing of the tool input.

**Non-Goals:** editing rules from the app, deny/ask rules, project `.claude/settings.json` (shared, checked into the repository), Codex rules (it takes none).

## Decisions

- **Who decided travels with the decision.** `broker.respond` / `answer` take the deciding device ID; the broker's `onRuleCreated` becomes `onDecided({ info, behavior, cwd, by, rule? })`, called after the hook answer, only for decisions with a device (`denyAll` on close has none). The feature adds the rule to the rules log first, so the approval entry carries the rule's log ID and the Activity screen can offer Undo. Alternative: log in the router handler — rejected, it runs before the rule file is known.
- **App-created vs hand-written is computed, not stored.** A listed rule is `app` when an entry of the rules log has the same file and rule text; everything else is `hand`. An undone rule simply stops matching. A hand-written duplicate of an app rule shows as app-created, which is harmless (undo removes the same text).
- **Removal shared by undo and delete.** A pure `withoutAllowRule(settings, rule)` and one `removeAllowRule(file, rule)` doing read → merge → backup (`BACKUP_SUFFIX` of the hooks installer) → atomic write; returns false and writes nothing when the rule is absent. `rules.delete` resolves `file` against the current listing (exact path match) before touching anything.
- **Approval log as JSON lines with lazy retention.** `ApprovalLog` appends; `list()` filters by age; `prune()` rewrites the file atomically when it holds expired lines, run at start and once a day (unref'd timer). Pure `withinRetention(entries, now)` is tested. Target from `stepTarget`, folder from `basename(cwd)`; device name looked up at log time through a new `DaemonContext.deviceName(id)` (the device may be revoked later).
- **Biometrics in the app.** `expo-local-authentication`, wrapped in `src/core/auth/confirm-identity.ts`: `authenticateAsync` with the passcode fallback; when the device has no lock (`SecurityLevel.NONE`), the confirmation alert alone. Face ID prompt text goes into `SYSTEM_PROMPTS` in the three languages.
- **Routes.** `permissions/rules` and `permissions/activity` as two stack screens reached from cards on the existing Permissions screen.

## Risks / Trade-offs

- [The rules log grows forever] → it is small (one line per "allow always"); unchanged by this change.
- [A settings file changes between list and delete] → the delete re-reads the file and removes only that exact rule text.
- [New native module] → a new build is needed; the fingerprint runtime keeps OTA updates with this code off older builds.
