/** Splits text into what a terminal draws as one character (a letter with its accents, a whole emoji). */
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/**
 * Two columns: the East Asian wide and fullwidth blocks in common use (Hangul Jamo, CJK punctuation
 * and ideographs, kana, Hangul syllables, compatibility ideographs, fullwidth forms).
 */
const WIDE =
  /^(?:[\u{1100}-\u{115F}\u{2E80}-\u{303E}\u{3041}-\u{33FF}\u{3400}-\u{4DBF}\u{4E00}-\u{9FFF}\u{A000}-\u{A4CF}\u{AC00}-\u{D7A3}\u{F900}-\u{FAFF}\u{FE30}-\u{FE4F}\u{FF00}-\u{FF60}\u{FFE0}-\u{FFE6}]|[\u{20000}-\u{3FFFD}])/u
/** Drawn as an emoji: emoji presentation by default, or asked for (VS16, a skin tone, a ZWJ sequence, a keycap, a flag). */
const EMOJI =
  /\p{Emoji_Presentation}|\p{Extended_Pictographic}(?:\u{FE0F}|\p{Emoji_Modifier}|\u{200D})|\u{20E3}|\p{Regional_Indicator}/u
/** Takes no column: combining marks, zero-width characters and controls. */
const ZERO = /^[\p{Mn}\p{Me}\p{Cc}\u{200B}-\u{200F}\u{2060}\u{FEFF}]+$/u

function graphemeWidth(grapheme: string): number {
  if (ZERO.test(grapheme)) return 0
  if (EMOJI.test(grapheme) || WIDE.test(grapheme)) return 2
  return 1
}

/** How many terminal columns `text` takes: emoji and CJK take two, accents and joiners none of their own. */
export function displayWidth(text: string): number {
  let width = 0
  for (const { segment } of graphemes.segment(text)) width += graphemeWidth(segment)
  return width
}

/** `text` padded with spaces to `width` columns; longer text is left as it is. */
export function padDisplay(text: string, width: number): string {
  return `${text}${' '.repeat(Math.max(0, width - displayWidth(text)))}`
}

/**
 * A header row and rows as aligned columns: each column padded to its widest cell (by display width),
 * two spaces apart, the last one unpadded, so no line ends in spaces.
 */
export function renderTable(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const all = [header, ...rows]
  const widths = header.map((_, column) => Math.max(...all.map((row) => displayWidth(row[column] ?? ''))))
  return all.map((row) =>
    header
      .map((_, column) => {
        const cell = row[column] ?? ''
        return column === header.length - 1 ? cell : padDisplay(cell, widths[column] ?? 0)
      })
      .join('  ')
      .trimEnd(),
  )
}
