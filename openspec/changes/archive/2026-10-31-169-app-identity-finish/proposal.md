## Why

Issue #83 tracks the app's move to its own identity. The bundle identifier itself already shipped (`com.alvyntech.remoteharness`, #131/#339), and the pairing scheme transition already shipped (`remoteharness://` first, `claude-remote://` still accepted, #364). Three items from the issue's own checklist are still open and are not blocked on anything external: the Expo project slug, the live-status deep links the app and the daemon construct, and the app's own `claude-remote.*` SecureStore keys for update channel and voice settings.

## What Changes

- The Expo `slug` becomes `remote-harness` (from `claude-remote`), matching the npm scope (`@remote-harness/*`) and the CLI name already in use.
- The live-status deep links the app (Live Activity) and the daemon (push `url`/`link`) construct now use `remoteharness://session/<id>`, not `claude-remote://session/<id>`. Both sides already parse either scheme, so this is one-way: new links use the new scheme, old links (if any survive a reconnect) still open.
- The app's own `claude-remote.*` SecureStore keys (`update-channel`, `voice-language`, `voice-push-to-talk`, `voice-polish`) become `remote-harness.*`, with a one-time read-old-adopt-new migration on first read so existing users keep their saved preference instead of silently resetting to the default — the same pattern `credentials.ts` already uses for its own legacy key.
- Unchanged on purpose (per the issue's own comment thread): the Android notification channel id `claude-remote` stays until #134 (so channels migrate once, not twice); the Firebase apps/APNs key for the new bundle id stay blocked on the Apple Developer enrollment tracked in #161; the daemon's own identifiers (launchd label, data directory, CLI aliases, config backup suffixes) are a different, already-settled concern and are not touched here.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `store-distribution`: the Expo project slug is `remote-harness`.

## Impact

`apps/mobile/app.config.ts` (slug), `apps/mobile/src/features/live-status/{logic,use-live-status}.ts`, `apps/daemon/src/features/live-status/index.ts`, `apps/mobile/src/core/updates/updates.ts`, `apps/mobile/src/features/voice/voice-{language,interaction,polish}-store.ts`, and their tests. No daemon identifiers, no Android notification channel, no Firebase/APNs change.
