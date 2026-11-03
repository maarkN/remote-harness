/**
 * App Store builds of the iOS app (Make: `build-ios`, `publish-ios`).
 * - `tsx scripts/store-ios.mts --check` checks APPLE_TEAM_ID, which signs the build.
 * - `tsx scripts/store-ios.mts archive <archive>` runs `xcodebuild archive` (Release) on the prebuilt
 *   ios/ workspace, with the App Store Connect key when there is one, so a Mac without an Xcode
 *   account still registers the App IDs (the widget extension, its App Group) and fetches profiles.
 * - `tsx scripts/store-ios.mts export <archive> <dir>` exports the archive for App Store Connect to
 *   <dir>/RemoteHarness.ipa (the last build, the one `upload` sends).
 * - `tsx scripts/store-ios.mts upload <ipa>` uploads it to App Store Connect, where it shows up in
 *   TestFlight after processing.
 * The upload uses an App Store Connect API key: REMOTE_HARNESS_ASC_KEY_ID, REMOTE_HARNESS_ASC_ISSUER_ID
 * and REMOTE_HARNESS_ASC_KEY_PATH (default ~/keys/AuthKey_<key id>.p8), e.g. in `.env.local`. With
 * them, the export also signs with that key, so Xcode needs no signed-in account.
 * App Store Connect takes one upload per version and build number: the build number is always 1, so
 * bump APP_VERSION in app.config.ts before each upload (Google Play needs it too).
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const APP = 'RemoteHarness'
const IPA = `${APP}.ipa`

// Same env files Expo reads for the build (existing variables win; `.env.local` over `.env`).
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file)
}

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function teamId(): string {
  const team = process.env.APPLE_TEAM_ID
  if (!team)
    fail('set APPLE_TEAM_ID (e.g. in apps/mobile/.env.local): the team that signs the App Store build')
  return team
}

type ApiKey = { id: string; issuer: string; path: string }

function apiKey(): ApiKey | undefined {
  const id = process.env.REMOTE_HARNESS_ASC_KEY_ID
  const issuer = process.env.REMOTE_HARNESS_ASC_ISSUER_ID
  if (!id || !issuer) return undefined
  const path = resolve(process.env.REMOTE_HARNESS_ASC_KEY_PATH ?? join(homedir(), 'keys', `AuthKey_${id}.p8`))
  if (!existsSync(path)) fail(`App Store Connect key not found: ${path} (REMOTE_HARNESS_ASC_KEY_PATH=...)`)
  return { id, issuer, path }
}

function exportIpa(archive: string, dir: string): void {
  const key = apiKey()
  const work = mkdtempSync(join(tmpdir(), 'store-ios-'))
  try {
    const options = join(work, 'ExportOptions.plist')
    // The build number stays the app config's: Xcode must not bump it on its own.
    writeFileSync(
      options,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>export</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>${teamId()}</string>
  <key>uploadSymbols</key>
  <true/>
  <key>manageAppVersionAndBuildNumber</key>
  <false/>
</dict>
</plist>
`,
    )
    const out = join(work, 'out')
    console.log('▸ xcodebuild -exportArchive (App Store Connect)')
    execFileSync(
      'xcodebuild',
      [
        '-quiet',
        '-exportArchive',
        '-archivePath',
        archive,
        '-exportPath',
        out,
        '-exportOptionsPlist',
        options,
        '-allowProvisioningUpdates',
        ...(key
          ? [
              '-authenticationKeyPath',
              key.path,
              '-authenticationKeyID',
              key.id,
              '-authenticationKeyIssuerID',
              key.issuer,
            ]
          : []),
      ],
      { stdio: 'inherit' },
    )
    const ipa = readdirSync(out).find((name) => name.endsWith('.ipa'))
    if (!ipa) fail('xcodebuild exported no .ipa')
    copyFileSync(join(out, ipa), join(dir, IPA))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function archiveVersion(archive: string): string {
  const value = (key: string) => {
    try {
      return execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', join(archive, 'Info.plist')], {
        encoding: 'utf8',
      }).trim()
    } catch {
      return '?'
    }
  }
  return `${value('ApplicationProperties.CFBundleShortVersionString')} (${value('ApplicationProperties.CFBundleVersion')})`
}

/** `xcodebuild archive` of the prebuilt workspace; the API key lets automatic signing work without an Xcode account. */
function archive(archivePath: string): void {
  const key = apiKey()
  console.log(`▸ xcodebuild archive (Release)${key ? ', signing with the App Store Connect key' : ''}`)
  execFileSync(
    'xcodebuild',
    [
      '-quiet',
      '-workspace',
      `ios/${APP}.xcworkspace`,
      '-scheme',
      APP,
      '-configuration',
      'Release',
      '-destination',
      'generic/platform=iOS',
      '-derivedDataPath',
      'ios/build',
      '-archivePath',
      archivePath,
      '-allowProvisioningUpdates',
      ...(key
        ? [
            '-authenticationKeyPath',
            key.path,
            '-authenticationKeyID',
            key.id,
            '-authenticationKeyIssuerID',
            key.issuer,
          ]
        : []),
      'archive',
    ],
    { stdio: 'inherit' },
  )
}

function upload(ipa: string): void {
  const key = apiKey()
  if (!key) {
    fail(
      'set REMOTE_HARNESS_ASC_KEY_ID and REMOTE_HARNESS_ASC_ISSUER_ID (App Store Connect → Users and Access → Integrations → Team Keys)',
    )
  }
  console.log('▸ altool --upload-app (App Store Connect)')
  execFileSync(
    'xcrun',
    [
      'altool',
      '--upload-app',
      '-f',
      ipa,
      '-t',
      'ios',
      '--api-key',
      key.id,
      '--api-issuer',
      key.issuer,
      '--p8-file-path',
      key.path,
    ],
    { stdio: 'inherit' },
  )
  console.log('✓ uploaded: it shows up in App Store Connect → TestFlight once Apple finishes processing it')
}

const [command, ...rest] = process.argv.slice(2)
if (command === '--check') {
  teamId()
  apiKey()
  console.log('✓ App Store build settings')
} else if (command === 'archive' && rest[0]) {
  if (!existsSync(join('ios', `${APP}.xcworkspace`)))
    fail('no ios/ workspace: run `npx expo prebuild --platform ios` first')
  archive(resolve(rest[0]))
} else if (command === 'export' && rest[0] && rest[1]) {
  const archivePath = resolve(rest[0])
  if (!existsSync(join(archivePath, 'Info.plist'))) fail(`not an archive: ${archivePath}`)
  const dir = resolve(rest[1])
  mkdirSync(dir, { recursive: true })
  exportIpa(archivePath, dir)
  console.log(
    `✓ Remote Harness ${archiveVersion(archivePath)} for the App Store (make publish-ios uploads it)`,
  )
  console.log(`  ${join(dir, IPA)}`)
} else if (command === 'upload' && rest[0]) {
  const ipa = resolve(rest[0])
  if (!existsSync(ipa)) fail(`build not found: ${ipa} (make build-ios first)`)
  upload(ipa)
} else {
  fail(
    'usage: tsx scripts/store-ios.mts --check | archive <archive.xcarchive> | export <archive.xcarchive> <dir> | upload <ipa>',
  )
}
