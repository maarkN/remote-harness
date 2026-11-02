/** Part of the stage width a swipe must cover to change image, when it is not fast. */
export const SWIPE_FRACTION = 0.25
/** Points per second: a flick past this changes image whatever the distance. */
export const SWIPE_VELOCITY = 500

/** The index after `index`, clamped (no wrap-around). */
export function nextIndex(index: number, count: number): number {
  return Math.min(Math.max(0, count - 1), index + 1)
}

/** The index before `index`, clamped. */
export function previousIndex(index: number, count: number): number {
  return Math.max(0, Math.min(index - 1, count - 1))
}

/**
 * Where a horizontal swipe lands: the next image for a swipe to the left, the previous for one to
 * the right, when it covered `SWIPE_FRACTION` of the stage or was faster than `SWIPE_VELOCITY`;
 * the same image otherwise (and always with an unknown stage width or a single image).
 */
export function swipeTarget(
  translationX: number,
  velocityX: number,
  index: number,
  count: number,
  stageWidth: number,
): number {
  if (count <= 1 || stageWidth <= 0) return index
  const far = Math.abs(translationX) >= stageWidth * SWIPE_FRACTION
  const fast = Math.abs(velocityX) >= SWIPE_VELOCITY
  if (!far && !fast) return index
  // A flick against the drag direction cancels it.
  if (fast && Math.sign(velocityX) !== Math.sign(translationX) && !far) return index
  return translationX < 0 ? nextIndex(index, count) : previousIndex(index, count)
}
