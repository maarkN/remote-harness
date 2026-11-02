## 1. Protocol

- [x] 1.1 `agent` (lenient agent id) in `LiveStatusPropsSchema`; `AGENT_LABELS`; `liveTurnDuration(ms)`; `liveNotificationText` title led by the agent name; tests

## 2. Daemon

- [x] 2.1 `LiveSessionInfo.agent` from the profile; `liveProps` sends it; done phrase `activities.finishedAfter(duration)` in en-US, pt-BR, es-ES (replacing `finished`); tests

## 3. App

- [x] 3.1 `localLiveProps`: `agent` from the session, done phrase `liveStatus.finishedAfter` in the three catalogs (replacing `finished`); `AGENT_NAMES` from the protocol; tests
- [x] 3.2 `scripts/icons.mts`: agent badge PNGs in `assets/live-activity/`; `app.config.ts` copies them into the widget asset catalog as `Agent-<id>`
- [x] 3.3 `SessionActivity.tsx`: agent badge in place of the mark (banner, compact, minimal, expanded); done state shows the phrase instead of the frozen timer and "total"

## 4. Prototypes and verify

- [x] 4.1 `docs/design/identity/screens/live-activity-states.html` and `live-activity-lock-screen.html` with the agent badge and the done phrase; PNGs rendered again
- [x] 4.2 `turbo run typecheck test`, Biome, `expo export --platform ios`
