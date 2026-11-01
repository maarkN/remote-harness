import { describe, expect, test } from 'vitest'
import { isLanguagePreference, LANGUAGE_PREFERENCES, resolveAppLocale } from './preference'

describe('resolveAppLocale', () => {
  test('system follows the device locale', () => {
    expect(resolveAppLocale('system', 'pt-BR')).toBe('pt-BR')
    expect(resolveAppLocale('system', 'en-US')).toBe('en-US')
  })

  test('an explicit language ignores the device locale', () => {
    expect(resolveAppLocale('es-ES', 'pt-BR')).toBe('es-ES')
    expect(resolveAppLocale('en-US', 'es-ES')).toBe('en-US')
  })
})

describe('isLanguagePreference', () => {
  test('accepts system and every supported locale', () => {
    expect(LANGUAGE_PREFERENCES).toEqual(['system', 'pt-BR', 'en-US', 'es-ES'])
    for (const value of LANGUAGE_PREFERENCES) expect(isLanguagePreference(value)).toBe(true)
  })

  test('rejects anything else (a stale or foreign value in storage)', () => {
    for (const value of ['pt', 'fr-FR', '', null, undefined, 3, 'app']) {
      expect(isLanguagePreference(value)).toBe(false)
    }
  })
})
