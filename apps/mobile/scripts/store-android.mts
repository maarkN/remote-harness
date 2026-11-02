/**
 * Android App Bundle for Google Play (Make: `build-android-bundle`), from the `android/` of a fresh
 * prebuild, signed with the upload key instead of the prebuild's debug signing.
 * - `tsx scripts/store-android.mts --check` checks the upload keystore and its password.
 * - `tsx scripts/store-android.mts <dir>` runs `gradlew bundleRelease`, checks the bundle's signer
 *   and copies it to <dir> as RemoteHarness-<version>-<versionCode>.aab.
 * The upload key: REMOTE_HARNESS_UPLOAD_KEYSTORE (default ~/keys/remote-harness-upload.jks), its
 * password in the login Keychain (service `remote-harness-upload-keystore`) or in
 * REMOTE_HARNESS_UPLOAD_KEYSTORE_PASSWORD, the alias in REMOTE_HARNESS_UPLOAD_KEY_ALIAS (default: the
 * keystore's only key) and REMOTE_HARNESS_UPLOAD_KEY_PASSWORD when it differs from the keystore's.
 * Gradle and keytool get the passwords in the environment, never on the command line.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { androidVersion } from './app-link-files.ts'

const KEYCHAIN_SERVICE = 'remote-harness-upload-keystore'
const BUNDLE = 'android/app/build/outputs/bundle/release/app-release.aab'
/** keytool prints in the system language; the parsing below reads the English labels. */
const KEYTOOL_EN = ['-J-Duser.language=en', '-J-Duser.country=US']

// Same env files Expo reads for the build (existing variables win; `.env.local` over `.env`).
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file)
}

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function keystorePassword(): string {
  const fromEnv = process.env.REMOTE_HARNESS_UPLOAD_KEYSTORE_PASSWORD
  if (fromEnv) return fromEnv
  try {
    return execFileSync('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    fail(
      `upload keystore password not found: save it with\n  security add-generic-password -a "$USER" -s ${KEYCHAIN_SERVICE} -w\n  (or set REMOTE_HARNESS_UPLOAD_KEYSTORE_PASSWORD)`,
    )
  }
}

/** `keytool` with the keystore password in its environment (`-storepass:env`). */
function keytool(keystore: string, password: string, args: string[]): string {
  try {
    return execFileSync(
      'keytool',
      [
        ...KEYTOOL_EN,
        '-list',
        '-v',
        '-keystore',
        keystore,
        '-storepass:env',
        'UPLOAD_STORE_PASSWORD',
        ...args,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, UPLOAD_STORE_PASSWORD: password },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  } catch {
    fail(`keytool could not open ${keystore}: wrong password or alias?`)
  }
}

const sha256 = (keytoolOutput: string) => /SHA256:\s*([0-9A-F:]+)/.exec(keytoolOutput)?.[1]

type UploadKey = {
  keystore: string
  storePassword: string
  alias: string
  keyPassword: string
  sha256: string
}

function uploadKey(): UploadKey {
  const keystore = resolve(
    process.env.REMOTE_HARNESS_UPLOAD_KEYSTORE ?? join(homedir(), 'keys/remote-harness-upload.jks'),
  )
  if (!existsSync(keystore))
    fail(`upload keystore not found: ${keystore} (REMOTE_HARNESS_UPLOAD_KEYSTORE=...)`)
  const storePassword = keystorePassword()
  let alias = process.env.REMOTE_HARNESS_UPLOAD_KEY_ALIAS
  if (!alias) {
    const aliases = [...keytool(keystore, storePassword, []).matchAll(/^Alias name:\s*(.+)$/gm)].map((m) =>
      m[1]?.trim(),
    )
    if (aliases.length !== 1 || !aliases[0]) {
      fail(
        `${keystore} has ${aliases.length} keys: set REMOTE_HARNESS_UPLOAD_KEY_ALIAS (${aliases.join(', ')})`,
      )
    }
    alias = aliases[0]
  }
  const fingerprint = sha256(keytool(keystore, storePassword, ['-alias', alias]))
  if (!fingerprint) fail(`no certificate for alias ${alias} in ${keystore}`)
  const keyPassword = process.env.REMOTE_HARNESS_UPLOAD_KEY_PASSWORD || storePassword
  return { keystore, storePassword, alias, keyPassword, sha256: fingerprint }
}

const args = process.argv.slice(2)
const key = uploadKey()
if (args.includes('--check')) {
  console.log(`✓ upload key ${key.alias} (${key.keystore})`)
  process.exit(0)
}
const [dirArg] = args
if (!dirArg) fail('usage: tsx scripts/store-android.mts --check | <dir>')

// The same properties Android Studio passes for a signed bundle, here as ORG_GRADLE_PROJECT_*.
console.log('▸ gradlew bundleRelease (upload key)')
execFileSync('./gradlew', ['--quiet', 'bundleRelease'], {
  cwd: 'android',
  stdio: 'inherit',
  env: {
    ...process.env,
    'ORG_GRADLE_PROJECT_android.injected.signing.store.file': key.keystore,
    'ORG_GRADLE_PROJECT_android.injected.signing.store.password': key.storePassword,
    'ORG_GRADLE_PROJECT_android.injected.signing.key.alias': key.alias,
    'ORG_GRADLE_PROJECT_android.injected.signing.key.password': key.keyPassword,
  },
})
if (!existsSync(BUNDLE)) fail(`gradlew produced no bundle at ${BUNDLE}`)

// Google Play refuses a bundle signed by any other key, and the debug signing would go unnoticed here.
const signer = sha256(
  execFileSync('keytool', [...KEYTOOL_EN, '-printcert', '-jarfile', BUNDLE], { encoding: 'utf8' }),
)
if (signer !== key.sha256) fail(`the bundle is not signed by the upload key (signer ${signer ?? 'none'})`)

const config: unknown = JSON.parse(
  execFileSync('npx', ['expo', 'config', '--type', 'public', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }),
)
const { version, versionCode } = androidVersion(config)
const dir = resolve(dirArg)
mkdirSync(dir, { recursive: true })
const out = join(dir, `RemoteHarness-${version}-${versionCode}.aab`)
copyFileSync(BUNDLE, out)
console.log(`✓ Remote Harness ${version} (${versionCode}) for Google Play, signed by ${key.alias}`)
console.log(`  ${out}`)
