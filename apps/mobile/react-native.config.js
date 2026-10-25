// Firebase (push, error reports, performance) is optional: a platform without its Google services file
// (GoogleService-Info.plist, google-services.json) does not link the native Firebase modules, so it
// builds without a Firebase project. Keep in sync with app.config.ts.
const { existsSync } = require('node:fs')
const { join } = require('node:path')
const { firebaseDependencies, firebaseModules } = require('./scripts/firebase-linking.cjs')

module.exports = {
  dependencies: firebaseDependencies(firebaseModules(require('./package.json')), {
    ios: existsSync(join(__dirname, 'GoogleService-Info.plist')),
    android: existsSync(join(__dirname, 'google-services.json')),
  }),
}
