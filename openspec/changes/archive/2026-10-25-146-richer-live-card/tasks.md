## 1. Protocol

- [x] 1.1 `LiveStatusProps`: `activity`, `task`, `notifiedAt`, `link`, `labels` with defaults; `showTask?` on `live.register` and `LiveFollowDevice` (tests for defaults).
- [x] 1.2 `liveNotificationText`: body leads with the task or phrase (tests).

## 2. Daemon

- [x] 2.1 `activity.ts`: `activityKind(tool, input)` fixed table with Vitest cases per row in `test/live-activity.test.ts`; only the key is kept.
- [x] 2.2 Current task tracking from `TodoWrite` / `TaskCreate` / `TaskUpdate`, one line, clipped to 48 characters (tests).
- [x] 2.3 `liveProps`: phrase (delegating with the subagent count, "Finished" when done), task only with `showTask` while working or waiting, `notifiedAt`, `link`, labels; i18n in the three languages (parity test).
- [x] 2.4 `showTask` per registration (kept on re-register like `palette`), from `live.register` and the follow device; worst-case APNs payload still under 4 KB (tests).

## 3. App

- [x] 3.1 Setting "Show the current task on the lock screen" (off by default, persisted) in Settings → Notifications with its hint; i18n pt-BR / en-US / es-ES.
- [x] 3.2 `showTask` sent with `live.register` and the follow device; changing it re-registers the tracked sessions and refreshes the follows.
- [x] 3.3 Local props (`localLiveProps`) with labels, `notifiedAt` and `link` (tests).
- [x] 3.4 `SessionActivity` card: state pill, time in state with label, notified / working / finished on the right, phrase line, Open link while waiting.
- [x] 3.5 Android: Open action while waiting (tests in `android-notification.test.ts`).

## 4. Docs

- [x] 4.1 `CLAUDE.md` security rule, privacy policy (three languages) and `docs/design/identity/live.html`.

## 5. Validation

- [x] 5.1 `turbo run typecheck test`, Biome and `npx expo export --platform ios` green.
