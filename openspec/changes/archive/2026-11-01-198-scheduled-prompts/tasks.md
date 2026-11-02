## 1. Protocol

- [x] 1.1 `domain.ts`: schedule schemas (`ScheduleTargetSchema`, `ScheduleWhenSchema`, `ScheduleRunSchema`, `ScheduleSchema`, `ScheduleInputSchema`, limits); `client.ts`: the five schedule messages; `server.ts`: `schedules.result`, `schedules.updated`, `auth.ok.schedules`; tests

## 2. Daemon

- [x] 2.1 `features/schedules/timing.ts` (`nextRunAt`, `isMissed`, constants) with tests
- [x] 2.2 `features/schedules/store.ts` (atomic JSON) and `service.ts` (list / create / update / remove / run, tick, missed runs, outcomes, broadcast, pushes) with tests on a fake clock
- [x] 2.3 `features/schedules/index.ts` wiring (handlers, start, stop), `paths.schedules()`, `main.ts` registration and `auth.ok.schedules`, `PushService.messageForSchedule`, push texts in en-US, pt-BR, es-ES

## 3. App

- [x] 3.1 `features/schedules/logic.ts` (time / date parsing, descriptions, editor validation) with tests; `store.ts` (`bindSchedules`, actions)
- [x] 3.2 `SchedulesScreen`, `ScheduleEditorSheet` (+ form with template picker), `SchedulesCard` in Settings → Sessions, route and Stack screen
- [x] 3.3 Session menu "Schedule a prompt…" (gated by `hello.schedules`) and the sheet in the session screen; session menu tests
- [x] 3.4 i18n pt-BR, en-US, es-ES; web docs `using-the-app.md` (three languages)

## 4. Verify

- [x] 4.1 `turbo run typecheck test`, Biome, `expo export --platform ios`
