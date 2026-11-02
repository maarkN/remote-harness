## Context

The sessions store already mirrors every session's state and the permissions store every pending request, both fed over the WebSocket regardless of the screen. The main layout knows the session on screen (`extractSessionIdFromPathname`). Pushes carry no content and are skipped while the app is in front, so the notice is the foreground counterpart of the four pushes `sessionDone`, `permissionPending`, `questionPending` and `planPending`.

## Decisions

1. **Derive, don't add messages.** `features/notices/select.ts` is pure: `finishedSessions(previous, current)` (running before, idle now; unknown before counts as not running), `requestKind(request)` (question, plan, else permission), `isFresh(request, now)` (created within the last minute: a request replayed on reconnect or on a computer switch is not news) and `announces(session, context)` (not the session on screen, not muted, not the demo). `useNotices(onScreenSessionId)` subscribes to the two stores, diffs them and pushes a `Notice` into `useNoticesStore`; the hook lives in the main layout, which already computes the session on screen.
2. **One banner, the newest wins.** `NoticeBanner` (mounted once in the main layout, over the detail pane) shows `useNoticesStore.current`, slides in and out with reanimated (reduce-motion aware), auto-dismisses after 6 s, opens the session with `openSession` on tap and has a Dismiss button. A queue would pile up during bursts (a reconnect); replacing keeps the latest fact visible and the list has the rest.
3. **Haptic, no sound yet.** A finished turn gives a success haptic when the push toggle is on; requests keep the warning haptic `bindPermissions` already fires. Playing a sound needs an audio module the app does not have (expo-av is deprecated); #134 adds sounds with a per-type choice.

## Risks / Trade-offs

- A reconnect after a long absence can flip several sessions from running to idle at once: only the last notice stays visible, which is acceptable because the list shows the state of all of them.
- The banner overlays the native header for a few seconds, like system banners do; it never covers the composer.
