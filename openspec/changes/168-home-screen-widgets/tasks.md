## 1. Protocol and daemon

- [ ] 1.1 Optional `widgets` on `device.register`; the device registry stores it; tests
- [ ] 1.2 `PushMessage.silent` and `buildSilent` (data only, iOS background push, Android collapse key) used by `buildPush` (Firebase and relay); tests
- [ ] 1.3 `features/widgets`: `widgetSignature(sessions, pending)` and a coalescing scheduler (30 s, trailing, skipped in foreground or with push off) sending `{event: "widgets", daemonId}` to devices with `widgets`; wired in `main.ts`; tests

## 2. App: snapshot and publishing

- [ ] 2.1 `src/features/widgets/logic.ts`: `WidgetSnapshot`, `buildWidgetSnapshot`, `withoutRequest`, `widgetTarget`/`parseWidgetTarget`; Vitest
- [ ] 2.2 i18n keys (`widgets.*`) in pt-BR, en-US and es-ES; `widgetLabels(t)`
- [ ] 2.3 Snapshot storage (SecureStore, after first unlock, this device only) and `publishWidgets` (iOS `updateSnapshot`, Android `requestWidgetUpdate` for both names)
- [ ] 2.4 `useWidgets` hook in the main layout (debounced publish, on background, pair state, nothing in the demo)
- [ ] 2.5 Background refresh over a short-lived connection and widget answers (optimistic removal, answer, refresh)
- [ ] 2.6 `device.register` with `widgets: true`; refresh pushes and widget actions handled in `push/background.ts` on both platforms

## 3. iOS widgets

- [ ] 3.1 `SessionsWidget` layout (`createWidget`): small, medium, accessory circular / rectangular / inline
- [ ] 3.2 `expo-widgets` config (`widgets`), patch so `app:` button targets use the app-process intent, localized gallery strings in the extension, background remote notifications
- [ ] 3.3 Prebuild check: widget kind, extension resources and Info.plist in the generated project

## 4. Android widgets

- [ ] 4.1 Add `react-native-android-widget` (Expo install, allowBuilds if needed) and its config plugin with `SessionsSmall` and `SessionsMedium`; localized picker strings
- [ ] 4.2 Widget layouts (`FlexWidget`/`TextWidget`) for both sizes in theme colors; the widget task handler (render from the saved snapshot, open list / session, Allow / Deny)
- [ ] 4.3 Prebuild check: receivers, provider XML and localized strings in the generated project

## 5. Verify

- [ ] 5.1 Typecheck, tests and Biome green; `expo export` for iOS and Android bundles
