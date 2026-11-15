import { describe, expect, test } from 'vitest'
import { createShakeDetector } from './shake'

const still = { x: 0, y: 0, z: -1 }
const jolt = { x: 2.1, y: 1.2, z: -0.8 }

describe('shake detector', () => {
  test('three peaks above 2.3 g within a second are a shake', () => {
    const shake = createShakeDetector()
    expect(shake(jolt, 0)).toBe(false)
    expect(shake(still, 50)).toBe(false)
    expect(shake(jolt, 200)).toBe(false)
    expect(shake(jolt, 400)).toBe(true)
  })

  test('one peak, or peaks spread over more than a second, are not', () => {
    const shake = createShakeDetector()
    expect(shake(jolt, 0)).toBe(false)
    expect(shake(still, 500)).toBe(false)
    expect(shake(jolt, 900)).toBe(false)
    expect(shake(jolt, 2100)).toBe(false)
  })

  test('samples of one peak (closer than 80 ms) count once', () => {
    const shake = createShakeDetector()
    expect(shake(jolt, 0)).toBe(false)
    expect(shake(jolt, 20)).toBe(false)
    expect(shake(jolt, 40)).toBe(false)
  })

  test('after a shake, nothing for three seconds', () => {
    const shake = createShakeDetector()
    for (const at of [0, 200, 400]) shake(jolt, at)
    for (const at of [600, 800, 1000]) expect(shake(jolt, at)).toBe(false)
    for (const at of [3500, 3700]) expect(shake(jolt, at)).toBe(false)
    expect(shake(jolt, 3900)).toBe(true)
  })
})
