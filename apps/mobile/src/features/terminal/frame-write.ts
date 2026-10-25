/** A pane screen as the daemon sends it (`capture-pane -p -e`: text with SGR escapes, one line per row). */
export type PaneFrame = { text: string; cols: number; rows: number }

/** What the terminal page writes for a frame: everything again, or only the rows that changed. */
export type FrameWrite = { full: boolean; cols: number; rows: number; data: string }

const ESC = '\x1b'
// Built from ESC so the source holds no control character in a regex literal.
const SGR = new RegExp(`${ESC}\\[([0-9;:]*)m`, 'g')

/** The lines of a frame, as drawn: no trailing newline, the Claude Code bullet as a text glyph. */
export function frameLines(frame: PaneFrame): string[] {
  // iOS draws U+23FA (the Claude Code bullet) as an emoji; use a text glyph of the same width.
  return frame.text.replace(/\n$/, '').replace(/⏺/g, '●').split('\n')
}

/**
 * The SGR sequences in effect at the start of each line. `capture-pane -e` only writes attributes
 * where they change, so a line can start in the colors the line above left on: rewriting it alone
 * must replay them.
 */
export function carriedStyles(lines: readonly string[]): string[] {
  const carried: string[] = []
  let active: string[] = []
  for (const line of lines) {
    carried.push(active.join(''))
    for (const match of line.matchAll(SGR)) {
      const params = match[1] ?? ''
      if (params === '' || params === '0') active = []
      else if (params.startsWith('0;')) active = [match[0]]
      else active.push(match[0])
    }
  }
  return carried
}

/**
 * How to go from the frame on screen (`previous`) to `next`: a full redraw when there is none or the
 * size changed, otherwise only the changed rows, each cleared and written in place with the styles it
 * starts with. `data` is empty when nothing changed.
 */
export function frameWrite(previous: PaneFrame | null, next: PaneFrame): FrameWrite {
  const lines = frameLines(next)
  const size = { cols: next.cols, rows: next.rows }
  if (!previous || previous.cols !== next.cols || previous.rows !== next.rows)
    return { full: true, ...size, data: lines.join('\n') }
  const before = frameLines(previous)
  const carried = carriedStyles(lines)
  const carriedBefore = carriedStyles(before)
  let data = ''
  const count = Math.max(lines.length, before.length)
  for (let row = 0; row < count; row++) {
    const line = lines[row] ?? ''
    const style = carried[row] ?? ''
    if (line === (before[row] ?? '') && style === (carriedBefore[row] ?? '')) continue
    data += `${ESC}[${row + 1};1H${ESC}[0m${ESC}[2K${style}${line}`
  }
  return { full: false, ...size, data: data ? `${data}${ESC}[0m` : '' }
}
