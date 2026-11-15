## ADDED Requirements

### Requirement: Android release build optimization
Android release builds (the Google Play bundle and the release APKs) SHALL run R8 with code shrinking, obfuscation and resource shrinking, configured through the Expo build properties so that the native project generated from the config carries `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true`. Debug builds MUST stay unminified. Every resource the app resolves by name at run time MUST be listed in a resource keep file generated with the native project, so resource shrinking never removes it; today that list is the notification icon drawable the hands-free foreground service looks up. Any class R8 would otherwise strip although the app reaches it by reflection MUST be covered by a keep rule. Release builds SHALL produce the R8 mapping file, so Crashlytics and the Play Console show deobfuscated stack traces.

#### Scenario: Generated project
- **WHEN** `npx expo prebuild --platform android --clean` runs
- **THEN** `android/gradle.properties` has `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true`, and `android/app/src/main/res/raw/keep.xml` keeps `@drawable/notification_icon`

#### Scenario: Release build
- **WHEN** the release variant is built from the generated project
- **THEN** R8 runs without a missing-class error, the build writes `mapping.txt` next to the outputs and the app's classes are obfuscated in the DEX

#### Scenario: Headless start on a release build
- **WHEN** a background task fires on a release build while the app has no activity (a widget refresh push)
- **THEN** Expo's headless app loader class is present and starts the app, with no ClassNotFoundException at launch

#### Scenario: Hands-free notification on a release build
- **WHEN** the hands-free foreground service posts its notification on a release build
- **THEN** the notification shows the app's notification icon, not the launcher icon fallback

#### Scenario: Debug build
- **WHEN** the debug variant is built
- **THEN** no minification or resource shrinking runs

#### Scenario: Play Console
- **WHEN** a bundle built this way is uploaded to the Play Console
- **THEN** the App bundle explorer no longer reports "Low" DEX code optimization
