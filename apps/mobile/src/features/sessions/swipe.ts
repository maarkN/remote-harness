/**
 * Full-swipe logic of the session rows, apart from the gesture so it can be tested (#559). The row
 * translation is in points, positive when the row moves right (revealing the `start` actions).
 */
export type SwipeSide = 'start' | 'end'

export const ACTION_WIDTH = 76
/** Share of the row's width the finger must cover before a full swipe arms. */
const FULL_SWIPE_SHARE = 0.5
/** Room past the open panel, so the row resting open can never arm the full swipe. */
const FULL_SWIPE_CLEARANCE = 24

/** Width of a revealed panel: its actions plus the row's outer margin. */
export function panelWidth(count: number, margin: number): number {
  return count * ACTION_WIDTH + margin
}

/** Half the row, and never less than the open panel plus the clearance. */
export function fullSwipeDistance(rowWidth: number, panel: number): number {
  'worklet'
  return Math.max(rowWidth * FULL_SWIPE_SHARE, panel + FULL_SWIPE_CLEARANCE)
}

/** The side a translation arms, if it reached the full-swipe distance. */
export function armedSide(translation: number, distance: number): SwipeSide | null {
  'worklet'
  if (translation >= distance) return 'start'
  if (translation <= -distance) return 'end'
  return null
}

/** Inner width of a side's panel: its actions, stretched to the row once the row passes them. */
export function stretchedWidth(translation: number, side: SwipeSide, count: number, margin: number): number {
  'worklet'
  const reach = side === 'start' ? translation : -translation
  return Math.max(count * ACTION_WIDTH, reach - margin)
}

/**
 * What the finger did since it touched the row. Arming only counts during a drag, so the spring
 * that opens or closes the row after the release (which can pass the distance) never fires.
 */
export type SwipeTracker = { dragging: boolean; armed: SwipeSide | null }
export const IDLE_SWIPE: SwipeTracker = { dragging: false, armed: null }

export function startSwipe(): SwipeTracker {
  return { dragging: true, armed: null }
}

/** A side crossed the distance (`on`) or went back under it; ignored outside a drag. */
export function trackArm(state: SwipeTracker, side: SwipeSide, on: boolean): SwipeTracker {
  if (!state.dragging) return state
  if (on) return state.armed === side ? state : { ...state, armed: side }
  return state.armed === side ? { ...state, armed: null } : state
}

/** The finger lifted: the side armed at that moment fires, if any. */
export function releaseSwipe(state: SwipeTracker): { fire: SwipeSide | null; next: SwipeTracker } {
  return { fire: state.dragging ? state.armed : null, next: IDLE_SWIPE }
}
