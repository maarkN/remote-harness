import { type LastActivity, lastActivityOf, type TranscriptEntry } from '@remote-harness/protocol'
import type { Logger } from '../../core/logger.ts'
import type { SessionStore } from '../sessions/store.ts'
import type { SessionRecord } from '../sessions/types.ts'

/** Least time between two reads of a session's transcript tail. */
export const LAST_ACTIVITY_THROTTLE_MS = 3_000
/** Tail windows tried in turn: a huge tool result line can fill the first one. */
export const TAIL_WINDOWS = [64 * 1024, 1024 * 1024] as const

/** The last `bytes` of a session's transcript as entries; `complete` when that was the whole file. */
export type TailReader = (
  session: SessionRecord,
  bytes: number,
) => Promise<{ entries: TranscriptEntry[]; complete: boolean }>

export type TrackerTimers = {
  now: () => number
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

const realTimers: TrackerTimers = {
  now: Date.now,
  setTimeout: (fn, ms) => setTimeout(fn, ms).unref(),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
}

/**
 * Keeps each session's `lastActivity` (last prompt, reply or tool call) in step with its transcript:
 * a refresh on every sign of activity, at most once per `throttleMs` per session, with a trailing one
 * so the end of a burst is not lost. Refreshes keep `updatedAt`, so they never reorder the list.
 */
export class LastActivityTracker {
  /** Last read start, per session (epoch ms). */
  private readonly lastRun = new Map<string, number>()
  private readonly pending = new Map<string, unknown>()
  private disposed = false

  constructor(
    private readonly store: SessionStore,
    private readonly read: TailReader,
    private readonly logger: Logger,
    private readonly throttleMs = LAST_ACTIVITY_THROTTLE_MS,
    private readonly timers: TrackerTimers = realTimers,
  ) {}

  /** Store changes that can mean new transcript lines: a new session, a newer `updatedAt`, a new file. */
  static isActivity(next: SessionRecord, previous: SessionRecord | undefined): boolean {
    return (
      !previous || next.updatedAt !== previous.updatedAt || next.transcriptPath !== previous.transcriptPath
    )
  }

  /** Schedules a refresh of `sessionId`, now or once the throttle allows. */
  request(sessionId: string): void {
    if (this.disposed || this.pending.has(sessionId)) return
    const last = this.lastRun.get(sessionId)
    const wait = last === undefined ? 0 : Math.max(0, last + this.throttleMs - this.timers.now())
    this.pending.set(
      sessionId,
      this.timers.setTimeout(() => {
        this.pending.delete(sessionId)
        void this.refresh(sessionId)
      }, wait),
    )
  }

  private async refresh(sessionId: string): Promise<void> {
    const session = this.store.get(sessionId)
    if (this.disposed || !session?.transcriptPath) return
    this.lastRun.set(sessionId, this.timers.now())
    let activity: LastActivity | null = null
    try {
      for (const bytes of TAIL_WINDOWS) {
        const tail = await this.read(session, bytes)
        activity = lastActivityOf(tail.entries, session.updatedAt)
        if (activity || tail.complete) break
      }
    } catch (error) {
      this.logger.debug({ err: error, sessionId }, 'last activity read failed')
      return
    }
    const current = this.store.get(sessionId)
    // Nothing found keeps what the session had; the stamp is the current one, so the order holds.
    if (this.disposed || !activity || !current) return
    this.store.upsert(sessionId, { lastActivity: activity, updatedAt: current.updatedAt })
  }

  dispose(): void {
    this.disposed = true
    for (const handle of this.pending.values()) this.timers.clearTimeout(handle)
    this.pending.clear()
  }
}
