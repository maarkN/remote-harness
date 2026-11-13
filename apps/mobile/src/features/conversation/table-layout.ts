/** How table columns are measured: the font's advance width, the cell padding and the clamp. */
export type TableMeasure = { charWidth: number; padding: number; min: number; max: number }

/**
 * Width of each column of a markdown table, from its longest cell: the conversation font is
 * monospaced, so characters × advance width is close to the drawn width. Clamped between `min` and
 * `max`; a longer cell wraps inside its column. Replaces react-native-marked's 43% of the window per
 * column, which pushed a three-column table past the screen (#544).
 */
export function tableColumnWidths(rows: readonly (readonly string[])[], measure: TableMeasure): number[] {
  const longest: number[] = []
  for (const row of rows) {
    row.forEach((cell, column) => {
      longest[column] = Math.max(longest[column] ?? 0, cell.trim().length)
    })
  }
  return Array.from(longest, (chars = 0) => {
    const width = Math.ceil(chars * measure.charWidth) + measure.padding
    return Math.min(measure.max, Math.max(measure.min, width))
  })
}
