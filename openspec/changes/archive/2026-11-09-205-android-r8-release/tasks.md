## 1. Build properties

- [x] 1.1 Set `enableMinifyInReleaseBuilds: true` and `enableShrinkResourcesInReleaseBuilds: true` in the `android` block of `expo-build-properties` in `apps/mobile/app.config.ts`; verify `npx expo prebuild --platform android --clean` writes `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true` to `android/gradle.properties`

## 2. Kept resources

- [x] 2.1 Add `KEPT_ANDROID_RESOURCES`, the pure `resourceKeepXml()` and a `withDangerousMod` plugin writing `android/app/src/main/res/raw/keep.xml`; verify the unit test in `scripts/app-config.test.ts` and the generated file after prebuild
- [x] 2.2 Review the generated `android/app/proguard-rules.pro`, the consumer rules of expo-modules-core and the local Kotlin modules for reflection or by-name lookups; verify nothing else needs `extraProguardRules` and record the result in design.md (result: the app's code needs none, but the release build showed Expo's headless app loader stripped, see 2.3)
- [x] 2.3 Add `ANDROID_PROGUARD_RULES` (`extraProguardRules`) keeping `expo.modules.apploader.**` and every `HeadlessAppLoader` implementation; verify the rule lands in the generated `proguard-rules.pro`, `RNHeadlessAppLoader` appears in `seeds.txt` of the next release build and the launch log has no ClassNotFoundException

## 3. Verification

- [x] 3.1 Build the release variant locally from the generated project (`./gradlew :app:assembleRelease`); verify R8 reports no missing class, `mapping.txt` is produced and, when an emulator is available, the release APK opens the demo (session list, conversation, settings) and the hands-free notification shows the app icon (done on the Android 17 emulator against the demo daemon: launch, pairing, list, conversation, settings, terminal, hands-free notification with `drawable/notification_icon`, no ClassNotFoundException after 2.3)
- [x] 3.2 `pnpm turbo run typecheck test` and Biome (with the worktree-safe `biome.json` tweak) green on the worktree (the daemon files that time out while the Gradle build and the emulator load the machine pass in isolation)

## 4. Docs

- [x] 4.1 CONTRIBUTING.md release-build section: R8 on for release builds, where the mapping file ends up, how a by-name resource is kept; verify the web tests still pass
