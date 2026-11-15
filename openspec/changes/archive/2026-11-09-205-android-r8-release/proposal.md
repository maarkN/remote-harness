## Why

The Play Console's App bundle explorer scores the Android app's DEX optimization **Low** (0% optimization, 1% obfuscation, 0% size reduction): the release build does not run R8, so the Java/Kotlin side ships every class unminified and unobfuscated, and the app is larger and slower to start than it needs to be (#526). The `expo-build-properties` plugin in `apps/mobile/app.config.ts` sets neither `enableMinifyInReleaseBuilds` nor `enableShrinkResourcesInReleaseBuilds`, so the generated `android/gradle.properties` lacks the two properties that the template's `build.gradle` already reads for `minifyEnabled` and `shrinkResources`.

## What Changes

- Android release builds run R8 with code shrinking, obfuscation and resource shrinking: `enableMinifyInReleaseBuilds` and `enableShrinkResourcesInReleaseBuilds` in the `android` block of `expo-build-properties`. Debug builds are unchanged.
- The generated native project gets a resource keep file (`res/raw/keep.xml`), written by a config plugin from one list of the resources the app looks up by name at run time. Today that is only `@drawable/notification_icon`, which the hands-free foreground service resolves with `getIdentifier`; the notification sounds of #134 will join the same list.
- The contributing guide's release-build section says R8 is on, where the mapping file ends up (Crashlytics and the Play Console) and how a by-name resource is kept.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `store-distribution`: new requirement "Android release build optimization": release builds run R8 with shrinking and obfuscation, resources reached by name are kept, debug builds stay as they are and the mapping file is produced.

## Impact

- `apps/mobile/app.config.ts` (build properties, keep-file plugin) and `apps/mobile/scripts/app-config.test.ts`.
- `CONTRIBUTING.md` (release builds).
- No daemon, protocol or app (JavaScript) change: R8 only touches the DEX, the Hermes bundle is untouched, so the download size drops less than the Play Console score suggests.
- What stays manual: a full pass on a release build on the Redmi 8 (navigation, deep links, pairing, push and live status, widgets, hands-free, voice assistant) before the next Play bundle, and the Play Console score after that upload. The 1.1.1 bundle is in Play review; this ships in the bundle after it.
