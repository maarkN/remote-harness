import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import {
  buildSetupGuide,
  COMPUTER_SYSTEMS,
  INSTALL_COMMAND,
  INSTALL_COMMAND_WINDOWS,
  installCommand,
  SETUP_STEPS,
} from './setup-guide'

const en = createI18n('en-US').t

describe('setup guide', () => {
  test('installs through the single HTTPS install URL', () => {
    expect(INSTALL_COMMAND).toBe('curl -fsSL https://remoteharness.app/install | bash')
    expect(INSTALL_COMMAND_WINDOWS).toBe('irm https://remoteharness.app/install | iex')
  })

  test('#564: no command before the computer’s system is chosen', () => {
    const install = buildSetupGuide(en, null)[0]
    expect(install?.code).toBeUndefined()
    expect(install?.actions).toEqual([])
    expect(install?.body).toMatch(/system/i)
  })

  test('the command follows the chosen system, with copy and send carrying it', () => {
    expect(installCommand('macos')).toBe(INSTALL_COMMAND)
    expect(installCommand('linux')).toBe(INSTALL_COMMAND)
    expect(installCommand('windows')).toBe(INSTALL_COMMAND_WINDOWS)
    for (const system of COMPUTER_SYSTEMS) {
      const install = buildSetupGuide(en, system)[0]
      const command = installCommand(system)
      expect(install?.code).toBe(command)
      expect(install?.actions).toEqual([
        { kind: 'copy', label: 'Copy the command', text: command },
        { kind: 'share', label: 'Send the command to the computer', text: command },
      ])
    }
  })

  test('PowerShell and WSL2 on Windows, a terminal elsewhere', () => {
    const body = (system: (typeof COMPUTER_SYSTEMS)[number]) => buildSetupGuide(en, system)[0]?.body ?? ''
    expect(body('windows')).toMatch(/PowerShell/)
    expect(body('windows')).toMatch(/WSL2/)
    expect(body('linux')).toMatch(/terminal/)
    expect(body('macos')).not.toMatch(/PowerShell|WSL/)
  })

  test('the intro names the three systems and leaves WSL to the Windows text', () => {
    for (const locale of ['en-US', 'pt-BR', 'es-ES'] as const) {
      const intro = createI18n(locale).t('setupGuide.intro')
      expect(intro).toMatch(/macOS/)
      expect(intro).toMatch(/Linux/)
      expect(intro).toMatch(/Windows/)
      expect(intro).not.toMatch(/WSL/)
      expect(buildSetupGuide(createI18n(locale).t, 'windows')[0]?.body).toMatch(/WSL2/)
    }
  })

  test('installs, then pairs: nothing else to set up on the phone', () => {
    for (const system of [null, ...COMPUTER_SYSTEMS]) {
      const guide = buildSetupGuide(en, system)
      expect(guide.map((s) => s.id)).toEqual([...SETUP_STEPS])
      expect(guide.map((s) => s.title)).toEqual(['Remote Harness on the computer', 'Pair'])
      expect(guide.at(-1)?.actions).toEqual([{ kind: 'scan', label: 'Scan the QR code' }])
      for (const step of guide) {
        for (const action of step.actions) {
          if (action.kind === 'link') expect(action.url).toMatch(/^https:\/\//)
        }
      }
    }
  })

  test('does not assume an iPhone or a Mac', () => {
    for (const locale of ['en-US', 'pt-BR', 'es-ES'] as const) {
      for (const system of [null, ...COMPUTER_SYSTEMS]) {
        const text = JSON.stringify(buildSetupGuide(createI18n(locale).t, system))
        expect(text).not.toMatch(/iPhone|\bMac\b|AirDrop|brew/)
      }
    }
  })
})
