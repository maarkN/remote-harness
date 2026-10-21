import { describe, expect, test } from 'vitest'
import { COMPACT_MARK_SIZE, MARK_GLYPH_SIZE, markTransform, slotIn } from './collapse'

describe('sliding mark', () => {
  test('the expanded slot needs no scale', () => {
    expect(markTransform({ x: 140, y: 11, size: MARK_GLYPH_SIZE })).toEqual({
      translateX: 140,
      translateY: 11,
      scale: 1,
    })
  })

  test('the compact slot shrinks the glyph around its center', () => {
    const t = markTransform({ x: 16, y: 19, size: COMPACT_MARK_SIZE })
    expect(t.scale).toBeCloseTo(18 / 22)
    // The scaled glyph's center lands on the slot's center.
    expect(t.translateX + MARK_GLYPH_SIZE / 2).toBe(16 + COMPACT_MARK_SIZE / 2)
    expect(t.translateY + MARK_GLYPH_SIZE / 2).toBe(19 + COMPACT_MARK_SIZE / 2)
  })

  test('slots are placed by their row and centered vertically in the child', () => {
    expect(slotIn({ x: 0, y: 0 }, { x: 130, y: 6, width: 110, height: 32 }, 22)).toEqual({
      x: 130,
      y: 11,
      size: 22,
    })
    expect(slotIn({ x: 16, y: 8 }, { x: 0, y: 0, width: 18, height: 18 }, 18)).toEqual({
      x: 16,
      y: 8,
      size: 18,
    })
  })
})
