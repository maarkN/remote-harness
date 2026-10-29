## Context

#417 added a JavaScript request handler (`src/features/assistant/handler.ts`) and a local Expo module that bridges iOS App Intents. On Android, App Actions are declared in `res/xml/shortcuts.xml`, referenced by `android.app.shortcuts` meta-data on the launcher activity, and fulfilled by launching an activity with a URL built from the intent's parameters. They cannot run headless without extra native machinery. The app's launcher entry can be the main activity or one of the alternate icon aliases (#342), and the aliases already copy the main activity's deep link filters.

## Goals / Non-Goals

**Goals:** Google Assistant can send a message, allow/deny the pending permission (with an on-screen confirmation) and check what is waiting; launcher shortcuts for recent sessions; no protocol change.

**Non-Goals:** answering without opening the app (a headless service would need a native task runner for the Noise connection), spoken readout of the result (#416), Gemini-only surfaces that do not run App Actions.

## Decisions

1. **Links, not a headless path, always confirmed.** `remoteharness://` links are exported (any browser or app can open them), so the link screen never sends or answers on its own: replies and permissions are confirmed with a tap (Send / Allow / Deny). Opening a session to type needs no confirmation.
2. **A trampoline activity.** With an alternate icon (#342) `MainActivity` is disabled and only the active alias resolves links, so App Actions target `expo.modules.voiceassistant.AssistantLinkActivity` (exported, no UI, in the module's manifest), which re-sends the `remoteharness://assistant/…` link as an `ACTION_VIEW` to the app's package and finishes. It forwards nothing else, so it exposes nothing the deep link filter does not already.
3. **Routing.** Every capability's `url-template` is a `remoteharness://assistant/<action>` link (`reply{?text,session}`, `answer{?decision}`, `waiting`). Expo Router maps it to `src/app/(main)/assistant/[action].tsx`, so an unpaired app goes to pairing as with any link. A pure `parseAssistantLink(action, params)` turns the link into a handler request or "open the session", with tests.
4. **One screen, the #417 handler.** `AssistantLinkScreen` runs the request on the app's live connection (the same `AssistantClient` interface), so replies use `session.input` (`mode` auto), and session titles are matched in JS (case-insensitive) against `sessions.list`. Replies show the text and the resolved session first; permissions use the handler's `pending` step to show the request; `reply` / `answer` run only after the user taps; results are announced with `AccessibilityInfo.announceForAccessibility`.
5. **Shortcuts from the existing session list.** The module's Android part implements `setSessions` with `ShortcutManagerCompat` (up to four dynamic shortcuts, deep link `remoteharness://assistant/reply?sessionId=<id>`); `complete` is a no-op and no events are emitted. `useAssistantSessions` already calls `setSessions` and empties it on unmount.
6. **Config plugin.** `withAssistantActions` writes `res/xml/shortcuts.xml`, the query pattern string arrays (`values`, `values-pt-rBR`, `values-es`) from a typed TS table, and adds the meta-data to `.MainActivity` and every launcher `activity-alias`.

## Risks / Trade-offs

- App Actions availability depends on the Assistant (Gemini on newer phones may not run them) and custom intents may only match English on some locales. → Documented; the launcher shortcuts and the in-app screen work everywhere.
- App Actions need the app installed from Google Play for production matching; local testing uses the App Actions Test Tool. → Noted in the docs/test plan.
