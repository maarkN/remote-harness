/**
 * Store screenshots from a headless iOS simulator or Android emulator. Walks the scenes of the
 * listing storyboard through deep links and saves the raw captures, one folder per language:
 * store/screenshots/<ios|android>/<locale>/<device>-<nn>-<scene>.png (ignored by git; compose them
 * on the store canvases afterwards).
 *
 * Needs a screenshot build (REMOTE_HARNESS_SCREENSHOTS=1): it opens the offline demo by itself and
 * hides the demo banner and card, so no daemon is needed and nothing real appears.
 *
 *   cd apps/mobile
 *   REMOTE_HARNESS_SCREENSHOTS=1 npx expo run:ios --configuration Release --device <udid> --no-bundler
 *   pnpm store:screenshots -- --udid <udid> --prepare     # opens one link: accept "Open in Remote Harness?" once
 *   pnpm store:screenshots -- --udid <udid> [--app <RemoteHarness.app>]
 *
 *   cd android && REMOTE_HARNESS_SCREENSHOTS=1 ./gradlew :app:assembleRelease && cd ..
 *   pnpm store:screenshots -- --android [--serial emulator-5554] [--apk android/app/build/outputs/apk/release/app-release.apk]
 *
 *   Common options: [--locales en-US,pt-BR,es-ES] [--scenes sessions,terminal,…] [--out <dir>] [--wait <ms>]
 *
 * Scenes that need typing or the lock screen (the prompt with hands-free, the live status) are not
 * here; take them by hand on the same build.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEMO_SESSIONS } from '@remote-harness/protocol/demo'
import sharp from 'sharp'
import { APP_ID } from '../app.config.ts'

const here = dirname(fileURLToPath(import.meta.url))
const LOCALES = ['en-US', 'pt-BR', 'es-ES']
const ROOT = 'remoteharness:///'

type DemoState = 'connected' | 'failed' | 'pending'

/**
 * What a capture of the session list says about the demo, from two strips of colour: the status
 * strip under the status bar (red = rejected, amber = still connecting, dark = none) and the row of
 * filter chips (amber once the list is up; dark on the splash screen).
 */
async function demoState(file: string): Promise<DemoState> {
  const { width = 0, height = 0 } = await sharp(file).metadata()
  const mean = async (top: number, h: number): Promise<number[]> => {
    const strip = await sharp(file)
      .extract({
        left: Math.round(width * 0.05),
        top: Math.round(top * height),
        width: Math.round(width * 0.9),
        height: Math.round(h * height),
      })
      .toBuffer()
    return (await sharp(strip).stats()).channels.slice(0, 3).map((c) => c.mean)
  }
  const [r = 0, g = 0] = await mean(0.058, 0.018)
  if (r >= 40 && r > g + 12) return 'failed'
  if (r >= 40) return 'pending'
  const [chip = 0] = await mean(0.138, 0.012)
  return chip >= 45 ? 'connected' : 'pending'
}

type Scene = { number: number; name: string; url: string; settle?: number }
type Device = { udid: string; name: string; state: string }

