import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import { buildSetupGuide, INSTALL_COMMAND, SETUP_STEPS } from './setup-guide'

describe('setup guide', () => {
  test('installs through the single HTTPS install URL', () => {
    expect(INSTALL_COMMAND).toBe('curl -fsSL https://remoteharness.app/install | bash')
    const install = buildSetupGuide(createI18n('en-US').t, 'ios')[0]
    expect(install?.code).toBe(INSTALL_COMMAND)
    expect(install?.body).toContain('irm https://remoteharness.app/install | iex')
    expect(install?.actions).toEqual([
      {
        kind: 'share',
        label: 'Send the install link to the computer',
        text: 'https://remoteharness.app/install',
      },
    ])
  })

  test('installs, then pairs: nothing else to set up on the phone', () => {
    const guide = buildSetupGuide(createI18n('en-US').t, 'ios')
    expect(guide.map((s) => s.id)).toEqual([...SETUP_STEPS])
    expect(guide.map((s) => s.title)).toEqual(['Remote Harness on the computer', 'Pair'])
    expect(guide.at(-1)?.actions).toEqual([{ kind: 'scan', label: 'Scan the QR code' }])
    for (const step of guide) {
      for (const action of step.actions) {
        if (action.kind === 'link') expect(action.url).toMatch(/^https:\/\//)
      }
    }
  })

  test('does not assume an iPhone or a Mac', () => {
    for (const locale of ['en-US', 'pt-BR', 'es-ES'] as const) {
      for (const os of ['ios', 'android']) {
        const text = JSON.stringify(buildSetupGuide(createI18n(locale).t, os))
        expect(text).not.toMatch(/iPhone|\bMac\b|AirDrop|brew/)
      }
    }
  })

  test('follows the language', () => {
    const guide = buildSetupGuide(createI18n('pt-BR').t, 'android')
    expect(guide.map((s) => s.title)).toEqual(['Remote Harness no computador', 'Parear'])
    expect(guide[0]?.actions[0]).toMatchObject({ kind: 'share' })
    expect(buildSetupGuide(createI18n('es-ES').t, 'ios').at(-1)?.actions).toEqual([
      { kind: 'scan', label: 'Escanear el código QR' },
    ])
  })
})
