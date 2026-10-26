## 1. Protocol

- [x] 1.1 `device.register.turnActions`, `queue.sendNext`; samples in the protocol tests

## 2. Daemon

- [x] 2.1 `QueueService.sendNext` + handler; Vitest
- [x] 2.2 Device registry keeps `turnActions`; `turnCategory`; `messageForHook` sets the category from `turnInfo`; `buildMulticast` data-only variant; `notify` splits Android turn-action devices; Vitest
- [x] 2.3 Wiring in `main.ts` (`turnInfo` from the session store and the queue)

## 3. App

- [x] 3.1 Pure helpers: action routing (`turnRequest`), turn data message parsing; Vitest
- [x] 3.2 Categories `TURN` / `TURN_QUEUE` (unlock required), Android `turn` channel (private lock screen), drawing turn data messages in the background and foreground handlers, `turnActions: true` in `device.register`
- [x] 3.3 Background answers for Reply / Interrupt / Send next; Reply by voice opens the session recording and sends at the end
- [x] 3.4 i18n strings in pt-BR, en-US and es-ES; web docs (notifications) in the three languages

## 4. Verify

- [x] 4.1 `turbo run typecheck test` and Biome green
- [x] 4.2 `npx expo export --platform ios` bundles
