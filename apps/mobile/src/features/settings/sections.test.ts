import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import { type SettingsSnapshot, settingsSections } from './sections'

const en = createI18n('en-US').t
const pt = createI18n('pt-BR').t

const snapshot: SettingsSnapshot = {
  demo: false,
  computer: { name: 'MacBook Pro', status: 'open' },
  appearance: { theme: 'system', system: 'dark', icon: 'matchTheme' },
  profiles: ['claude', 'claude', 'codex'],
  sessions: { openAfterCreate: true, returnSends: false, templates: 3 },
  notifications: { push: true, live: false, muted: 2 },
  voice: 'app',
  app: { version: '1.1.0', channel: 'production', locale: 'pt-BR' },
}

const summaries = (rows: ReturnType<typeof settingsSections>) =>
  Object.fromEntries(rows.map((row) => [row.key, row.summary]))

describe('settingsSections', () => {
  test('nine rows in order, each with a route and a one-line summary of its state', () => {
    const rows = settingsSections(snapshot, en)
    expect(rows.map((row) => row.key)).toEqual([
      'computer',
      'devices',
      'appearance',
      'profiles',
      'sessions',
      'notifications',
      'permissions',
      'voice',
      'app',
    ])
    expect(rows.find((row) => row.key === 'permissions')?.route).toBe('/permissions')
    expect(rows.find((row) => row.key === 'app')?.route).toBe('/settings/app')
    const byKey = summaries(rows)
    expect(byKey.computer).toBe('MacBook Pro · connected')
    expect(byKey.appearance).toBe('Dark · Match theme')
    expect(byKey.profiles).toBe('3 profiles · Claude Code, Codex')
    expect(byKey.sessions).toBe('Opens after creating · 3 templates')
    expect(byKey.notifications).toBe('Push on · Live status off · 2 muted')
    expect(byKey.voice).toBe(en('voice.languageApp'))
    expect(byKey.app).toBe('1.1.0 · production · Português (Brasil)')
    for (const row of rows) {
      expect(row.title, row.key).not.toBe('')
      expect(row.summary, row.key).not.toMatch(/\n/)
    }
  })

  test('the demo has no Notifications row; empty states fall back to the hints', () => {
    const rows = settingsSections(
      {
        ...snapshot,
        demo: true,
        computer: { name: null, status: 'idle' },
        profiles: [],
        sessions: { openAfterCreate: false, returnSends: false, templates: 0 },
        voice: 'es-ES',
      },
      en,
    )
    expect(rows.map((row) => row.key)).not.toContain('notifications')
    const byKey = summaries(rows)
    expect(byKey.computer).toBe('idle')
    expect(byKey.profiles).toBe('0 profiles')
    expect(byKey.sessions).toBe(en('settings.sections.sessionsHint'))
    expect(byKey.devices).toBe(en('settings.sections.devicesHint'))
    expect(byKey.permissions).toBe(en('settings.permissionsHint'))
    expect(byKey.voice).toBe('Español')
  })

  test('titles and summaries follow the app language', () => {
    const rows = settingsSections(
      { ...snapshot, sessions: { openAfterCreate: true, returnSends: true, templates: 1 } },
      pt,
    )
    expect(rows[0]?.title).toBe('Computador')
    const byKey = summaries(rows)
    expect(byKey.notifications).toBe('Push ligado · Status ao vivo desligado · 2 silenciados')
    expect(byKey.sessions).toBe('Abre ao criar · 1 modelo · Return envia')
  })
})
