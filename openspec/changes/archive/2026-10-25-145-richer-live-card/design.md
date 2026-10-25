## Context

The widget is drawn by `expo-widgets` from props pushed by the daemon (or set locally by the app). It cannot run timers itself, only SwiftUI's self-updating `Text(date, style:)`. Push payloads must stay under 4 KB and carry no session content beyond the title, folder and a sanitized current step.

## Decisions

1. **Time in state from existing timestamps.** Working: timer from `startedAt`. Waiting: timer from `changedAt` (the wait), and the working time frozen at `changedAt - startedAt`. Done: frozen `endedAt - startedAt`, "finished" + relative time from `endedAt`. No new timestamps are needed for these.
2. **`notifiedAt` = when the daemon sent this update.** Rendered as a relative date (`Text(date, style: .relative)`), so it keeps counting without pushes; a large value means updates stopped (computer asleep, phone offline). Local app updates set it to the time of the local update.
3. **Labels travel in the props** (`labels: { working, waiting, total, notified, finished, open }`), translated by the sender, like the state names; the widget has no i18n. Older props have `labels: null` and the widget skips them.
4. **Phrase table in the daemon (`activity.ts`).** `activityKind(tool, input)` returns a key from a fixed list (`readingDocs`, `exploring`, `updatingScripts`, `editingCode`, `creatingPdf`, `committing`, `testing`, `building`, `installing`, `researching`, `delegating`, `planning`, `thinking`, `writing`, `command`, `tool`). The full path, command and URL are inspected inside the daemon and dropped; the status only keeps the key, and `liveProps` translates it (`delegating` with the running subagent count, at least 1). Done shows "Finished"; closed shows nothing (the hint stays).
5. **Opt-in task per registration.** `showTask` travels with `live.register` and the follow device; a registration without it keeps the previous one (like `palette`), so the background registration of a push-started activity keeps the follow's choice. The task is tracked from `TodoWrite` (the `in_progress` item's `activeForm`, else its `content`) and from `TaskCreate` / `TaskUpdate` (`activeForm` / `subject` by creation order, the task becoming active on `in_progress`, cleared when it completes or is deleted). It is collapsed to one line and clipped to 48 characters, and sent only when `showTask` is on and the state is working or waiting.
6. **Open.** iOS: a SwiftUI `Link` to the session's deep link (`link` prop, built by the daemon from the session id), since widget buttons run intents in the background and cannot open the app. Android: an `OPEN` action that opens the app; the existing response handler routes any non-Allow/Deny action to the session.
7. **Android chronometer: not available.** `expo-notifications` has no chronometer option; the notification's own timestamp already shows when it was last updated. The body leads with the task or phrase.

## Risks / Trade-offs

- Phrase heuristics can be wrong (a `.md` written by Edit reads as "Editing code…"); they only label, and the current step line still names the tool and file.
- More props: the worst-case size test covers the new fields.
