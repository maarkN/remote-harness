import { describe, expect, test } from 'vitest'
import { type IconApplyInput, iconToApply, isAppIconPreference, resolveAppIconName } from './app-icon'

describe('iconToApply', () => {
  const base: IconApplyInput = {
    restored: true,
    preference: 'matchTheme',
    resolvedTheme: 'dark',
    current: 'Light',
    requested: undefined,
  }

  test('nothing before the saved preferences are read, whatever the defaults resolve to', () => {
    expect(iconToApply({ ...base, restored: false })).toBeUndefined()
    expect(
      iconToApply({ ...base, restored: false, preference: 'original', current: 'Dracula' }),
    ).toBeUndefined()
  })

  test('nothing when the icon already showing is the target (opening the app unchanged)', () => {
    expect(iconToApply({ ...base, preference: 'dracula', current: 'Dracula' })).toBeUndefined()
    expect(iconToApply({ ...base, preference: 'original', current: null })).toBeUndefined()
    expect(iconToApply({ ...base, current: 'Dark' })).toBeUndefined()
  })

  test('the target when it differs from the current icon', () => {
    expect(iconToApply(base)).toBe('Dark')
    expect(iconToApply({ ...base, preference: 'original' })).toBeNull()
    expect(iconToApply({ ...base, preference: 'mocha' })).toBe('Mocha')
  })

  test('never asks twice for the same icon in one launch', () => {
    expect(iconToApply({ ...base, requested: 'Dark' })).toBeUndefined()
    expect(iconToApply({ ...base, preference: 'original', requested: null })).toBeUndefined()
    expect(iconToApply({ ...base, preference: 'latte', requested: 'Dark' })).toBe('Latte')
  })
})

describe('resolveAppIconName', () => {
  test('original is always the default icon, whatever the theme', () => {
    expect(resolveAppIconName('original', 'dracula')).toBeNull()
    expect(resolveAppIconName('original', 'dark')).toBeNull()
  })

  test('matchTheme resolves to the current theme', () => {
    expect(resolveAppIconName('matchTheme', 'mocha')).toBe('Mocha')
    expect(resolveAppIconName('matchTheme', 'latte')).toBe('Latte')
  })

  test('a specific theme choice ignores the current theme', () => {
    expect(resolveAppIconName('dracula', 'light')).toBe('Dracula')
  })
})

describe('isAppIconPreference', () => {
  test('accepts matchTheme, original and every theme name', () => {
    expect(isAppIconPreference('matchTheme')).toBe(true)
    expect(isAppIconPreference('original')).toBe(true)
    expect(isAppIconPreference('dark')).toBe(true)
    expect(isAppIconPreference('latte')).toBe(true)
  })

  test('rejects anything else', () => {
    expect(isAppIconPreference('Dark')).toBe(false)
    expect(isAppIconPreference('')).toBe(false)
    expect(isAppIconPreference(null)).toBe(false)
    expect(isAppIconPreference(42)).toBe(false)
  })
})
