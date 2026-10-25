import { describe, expect, test } from 'vitest'
import { qrPath } from './qr'

describe('qrPath', () => {
  test('a square with a quiet zone and one rectangle per dark module', () => {
    const { size, d } = qrPath('remoteharness://pair?v=2&id=0123456789abcdef0123456789abcdef')
    // Version 3 or more for a link this long, plus 4 modules of quiet zone on each side.
    expect(size).toBeGreaterThanOrEqual(29 + 8)
    expect(d.startsWith('M')).toBe(true)
    // The quiet zone is light: nothing is drawn in the first 4 rows or columns.
    for (const match of d.matchAll(/M(\d+) (\d+)/g)) {
      expect(Number(match[1])).toBeGreaterThanOrEqual(4)
      expect(Number(match[2])).toBeGreaterThanOrEqual(4)
    }
  })
})
