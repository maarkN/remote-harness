import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import { languageOptions } from './options'

describe('languageOptions', () => {
  test('lists the phone first, then every language by its native name', () => {
    const rows = languageOptions('system', 'pt-BR', createI18n('en-US').t)
    expect(rows.map((r) => r.choice)).toEqual(['system', 'pt-BR', 'en-US', 'es-ES'])
    expect(rows.map((r) => r.label)).toEqual([
      'Same as the phone',
      'Português (Brasil)',
      'English (US)',
      'Español',
    ])
  })

  test('the phone row says which language it resolves to; the others have no hint', () => {
    const rows = languageOptions('system', 'es-ES', createI18n('en-US').t)
    expect(rows[0]?.hint).toBe('Currently Español')
    expect(rows.slice(1).map((r) => r.hint)).toEqual([null, null, null])
  })

  test('marks the chosen row', () => {
    const rows = languageOptions('en-US', 'pt-BR', createI18n('pt-BR').t)
    expect(rows.filter((r) => r.selected).map((r) => r.choice)).toEqual(['en-US'])
    expect(rows[0]?.label).toBe('Mesmo do celular')
  })
})
