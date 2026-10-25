## Why

Builds without Firebase are supported (CONTRIBUTING: "Firebase is only linked on a platform when its file exists"), but `react-native.config.js` lists the React Native Firebase modules to unlink by hand and left out `@react-native-firebase/perf`, and it only looks at `GoogleService-Info.plist` for both platforms. An Android release build without `google-services.json` fails (`project ':react-native-firebase_perf' does not specify compileSdk`) and `pod install` without `GoogleService-Info.plist` fails (`Unable to find a specification for RNFBApp depended upon by RNFBPerf`) (#343).

## What Changes

- The modules to unlink are every `@react-native-firebase/*` dependency of the app, read from `package.json`, so a module added later cannot be missed.
- Each platform is decided by its own file: without `GoogleService-Info.plist` the modules are unlinked on iOS, without `google-services.json` on Android.

## Capabilities

### New Capabilities

### Modified Capabilities
- `performance-monitoring`: "Opt-in performance data" — a platform without its Google services file builds without Firebase, Performance Monitoring included.

## Impact

- `apps/mobile/react-native.config.js`, new `apps/mobile/scripts/firebase-linking.cjs` (pure, tested). No change for builds that have both files.
