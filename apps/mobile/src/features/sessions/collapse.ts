/** Size (pt) the sliding mark is drawn at: its size in the title row. */
export const MARK_GLYPH_SIZE = 22
/** Size (pt) of the mark in the compact bar. */
export const COMPACT_MARK_SIZE = 18

/** Where the mark sits in one layout, relative to the collapsing header's top-left corner. */
export type MarkSlot = { x: number; y: number; size: number }

export type MarkTransform = { translateX: number; translateY: number; scale: number }

/**
 * Transform that puts a `glyph`-sized mark drawn at the header's origin over `slot`. React Native
 * scales around the view's center, so the translation targets the slot's center.
 */
export function markTransform(slot: MarkSlot, glyph: number = MARK_GLYPH_SIZE): MarkTransform {
  const offset = (slot.size - glyph) / 2
  return { translateX: slot.x + offset, translateY: slot.y + offset, scale: slot.size / glyph }
}

/** Slot of the mark inside a row laid out at `row` (its own layout inside the header). */
export function slotIn(
  row: { x: number; y: number },
  child: { x: number; y: number; width: number; height: number },
  size: number,
): MarkSlot {
  return { x: row.x + child.x, y: row.y + child.y + (child.height - size) / 2, size }
}
