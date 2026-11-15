import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ANDROID_PROGUARD_RULES,
  addShortcutsMetaData,
  androidVersionCode,
  appIntentFiles,
  copyMainActivityFiltersToAliases,
  KEPT_ANDROID_RESOURCES,
  resourceKeepXml,
  USER_LEAVE_HINT_EVENT,
  widgetGalleryStrings,
  widgetPickerStrings,
} from '../app.config.ts'
import { USER_LEAVE_HINT_EVENT as APP_ICON_EVENT } from '../src/features/settings/app-icon.ts'

describe('R8 keep rules', () => {
  it('keeps the headless app loader Expo resolves from the manifest', () => {
    expect(ANDROID_PROGUARD_RULES).toContain(
      '-keep class * implements expo.modules.apploader.HeadlessAppLoader',
    )
  })

  it('writes the keep file the resource shrinker reads', () => {
    expect(resourceKeepXml(['@drawable/notification_icon', '@raw/ping'])).toBe(
      '<?xml version="1.0" encoding="utf-8"?>\n' +
        '<resources xmlns:tools="http://schemas.android.com/tools"\n' +
        '    tools:keep="@drawable/notification_icon,@raw/ping" />\n',
    )
  })

  it('lists every resource the native modules look up by name', () => {
    const modules = fileURLToPath(new URL('../modules', import.meta.url))
    const lookups = readdirSync(modules, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.kt'))
      .flatMap((file) =>
        [
          ...readFileSync(join(modules, file), 'utf8').matchAll(/getIdentifier\(\s*"([^"]+)",\s*"([^"]+)"/g),
        ].map((match) => `@${match[2]}/${match[1]}`),
      )
    expect(lookups).toContain('@drawable/notification_icon')
    for (const resource of lookups) expect(KEPT_ANDROID_RESOURCES).toContain(resource)
  })
})

describe('androidVersionCode', () => {
  it('grows with the version and stays above the codes Google Play already has', () => {
    expect(androidVersionCode('1.0.2')).toBe(1000002)
    expect(androidVersionCode('1.1.1')).toBe(1001001)
    expect(androidVersionCode('1.1.1')).toBeGreaterThan(androidVersionCode('1.0.2'))
    expect(androidVersionCode('2.0.0')).toBeGreaterThan(androidVersionCode('1.999.999'))
  })

  it('refuses anything but MAJOR.MINOR.PATCH', () => {
    expect(() => androidVersionCode('1.1')).toThrow()
    expect(() => androidVersionCode('1.1.1-beta')).toThrow()
    expect(() => androidVersionCode('1.1000.0')).toThrow()
  })
})

type Application = Parameters<typeof copyMainActivityFiltersToAliases>[0]

const launcher = () => ({
  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
})
const deepLink = () => ({
  action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
  category: [
    { $: { 'android:name': 'android.intent.category.DEFAULT' } },
    { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
  ],
  data: [{ $: { 'android:scheme': 'remoteharness' } }, { $: { 'android:scheme': 'claude-remote' } }],
})
const alias = (name: string, target = '.MainActivity') => ({
  $: { 'android:name': name, 'android:targetActivity': target },
  'intent-filter': [launcher()],
})

function application(): Application {
  return {
    $: { 'android:name': '.MainApplication' },
    activity: [{ $: { 'android:name': '.MainActivity' }, 'intent-filter': [launcher(), deepLink()] }],
    'activity-alias': [alias('.MainActivityDark'), alias('.MainActivityLight')],
  } as Application
}

describe('copyMainActivityFiltersToAliases', () => {
  it("gives every alias MainActivity's deep link filter next to its launcher one", () => {
    const app = application()
    copyMainActivityFiltersToAliases(app)
    for (const item of app['activity-alias'] ?? []) {
      expect(item['intent-filter']).toEqual([launcher(), deepLink()])
    }
  })

  it('is idempotent', () => {
    const app = application()
    copyMainActivityFiltersToAliases(app)
    copyMainActivityFiltersToAliases(app)
    expect(app['activity-alias']?.[0]?.['intent-filter']).toHaveLength(2)
  })

  it('copies the filters instead of sharing them between activities', () => {
    const app = application()
    copyMainActivityFiltersToAliases(app)
    const [dark, light] = app['activity-alias'] ?? []
    expect(dark?.['intent-filter']?.[1]).not.toBe(light?.['intent-filter']?.[1])
    expect(dark?.['intent-filter']?.[1]).not.toBe(app.activity?.[0]?.['intent-filter']?.[1])
  })

  it('leaves aliases of other activities alone', () => {
    const app = application()
    app['activity-alias']?.push(alias('.ShareAlias', '.ShareActivity'))
    copyMainActivityFiltersToAliases(app)
    expect(app['activity-alias']?.[2]?.['intent-filter']).toEqual([launcher()])
  })
})

describe('USER_LEAVE_HINT_EVENT', () => {
  it('is the name the app icon store listens to', () => {
    expect(USER_LEAVE_HINT_EVENT).toBe(APP_ICON_EVENT)
  })
})

describe('appIntentFiles', () => {
  it('adds the Swift sources, the String Catalog and the phrases per language, not the strings module or tests', () => {
    expect(
      appIntentFiles(['strings.ts', 'SessionEntity.swift', 'AssistantBridge.swift', 'notes.md']),
    ).toEqual({
      swift: ['AssistantBridge.swift', 'SessionEntity.swift'],
      resources: [
        'Localizable.xcstrings',
        'en.lproj/AppShortcuts.strings',
        'pt-BR.lproj/AppShortcuts.strings',
        'es.lproj/AppShortcuts.strings',
      ],
    })
  })
})

describe('addShortcutsMetaData', () => {
  type Entry = { 'meta-data'?: { $: Record<string, string> }[] }
  const shortcuts = { $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } }

  it('points MainActivity and its icon aliases at the App Actions, once', () => {
    const app = application()
    app['activity-alias']?.push(alias('.ShareAlias', '.ShareActivity'))
    addShortcutsMetaData(app)
    addShortcutsMetaData(app)
    const main = app.activity?.[0] as Entry
    const [dark, light, share] = (app['activity-alias'] ?? []) as Entry[]
    expect(main['meta-data']).toEqual([shortcuts])
    expect(dark?.['meta-data']).toEqual([shortcuts])
    expect(light?.['meta-data']).toEqual([shortcuts])
    expect(share?.['meta-data']).toBeUndefined()
  })

  it('keeps other meta-data', () => {
    const app = application()
    const other = { $: { 'android:name': 'some.flag', 'android:value': 'true' } }
    const main = app.activity?.[0] as Entry | undefined
    if (main) main['meta-data'] = [other]
    addShortcutsMetaData(app)
    expect(main?.['meta-data']).toEqual([other, shortcuts])
  })
})

describe('widget gallery strings', () => {
  it('maps the English gallery texts to each language for the iOS extension', () => {
    expect(widgetGalleryStrings('pt-BR')).toBe(
      '"Sessions" = "Sessões";\n' +
        '"Sessions waiting for you, sessions working and your usage limits." = ' +
        '"Sessões esperando você, sessões trabalhando e seus limites de uso.";\n',
    )
    expect(widgetGalleryStrings('en')).toContain('"Sessions" = "Sessions";')
  })

  it('writes the Android labels everywhere and the descriptions only as translations', () => {
    const en = widgetPickerStrings('en')
    expect(en).toContain('<string name="widget_sessions_small_label">Sessions (small)</string>')
    expect(en).not.toContain('_description')
    const es = widgetPickerStrings('es')
    expect(es).toContain('<string name="widget_sessions_medium_label">Sesiones (mediano)</string>')
    expect(es).toContain('<string name="widget_sessionssmall_description">Sesiones que te esperan')
  })
})
