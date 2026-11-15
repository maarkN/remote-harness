/** Widths of a horizontal scroll view and how far it is scrolled, in points. */
export type SideScrollMetrics = { content: number; view: number; x: number }

/** Whether content lies past the right edge (more than a point, so rounding never shows the fade). */
export function hasMoreRight({ content, view, x }: SideScrollMetrics): boolean {
  return content - view - x > 1
}
