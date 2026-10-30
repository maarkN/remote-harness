## 1. Protocol and daemon

- [x] 1.1 Optional `widgets` on `device.register`; the device registry stores it; tests
- [x] 1.2 `PushMessage.silent` and `buildSilent` (data only, iOS background push, Android collapse key) used by `buildPush` (Firebase and relay); tests
- [x] 1.3 `features/widgets`: `widgetSignature(sessions, pending)` and a coalescing scheduler (30 s, trailing, skipped in foreground or with push off) sending `{event: "widgets", daemonId}` to devices with `widgets`; wired in `main.ts`; tests

## 2. App: snapshot and publishing

- [x] 2.1 `src/features/widgets/logic.ts`: `WidgetSnapshot`, `buildWidgetSnapshot`, `withoutRequest`, `widgetTarget`/`parseWidgetTarget`; Vitest
- [x] 2.2 i18n keys (`widgets.*`) in pt-BR, en-US and es-ES; `widgetLabels(t)`
- [x] 2.3 Snapshot storage (SecureStore, after first unlock, this device only) and `publishWidgets` (iOS `updateSnapshot`, Android `requestWidgetUpdate` for both names)
- [x] 2.4 `useWidgets` hook in the main layout (debounced publish, on background, pair state, nothing in the demo)
- [x] 2.5 Background refresh over a short-lived connection and widget answers (optimistic removal, answer, refresh)
- [x] 2.6 `device.register` with `widgets: true`; refresh pushes and widget actions handled in `push/background.ts` on both platforms

## 3. iOS widgets

- [x] 3.1 `SessionsWidget` layout (`createWidget`): small, medium, accessory circular / rectangular / inline
- [x] 3.2 `expo-widgets` config (`widgets`), patch so `app:` button targets use the app-process intent, localized gallery strings in the extension, background remote notifications
- [x] 3.3 Prebuild check: widget kind, extension resources and Info.plist in the generated project

## 4. Android widgets

- [x] 4.1 Add `react-native-android-widget` (Expo install, allowBuilds if needed) and its config plugin with `SessionsSmall` and `SessionsMedium`; localized picker strings
- [x] 4.2 Widget layouts (`FlexWidget`/`TextWidget`) for both sizes in theme colors; the widget task handler (render from the saved snapshot, open list / session, Allow / Deny)
- [x] 4.3 Prebuild check: receivers, provider XML and localized strings in the generated project

## 5. Verify

- [ ] 5.1 Typecheck, tests and Biome green; `expo export` for iOS and Android bundles
