/**
 * Smaller updates on the wire: pane line diffs and session field deltas. The daemon computes them,
 * the app applies them; both use these functions so the two sides cannot drift apart.
 */
import { type Session, SessionSchema } from './domain.ts'

export type PaneFrame = { text: string; cols: number; rows: number }
export type PaneDiff = {
  cols: number
  rows: number
  lineCount: number
  /** Lines the screen scrolled up by before `lines` apply (a log printing below its last line). */
  scroll?: number
  lines: [number, string][]
}

/** How far the screen scrolled: the shift that keeps the most lines in place (0 for none). */
function bestScroll(before: string[], after: string[]): number {
  let best = 0
  let kept = 0
  for (let i = 0; i < after.length; i++) if (before[i] === after[i]) kept++
  for (let shift = 1; shift <= Math.floor(after.length / 2); shift++) {
    let same = 0
    for (let i = 0; i + shift < before.length && i < after.length; i++)
      if (before[i + shift] === after[i]) same++
    if (same > kept) {
      kept = same
      best = shift
    }
  }
  return best
}

/**
 * The diff from `previous` to `next`, or null when a full frame is better: no previous frame, a
 * different size, or more than half of the lines changed even after following a scroll.
 */
export function diffPaneFrames(previous: PaneFrame | null, next: PaneFrame): PaneDiff | null {
  if (!previous || previous.cols !== next.cols || previous.rows !== next.rows) return null
  const after = next.text.split('\n')
  const original = previous.text.split('\n')
  const scroll = bestScroll(original, after)
  const before = original.slice(scroll)
  const lines: [number, string][] = []
  for (let i = 0; i < after.length; i++) {
    const line = after[i] as string
    if (before[i] !== line) lines.push([i, line])
  }
  if (lines.length * 2 > after.length) return null
  return { cols: next.cols, rows: next.rows, lineCount: after.length, ...(scroll ? { scroll } : {}), lines }
}

/** Applies a diff to the last frame of the pane. */
export function applyPaneDiff(frame: PaneFrame, diff: PaneDiff): PaneFrame {
  const lines = frame.text
    .split('\n')
    .slice(diff.scroll ?? 0)
    .slice(0, diff.lineCount)
  while (lines.length < diff.lineCount) lines.push('')
  for (const [index, text] of diff.lines) if (index < diff.lineCount) lines[index] = text
  return { text: lines.join('\n'), cols: diff.cols, rows: diff.rows }
}

export type SessionDelta = { set: Record<string, unknown>; unset: string[] }

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The fields of the wire session that changed (null when none did). */
export function diffSessions(previous: Session, next: Session): SessionDelta | null {
  const set: Record<string, unknown> = {}
  const unset: string[] = []
  const before = previous as Record<string, unknown>
  const after = next as Record<string, unknown>
  for (const key of Object.keys(after)) {
    if (after[key] === undefined) {
      if (before[key] !== undefined) unset.push(key)
    } else if (!sameValue(before[key], after[key])) {
      set[key] = after[key]
    }
  }
  for (const key of Object.keys(before)) if (!(key in after) && before[key] !== undefined) unset.push(key)
  return Object.keys(set).length === 0 && unset.length === 0 ? null : { set, unset }
}

/** The session after a delta, validated as a whole; null when the result is not a valid session. */
export function applySessionDelta(session: Session, delta: SessionDelta): Session | null {
  const merged: Record<string, unknown> = { ...session, ...delta.set }
  for (const key of delta.unset) delete merged[key]
  const parsed = SessionSchema.safeParse(merged)
  return parsed.success ? parsed.data : null
}
