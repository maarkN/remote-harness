## 1. Unlink every Firebase module per platform

- [x] 1.1 `scripts/firebase-linking.cjs`: list the `@react-native-firebase/*` dependencies and build the per-platform `dependencies` map; Vitest covers both files, none, and one missing per platform
- [x] 1.2 `react-native.config.js` uses it with one Google services file per platform; verify `require('./react-native.config.js')` lists perf with `ios: null, android: null` without the files

## 2. Verification

- [x] 2.1 Without either Firebase file: `npx expo prebuild`, `./gradlew assembleRelease` and `pod install` succeed
- [x] 2.2 `turbo run typecheck test` and Biome green
