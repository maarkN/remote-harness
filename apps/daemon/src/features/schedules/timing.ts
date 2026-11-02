import type { ScheduleWhen } from '@remote-harness/protocol'

/**
 * A run due longer ago than this is not run late: the computer was asleep or the daemon down, and
 * the user decides whether to run it (the schedule shows it as missed with Run now).
 */
export const MISSED_GRACE_MS = 5 * 60_000
/** How often the service looks for due schedules; sleep and clock jumps are noticed on the next tick. */
export const TICK_MS = 30_000

/**
 * The next run strictly after `after`, on the computer's local clock: a once schedule's instant
 * while it is ahead, else the next day at `time` whose weekday is in `days` (none = every day).
 * `null` for a spent once schedule.
 */
export function nextRunAt(when: ScheduleWhen, after: Date): Date | null {
  if (when.kind === 'once') {
    const at = new Date(when.at)
    return Number.isFinite(at.getTime()) && at.getTime() > after.getTime() ? at : null
  }
  const [hours = 0, minutes = 0] = when.time.split(':').map(Number)
  const days = when.days.length > 0 ? new Set(when.days) : null
  const candidate = new Date(after.getTime())
  candidate.setHours(hours, minutes, 0, 0)
  // Today, then up to a week ahead (a set of weekdays always has one within seven days).
  for (let i = 0; i <= 7; i++) {
    if (candidate.getTime() > after.getTime() && (!days || days.has(candidate.getDay()))) return candidate
    candidate.setDate(candidate.getDate() + 1)
    // A DST change would shift the hour otherwise.
    candidate.setHours(hours, minutes, 0, 0)
  }
  return null
}

/** Whether a run due at `dueAt` is too old to run at `now`. */
export function isMissed(dueAt: Date, now: Date, graceMs: number = MISSED_GRACE_MS): boolean {
  return now.getTime() - dueAt.getTime() > graceMs
}
