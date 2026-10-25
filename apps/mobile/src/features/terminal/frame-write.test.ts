import { describe, expect, test } from 'vitest'
import { carriedStyles, frameLines, frameWrite } from './frame-write'

const frame = (lines: string[], cols = 20, rows = 4) => ({ text: `${lines.join('\n')}\n`, cols, rows })
const ESC = '\x1b'

describe('frameWrite', () => {
  test('the first frame and a new size are drawn in full', () => {
    const first = frameWrite(null, frame(['a', 'b']))
    expect(first).toEqual({ full: true, cols: 20, rows: 4, data: 'a\nb' })
    expect(frameWrite(frame(['a', 'b']), frame(['a', 'b'], 30)).full).toBe(true)
  })

  test('an unchanged frame writes nothing', () => {
    expect(frameWrite(frame(['a', 'b']), frame(['a', 'b'])).data).toBe('')
  })

  test('only the changed rows are rewritten, in place', () => {
    const write = frameWrite(frame(['one', 'two', 'three']), frame(['one', 'TWO', 'three']))
    expect(write.full).toBe(false)
    expect(write.data).toBe(`${ESC}[2;1H${ESC}[0m${ESC}[2KTWO${ESC}[0m`)
  })

  test('a shorter frame clears the rows it no longer has', () => {
    const write = frameWrite(frame(['a', 'b', 'c']), frame(['a']))
    expect(write.data).toBe(`${ESC}[2;1H${ESC}[0m${ESC}[2K${ESC}[3;1H${ESC}[0m${ESC}[2K${ESC}[0m`)
  })

  test('a rewritten row starts in the colors the row above left on', () => {
    const green = `${ESC}[32m`
    const write = frameWrite(frame([`${green}ok`, 'old']), frame([`${green}ok`, 'new']))
    expect(write.data).toBe(`${ESC}[2;1H${ESC}[0m${ESC}[2K${green}new${ESC}[0m`)
  })

  test('a row whose inherited colors changed is rewritten even with the same text', () => {
    const write = frameWrite(frame([`${ESC}[31mx`, 'same']), frame([`${ESC}[32mx`, 'same']))
    expect(write.data).toContain(`${ESC}[2;1H`)
  })
})

describe('carriedStyles', () => {
  test('a reset ends what is carried; "0;" starts over', () => {
    expect(carriedStyles([`${ESC}[1m${ESC}[32ma`, 'b', `${ESC}[0mc`, 'd', `${ESC}[0;33me`, 'f'])).toEqual([
      '',
      `${ESC}[1m${ESC}[32m`,
      `${ESC}[1m${ESC}[32m`,
      '',
      '',
      `${ESC}[0;33m`,
    ])
  })
})

describe('frameLines', () => {
  test('drops the trailing newline and swaps the bullet glyph', () => {
    expect(frameLines({ text: '⏺ done\n', cols: 10, rows: 1 })).toEqual(['● done'])
  })
})
