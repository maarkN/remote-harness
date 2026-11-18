import { describe, expect, test } from 'vitest'
import { displayWidth, padDisplay, renderTable } from '../src/core/text-table.ts'

describe('displayWidth', () => {
  test('counts the columns a terminal uses', () => {
    expect(displayWidth('iPhone')).toBe(6)
    expect(displayWidth('')).toBe(0)
    // An accent is one column, composed or as a base letter plus a combining mark.
    expect(displayWidth('Configurações')).toBe(13)
    expect(displayWidth('Configurac\u{327}o\u{303}es')).toBe(13)
    // CJK and fullwidth forms take two columns each.
    expect(displayWidth('東京')).toBe(4)
    expect(displayWidth('ＡＢ')).toBe(4)
    // Emoji take two, also with a variation selector, a skin tone or as a ZWJ sequence.
    expect(displayWidth('📱')).toBe(2)
    expect(displayWidth('\u{2764}\u{FE0F}')).toBe(2)
    expect(displayWidth('\u{1F44D}\u{1F3FD}')).toBe(2)
    expect(displayWidth('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}')).toBe(2)
    expect(displayWidth('iPhone 📱')).toBe(9)
    // A text-style symbol without the emoji selector stays narrow.
    expect(displayWidth('©')).toBe(1)
  })

  test('padDisplay pads by width, never cuts', () => {
    expect(padDisplay('📱', 4)).toBe('📱  ')
    expect(padDisplay('abc', 2)).toBe('abc')
  })
})

describe('renderTable', () => {
  test('pads every column to its widest cell, two spaces apart, without trailing spaces', () => {
    const lines = renderTable(
      ['ID', 'Name', 'App'],
      [
        ['abd7', 'iPhone da Hanna 📱', '1.2.3'],
        ['9f9a', 'iPad', '—'],
      ],
    )
    expect(lines).toEqual([
      'ID    Name                App',
      'abd7  iPhone da Hanna 📱  1.2.3',
      '9f9a  iPad                —',
    ])
    for (const line of lines) expect(line).not.toMatch(/ $/)
  })

  test('a header alone, or rows wider than the header', () => {
    expect(renderTable(['A', 'B'], [])).toEqual(['A  B'])
    expect(renderTable(['A', 'B'], [['long cell', 'x']])).toEqual(['A          B', 'long cell  x'])
  })
})
