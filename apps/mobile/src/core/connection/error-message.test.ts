import { ErrorCodeSchema, LOCALES } from '@remote-harness/protocol'
import { describe, expect, it } from 'vitest'
import { createI18n } from '../i18n/create'
import { DaemonRequestError } from './daemon-client'
import { errorMessage } from './error-message'

const RAW = 'raw daemon message in English'

describe('errorMessage', () => {
  it('explains every error code of the protocol in each language, never with the daemon message (#545)', () => {
    for (const locale of LOCALES) {
      const { t } = createI18n(locale)
      for (const code of ErrorCodeSchema.options) {
        const text = errorMessage(new DaemonRequestError(code, RAW), t)
        expect(text, `${locale} ${code}`).not.toBe(RAW)
        expect(text, `${locale} ${code}`).not.toMatch(/^errors\./)
      }
    }
  })

  it('reads an ended session as read-only in Portuguese', () => {
    const { t } = createI18n('pt-BR')
    expect(
      errorMessage(new DaemonRequestError('not_controllable', 'session has no live tmux pane'), t),
    ).toMatch(/leitura/)
  })

  it('lets a per-call override win and keeps the local codes', () => {
    const { t } = createI18n('en-US')
    expect(errorMessage(new DaemonRequestError('session_busy', RAW), t, { session_busy: 'Wait' })).toBe(
      'Wait',
    )
    expect(errorMessage(new DaemonRequestError('timeout', RAW), t)).not.toBe(RAW)
    expect(errorMessage(new Error('plain'), t)).toBe('plain')
  })
})
