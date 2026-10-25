import { describe, expect, it } from 'vitest'
import { copyMainActivityFiltersToAliases, USER_LEAVE_HINT_EVENT } from '../app.config.ts'
import { USER_LEAVE_HINT_EVENT as APP_ICON_EVENT } from '../src/features/settings/app-icon.ts'

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