/** What the script needs from a simulator or an emulator. */
type Driver = {
  platform: 'ios' | 'android'
  /** File name prefix, from the device model. */
  name: string
  /** Relaunches the app in `locale`; the demo opens by itself in a screenshot build. */
  launch(locale: string): Promise<void>
  open(url: string): void
  screenshot(file: string): void
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const flag = (name: string): boolean => process.argv.includes(`--${name}`)
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function run(bin: string, args: string[]): string {
  return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
}

/** A call that may legitimately fail (terminating an app that is not running). */
function quietly(bin: string, args: string[]): void {
  try {
    execFileSync(bin, args, { stdio: 'ignore' })
  } catch {
    // nothing to do
  }
}

function demoSession(title: string): string {
  const found = DEMO_SESSIONS.find((session) => session.title === title)
  if (!found) throw new Error(`demo session not found: ${title}`)
  return found.id
}

/** The storyboard scenes a deep link reaches, numbered as in the listing storyboard. */
const SCENES: Scene[] = [
  { number: 1, name: 'sessions', url: ROOT },
  // Conversations take a while to lay out on an emulator, the first time most of all.
  {
    number: 2,
    name: 'permission',
    url: `remoteharness://session/${demoSession('Rate limit the login endpoint')}`,
    settle: 2,
  },
  {
    number: 3,
    name: 'conversation',
    url: `remoteharness://session/${demoSession('Dark mode toggle in settings')}`,
    settle: 2,
  },
  {
    number: 5,
    name: 'terminal',
    url: `remoteharness://session/${demoSession('Dark mode toggle in settings')}/terminal`,
    // The terminal is a WebView: slow to come up on an emulator.
    settle: 3,
  },
  { number: 7, name: 'new-session', url: 'remoteharness://new' },
  { number: 8, name: 'settings', url: 'remoteharness://settings' },
]

function pickScenes(): Scene[] {
  const wanted = arg('scenes')?.split(',')
  if (!wanted) return SCENES
  return wanted.map((name) => SCENES.find((scene) => scene.name === name) ?? fail(`unknown scene: ${name}`))
}

function pickLocales(): string[] {
  const wanted = arg('locales')?.split(',') ?? LOCALES
  for (const locale of wanted) if (!LOCALES.includes(locale)) fail(`unknown locale: ${locale}`)
  return wanted
}

// ---------------------------------------------------------------------------------------------- iOS

const simctl = (...args: string[]): string => run('xcrun', ['simctl', ...args])

function simulator(udid: string | undefined): Device {
  const list = JSON.parse(simctl('list', 'devices', '-j')) as { devices: Record<string, Device[]> }
  const all = Object.values(list.devices).flat()
  const found = udid ? all.find((d) => d.udid === udid) : all.find((d) => d.state === 'Booted')
  return found ?? fail(udid ? `no simulator ${udid}` : 'no booted simulator: pass --udid')
}

function ios(wait: number): Driver {
  const target = simulator(arg('udid'))
  simctl('bootstatus', target.udid, '-b')
  const app = arg('app')
  if (app) simctl('install', target.udid, resolve(app))
  simctl('ui', target.udid, 'appearance', 'dark')
  simctl(
    'status_bar',
    target.udid,
    'override',
    '--time',
    '9:41',
    '--batteryState',
    'charged',
    '--batteryLevel',
    '100',
    '--wifiBars',
    '3',
    '--cellularBars',
    '4',
  )
  return {
    platform: 'ios',
    name: slug(target.name),
    async launch(locale) {
      quietly('xcrun', ['simctl', 'terminate', target.udid, APP_ID])
      simctl('spawn', target.udid, 'defaults', 'write', '-g', 'AppleLanguages', '-array', locale)
      simctl(
        'spawn',
        target.udid,
        'defaults',
        'write',
        '-g',
        'AppleLocale',
        '-string',
        locale.replace('-', '_'),
      )
      simctl('launch', target.udid, APP_ID)
      await sleep(wait * 2)
    },
    open(url) {
      simctl('openurl', target.udid, url)
    },
    screenshot(file) {
      simctl('io', target.udid, 'screenshot', file)
    },
  }
}

// ------------------------------------------------------------------------------------------ Android

function android(wait: number): Driver {
  const sdk =
    process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(homedir(), 'Library/Android/sdk')
  const bin = existsSync(join(sdk, 'platform-tools/adb')) ? join(sdk, 'platform-tools/adb') : 'adb'
  const serial = arg('serial') ?? 'emulator-5554'
  const adb = (...args: string[]): string => run(bin, ['-s', serial, ...args]).trim()
  const shell = (...args: string[]): string => adb('shell', ...args)
  const capture = (file: string): void => {
    const png = execFileSync(bin, ['-s', serial, 'exec-out', 'screencap', '-p'], {
      maxBuffer: 64 * 1024 * 1024,
    })
    writeFileSync(file, png)
  }
  const demo = (...args: string[]): string =>
    shell('am', 'broadcast', '-a', 'com.android.systemui.demo', ...args)

  adb('wait-for-device')
  const apk = arg('apk')
  if (apk) adb('install', '-r', resolve(apk))
  const model = shell('getprop', 'ro.product.model') || 'android'
  // Dark system UI, no animations (captures never land mid-transition) and a clean status bar.
  shell('cmd', 'uimode', 'night', 'yes')
  for (const key of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) {
    shell('settings', 'put', 'global', key, '0')
  }
  shell('settings', 'put', 'global', 'sysui_demo_allowed', '1')
  demo('-e', 'command', 'enter')
  demo('-e', 'command', 'clock', '-e', 'hhmm', '0941')
  demo('-e', 'command', 'battery', '-e', 'level', '100', '-e', 'plugged', 'false')
  demo(
    '-e',
    'command',
    'network',
    '-e',
    'wifi',
    'show',
    '-e',
    'level',
    '4',
    '-e',
    'fully',
    'true',
    '-e',
    'mobile',
    'hide',
  )
  demo('-e', 'command', 'notifications', '-e', 'visible', 'false')

  return {
    platform: 'android',
    name: slug(model),
    async launch(locale) {
      const start = () => shell('am', 'start', '-n', `${APP_ID}/.MainActivity`)
      const stop = () => quietly(bin, ['-s', serial, 'shell', 'am', 'force-stop', APP_ID])
      // Per-app language (Android 13+): no root and no reboot needed.
      stop()
      const current = shell('cmd', 'locale', 'get-app-locales', APP_ID, '--user', '0')
      if (!current.includes(`[${locale}]`)) {
        shell('cmd', 'locale', 'set-app-locales', APP_ID, '--user', '0', '--locales', locale)
      }
      // On a slow emulator the demo's connection sometimes fails at start-up and the list stays
      // empty behind a red strip: watch the list come up, and relaunch when it does not. A cold
      // start (fresh install, wiped data) can sit on the splash screen for a minute or more.
      const probe = join(tmpdir(), 'remote-harness-launch.png')
      if (flag('blind')) {
        // Screens whose layout the colour check does not know (tablets): just wait.
        start()
        await sleep(wait * 4)
        return
      }
      for (let attempt = 1; attempt <= 4; attempt++) {
        start()
        const deadline = Date.now() + wait * 20
        let state: DemoState = 'pending'
        while (Date.now() < deadline && state === 'pending') {
          await sleep(3000)
          capture(probe)
          state = await demoState(probe)
        }
        if (state === 'connected') return
        console.log(`  demo ${state === 'failed' ? 'rejected' : 'not up'} (attempt ${attempt}), relaunching`)
        stop()
        await sleep(1500)
      }
      fail('the demo never connected')
    },
    open(url) {
      shell('am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, APP_ID)
    },
    screenshot: capture,
  }
}

// --------------------------------------------------------------------------------------------- Main

const wait = Number(arg('wait') ?? (flag('android') ? 6000 : 2500))
const driver = flag('android') ? android(wait) : ios(wait)
const name = arg('name') ?? driver.name
const out = resolve(arg('out') ?? join(here, '..', 'store', 'screenshots', driver.platform))
const locales = pickLocales()

// The first launch on a fresh install (empty storage) is slow enough for the demo's handshake to
// give up; warm the app up once, so every launch below is a warm one.
await driver.launch(locales[0] ?? 'en-US')
await sleep(wait)

if (flag('prepare')) {
  await driver.launch('en-US')
  driver.open(ROOT)
  console.log(
    `${driver.name}: if the system asks whether to open Remote Harness, accept; then run again without --prepare`,
  )
  process.exit(0)
}

const scenes = pickScenes()
for (const locale of locales) {
  const dir = join(out, locale)
  mkdirSync(dir, { recursive: true })
  await driver.launch(locale)
  for (const scene of scenes) {
    if (scene.url !== ROOT) {
      driver.open(ROOT)
      await sleep(wait / 2)
    }
    driver.open(scene.url)
    await sleep(wait * (scene.settle ?? 1))
    const file = join(dir, `${name}-${String(scene.number).padStart(2, '0')}-${scene.name}.png`)
    driver.screenshot(file)
    console.log(`✓ ${locale} ${scene.name} → ${file}`)
  }
}
console.log(`→ ${out}`)
