/**
 * Installs a release build on the iPhone from a Safari link, from any network and without a cable
 * (Make: `install-ios-link`): the files go to the site server (over SSH) behind
 * https://remoteharness.app/app/<token>/. The random token is kept in `<dir>/.web-token` and reused
 * by later builds (and by the Android link, `make install-android-link`). The site renders that
 * page from `builds.json`, uploaded last.
 * - `tsx scripts/ios-link.mts --check` checks the site server and prints the install page URL.
 * - `tsx scripts/ios-link.mts <archive> <dir>` exports the archive to an IPA in <dir>, writes the
 *   manifest and the install page next to it and uploads them.
 * The IPA is development-signed, so only devices registered in the Apple team can install it.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { WEB_BASE } from './app-link-files.ts'
import { checkWebHost, publishBuilds, webPut, webToken } from './app-link-web.mts'
import { type AppInfo, buildManifest, buildPage } from './ios-link-files.ts'

const IPA = 'RemoteHarness.ipa'

const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()

function plistValue(file: string, key: string): string | undefined {
  try {
    return run('plutil', ['-extract', key, 'raw', '-o', '-', file]) || undefined
  } catch {
    return undefined
  }
}

function appInfo(archive: string): AppInfo {
  const props = join(archive, 'Info.plist')
  const app = join(archive, 'Products', plistValue(props, 'ApplicationProperties.ApplicationPath') ?? '')
  const bundleId = plistValue(props, 'ApplicationProperties.CFBundleIdentifier')
  if (!bundleId) {
    console.error(`✗ not an app archive: ${archive}`)
    process.exit(1)
  }
  const appPlist = join(app, 'Info.plist')
  return {
    bundleId,
    version: plistValue(props, 'ApplicationProperties.CFBundleShortVersionString') ?? '0',
    build: plistValue(props, 'ApplicationProperties.CFBundleVersion') ?? '0',
    title: plistValue(appPlist, 'CFBundleDisplayName') ?? plistValue(appPlist, 'CFBundleName') ?? bundleId,
  }
}

/** `debugging` is Xcode's current name for a development export (installable on registered devices). */
function exportIpa(archive: string, dir: string): void {
  const work = mkdtempSync(join(tmpdir(), 'ios-link-'))
  try {
    const options = join(work, 'ExportOptions.plist')
    writeFileSync(
      options,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>debugging</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>thinning</key>
  <string>&lt;none&gt;</string>
</dict>
</plist>
`,
    )
    const out = join(work, 'out')
    console.log('▸ xcodebuild -exportArchive')
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
      ],
      { stdio: 'inherit' },
    )
    const ipa = readdirSync(out).find((name) => name.endsWith('.ipa'))
    if (!ipa) {
      console.error('✗ xcodebuild exported no .ipa')
      process.exit(1)
    }
    copyFileSync(join(out, ipa), join(dir, IPA))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

/**
 * Uploads the build, then its manifest, then `builds.json` (the page is rendered from it), so the
 * page never links to a missing build. `index.html` still goes up for folders read without `builds.json`.
 */
function uploadWeb(dir: string, token: string, app: AppInfo, builtAt: Date): void {
  const target = checkWebHost()
  for (const name of [IPA, 'manifest.plist', 'index.html']) webPut(target, dir, token, name)
  publishBuilds(target, dir, token, {
    ios: {
      version: app.version,
      build: app.build,
      builtAt: builtAt.toISOString(),
      title: app.title,
      bundleId: app.bundleId,
    },
  })
}

// `--web` was the only mode left: still accepted from older Makefiles.
const args = process.argv.slice(2).filter((a) => a !== '--web')
if (args.includes('--check')) {
  checkWebHost()
  console.log(`✓ ${WEB_BASE}/<token>/`)
  process.exit(0)
}
const [archiveArg, dirArg] = args
if (!archiveArg || !dirArg) {
  console.error('usage: tsx scripts/ios-link.mts --check | <archive.xcarchive> <dir>')
  process.exit(1)
}
const archive = resolve(archiveArg)
const dir = resolve(dirArg)
mkdirSync(dir, { recursive: true })
const token = webToken(dir)
const base = `${WEB_BASE}/${token}`
const app = appInfo(archive)

exportIpa(archive, dir)
// The query defeats Safari's cache between builds; the files themselves keep fixed names.
const stamp = Date.now()
writeFileSync(join(dir, 'manifest.plist'), buildManifest(app, `${base}/${IPA}?v=${stamp}`))
writeFileSync(join(dir, 'index.html'), buildPage(app, `${base}/manifest.plist?v=${stamp}`, new Date(stamp)))
uploadWeb(dir, token, app, new Date(stamp))
console.log(`✓ ${app.title} ${app.version} (${app.build}) ready`)
console.log(
  `  On a registered iPhone (any network), open in Safari and tap Install (Android: make install-android-link):\n  ${base}/`,
)
