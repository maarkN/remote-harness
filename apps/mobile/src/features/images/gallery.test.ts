import { describe, expect, test } from 'vitest'
import { nextIndex, previousIndex, SWIPE_FRACTION, SWIPE_VELOCITY, swipeTarget } from './gallery'

describe('gallery indexes', () => {
  test('next and previous are clamped, never wrap', () => {
    expect(nextIndex(0, 3)).toBe(1)
    expect(nextIndex(2, 3)).toBe(2)
    expect(previousIndex(2, 3)).toBe(1)
    expect(previousIndex(0, 3)).toBe(0)
    expect(nextIndex(0, 1)).toBe(0)
    expect(previousIndex(5, 3)).toBe(2)
  })

  test('a swipe changes image by distance or by speed, in its direction', () => {
    const width = 400
    expect(swipeTarget(-width * SWIPE_FRACTION, 0, 1, 5, width)).toBe(2)
    expect(swipeTarget(width * SWIPE_FRACTION, 0, 1, 5, width)).toBe(0)
    expect(swipeTarget(-30, -SWIPE_VELOCITY, 1, 5, width)).toBe(2)
    expect(swipeTarget(-30, 0, 1, 5, width)).toBe(1)
    // At the ends it stays.
    expect(swipeTarget(-300, 0, 4, 5, width)).toBe(4)
    expect(swipeTarget(300, 0, 0, 5, width)).toBe(0)
  })

  test('a single image, an unknown stage or a flick back changes nothing', () => {
    expect(swipeTarget(-300, -900, 0, 1, 400)).toBe(0)
    expect(swipeTarget(-300, -900, 1, 5, 0)).toBe(1)
    expect(swipeTarget(-30, 900, 1, 5, 400)).toBe(1)
  })
})

describe('gallery helpers on the UI runtime', () => {
  // The Pan gesture calls them from a worklet; a plain JS function called there throws, and a
  // release build aborts on it (#541). The directive survives transpiling as a string statement.
  test.each([
    ['swipeTarget', swipeTarget],
    ['nextIndex', nextIndex],
    ['previousIndex', previousIndex],
  ])('%s is a worklet', (_name, helper) => {
    expect(helper.toString()).toMatch(/^[^{]*\{\s*['"]worklet['"]/)
  })
})
