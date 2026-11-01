import { describe, expect, test } from 'vitest'
import { fitImage, MAX_DECODED_PIXELS } from './fit'

const stage = { width: 390, height: 844 }

describe('fitImage (#476)', () => {
  test('the view has the image pixel size in points and the base scale fits the stage', () => {
    const fit = fitImage({ width: 4000, height: 3000 }, stage, 3)
    expect(fit).not.toBeNull()
    expect(fit?.width).toBeCloseTo(4000 / 3)
    expect(fit?.height).toBeCloseTo(1000)
    // Wider than the stage: the width rules.
    expect(fit?.baseScale).toBeCloseTo(390 / (4000 / 3))
    // At the base scale the image spans the stage's 1170 device pixels with 4000 of its own, so zoom
    // stays sharp up to about 3.4×.
    expect((fit?.baseScale ?? 0) * (fit?.width ?? 0) * 3).toBeCloseTo(1170)
  })

  test('a tall image is ruled by the height; a small one is scaled up like "contain"', () => {
    const tall = fitImage({ width: 1000, height: 4000 }, stage, 2)
    expect(tall?.baseScale).toBeCloseTo(844 / 2000)
    const small = fitImage({ width: 200, height: 100 }, stage, 2)
    expect(small).toEqual({ width: 100, height: 50, baseScale: 3.9 })
  })

  test('huge images are decoded at the pixel cap, keeping the aspect ratio', () => {
    const fit = fitImage({ width: 8000, height: 6000 }, stage, 1)
    expect(fit).not.toBeNull()
    expect((fit?.width ?? 0) * (fit?.height ?? 0)).toBeCloseTo(MAX_DECODED_PIXELS, -3)
    expect((fit?.width ?? 0) / (fit?.height ?? 1)).toBeCloseTo(8000 / 6000)
    expect(fitImage({ width: 8000, height: 6000 }, stage, 1, 48_000_000)?.width).toBe(8000)
  })

  test('unknown or empty sizes give nothing to lay out', () => {
    expect(fitImage(null, stage, 2)).toBeNull()
    expect(fitImage({ width: 10, height: 10 }, null, 2)).toBeNull()
    expect(fitImage({ width: 0, height: 10 }, stage, 2)).toBeNull()
    expect(fitImage({ width: 10, height: 10 }, { width: 0, height: 0 }, 2)).toBeNull()
    expect(fitImage({ width: 10, height: 10 }, stage, 0)).toBeNull()
  })
})
