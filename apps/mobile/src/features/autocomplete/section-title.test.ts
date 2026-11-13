import { describe, expect, it } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import { sectionTitle } from './section-title'

describe('sectionTitle', () => {
  it('names the profile folder in the Profile header', () => {
    const { t } = createI18n('en-US')
    expect(sectionTitle('profile', t, '~/.claude-work')).toBe('Profile · ~/.claude-work')
    expect(createI18n('pt-BR').t('autocomplete.section.profileAt', { dir: '~/.claude' })).toBe(
      'Perfil · ~/.claude',
    )
  })

  it('keeps the plain titles of the other sections and of a profile without a folder', () => {
    const { t } = createI18n('en-US')
    expect(sectionTitle('profile', t, null)).toBe('Profile')
    expect(sectionTitle('builtin', t, '~/.claude')).toBe('Built-in')
    expect(sectionTitle('plugin', t, '~/.claude')).toBe('Plugins')
  })
})
