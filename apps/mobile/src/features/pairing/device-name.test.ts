import { describe, expect, test } from 'vitest'
import { cleanDeviceName, suggestedDeviceName } from './device-name'

describe('suggestedDeviceName (#592)', () => {
  test('the name the user gave the device, when the system tells it', () => {
    expect(
      suggestedDeviceName({
        os: 'android',
        isPad: false,
        deviceName: 'Pixel da Hanna',
        modelName: 'Pixel 8',
      }),
    ).toBe('Pixel da Hanna')
    expect(
      suggestedDeviceName({
        os: 'ios',
        isPad: false,
        deviceName: "Hanna's iPhone",
        modelName: 'iPhone 15 Pro',
      }),
    ).toBe("Hanna's iPhone")
  })

  test('the model when iOS only says "iPhone" or "iPad" (no entitlement), or there is no name', () => {
    expect(
      suggestedDeviceName({ os: 'ios', isPad: false, deviceName: 'iPhone', modelName: 'iPhone 15 Pro' }),
    ).toBe('iPhone 15 Pro')
    expect(
      suggestedDeviceName({
        os: 'ios',
        isPad: true,
        deviceName: 'iPad',
        modelName: 'iPad Air (5th generation)',
      }),
    ).toBe('iPad Air (5th generation)')
    expect(suggestedDeviceName({ os: 'android', isPad: false, deviceName: null, modelName: 'Pixel 8' })).toBe(
      'Pixel 8',
    )
  })

  test('the platform default when the system tells nothing', () => {
    expect(suggestedDeviceName({ os: 'ios', isPad: false, deviceName: null, modelName: null })).toBe('iPhone')
    expect(suggestedDeviceName({ os: 'ios', isPad: true, deviceName: ' ', modelName: '' })).toBe('iPad')
    expect(suggestedDeviceName({ os: 'android', isPad: false, deviceName: null, modelName: null })).toBe(
      'Android',
    )
  })

  test('trimmed and at most 64 characters', () => {
    const long = `  ${'x'.repeat(80)}  `
    expect(
      suggestedDeviceName({ os: 'android', isPad: false, deviceName: long, modelName: null }),
    ).toHaveLength(64)
  })
})

describe('cleanDeviceName (#592)', () => {
  test('a name of 1–64 characters after trimming, else null', () => {
    expect(cleanDeviceName("  Hanna's iPhone ")).toBe("Hanna's iPhone")
    expect(cleanDeviceName('x'.repeat(64))).toHaveLength(64)
    expect(cleanDeviceName('x'.repeat(65))).toBeNull()
    expect(cleanDeviceName('   ')).toBeNull()
  })
})
