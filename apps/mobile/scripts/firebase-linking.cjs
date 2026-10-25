// Which React Native Firebase modules to leave unlinked, per platform (react-native.config.js).
// Plain CommonJS so the React Native CLI can require it; tested with Vitest.

/** Every `@react-native-firebase/*` dependency, so a module added later is never left linked (#343). */
function firebaseModules(packageJson) {
  return Object.keys(packageJson.dependencies ?? {}).filter((name) =>
    name.startsWith('@react-native-firebase/'),
  )
}

/**
 * `dependencies` for react-native.config.js: each Firebase module is unlinked on the platforms whose
 * Google services file is missing (`null` drops the platform), so that platform builds without
 * Firebase; nothing is listed when both files exist.
 */
function firebaseDependencies(modules, firebase) {
  if (firebase.ios && firebase.android) return {}
  const platforms = {
    ...(firebase.ios ? {} : { ios: null }),
    ...(firebase.android ? {} : { android: null }),
  }
  return Object.fromEntries(modules.map((name) => [name, { platforms }]))
}

module.exports = { firebaseModules, firebaseDependencies }
