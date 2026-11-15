import { describe, expect, it } from 'vitest'
import { hasMoreRight } from './side-scroll'

describe('hasMoreRight', () => {
  it('is true while content lies past the right edge', () => {
    expect(hasMoreRight({ content: 500, view: 300, x: 0 })).toBe(true)
    expect(hasMoreRight({ content: 500, view: 300, x: 150 })).toBe(true)
  })

  it('is false once scrolled to the end, when the content fits, or before layout', () => {
    expect(hasMoreRight({ content: 500, view: 300, x: 200 })).toBe(false)
    expect(hasMoreRight({ content: 500, view: 300, x: 199.5 })).toBe(false)
    expect(hasMoreRight({ content: 280, view: 300, x: 0 })).toBe(false)
    expect(hasMoreRight({ content: 0, view: 0, x: 0 })).toBe(false)
  })
})
