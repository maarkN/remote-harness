import { describe, expect, it } from 'vitest'
import { tableColumnWidths } from './table-layout'

const mono = { charWidth: 8.4, padding: 9, min: 48, max: 225 }

describe('tableColumnWidths', () => {
  it('sizes each column from its longest cell, so a short table fits an iPhone SE', () => {
    const widths = tableColumnWidths(
      [
        ['Screen', 'Before', 'After'],
        ['Sessions', '1.2 s', '0.4 s'],
        ['Conversation', '900 ms', '300 ms'],
      ],
      mono,
    )
    expect(widths).toEqual([110, 60, 60])
    // About the width a message gets on a 375 pt wide phone.
    expect(widths.reduce((a, b) => a + b, 0)).toBeLessThan(300)
  })

  it('clamps a long cell to the maximum (it wraps) and a tiny one to the minimum', () => {
    expect(
      tableColumnWidths([['#', 'A rather long description that should wrap inside its column']], mono),
    ).toEqual([48, 225])
  })

  it('handles ragged rows and empty tables', () => {
    expect(tableColumnWidths([['a'], ['b', 'longer cell']], mono)).toEqual([48, 102])
    expect(tableColumnWidths([], mono)).toEqual([])
  })
})
