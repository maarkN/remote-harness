import { randomUUID } from 'node:crypto'
import {
  type InputDelivery,
  type Schedule,
  type ScheduleInput,
  type ScheduleRun,
  ScheduleSchema,
  type ScheduleTarget,
} from '@remote-harness/protocol'
import { z } from 'zod'
import { DaemonError } from '../../core/errors.ts'
import type { Logger } from '../../core/logger.ts'
import { readJsonFile, writeJsonAtomic } from '../../infra/fs.ts'
import type { Broadcaster } from '../../transport/connection.ts'
import { isMissed, MISSED_GRACE_MS, nextRunAt, TICK_MS } from './timing.ts'

const PersistedSchema = z.object({ schedules: z.array(ScheduleSchema) })

/** What a run's outcome tells the phone (content-free pushes). */
export type ScheduleEvent = 'scheduleRan' | 'scheduleFailed' | 'scheduleMissed'

export type NewSessionTarget = Extract<ScheduleTarget, { kind: 'new' }>

/** How a schedule's prompt reaches a session: the queue's rules for an existing one, a start for a new one. */
export type ScheduleRunner = {
  submit: (sessionId: string, prompt: string) => Promise<{ delivery: InputDelivery }>
  start: (target: NewSessionTarget, prompt: string) => Promise<{ sessionId: string | null }>
}

export type ScheduleDeps = {
  runner: ScheduleRunner
  broadcaster: Broadcaster
  statePath: string
  logger: Logger
  /** A run's outcome, for the push (the schedule's title, never its prompt). */
  notify: (event: ScheduleEvent, schedule: Schedule) => void
  now?: () => number
  newId?: () => string
  tickMs?: number
  graceMs?: number
}

/**
 * Scheduled prompts (#432): kept on the computer, run by its clock with no phone connected. Every
 * `TICK_MS` the due schedules run — within `MISSED_GRACE_MS` of their time — or are marked missed
 * (the computer slept or the daemon was down), and move on to their next time. Each change and
 * each run is saved atomically and broadcast as `schedules.updated`.
 */
export class ScheduleService {
  private items: Schedule[] = []
  private timer: ReturnType<typeof setInterval> | undefined
  /** Persistence writes still in flight, so stopping (or a test) can wait for them. */
  private writes: Promise<void> = Promise.resolve()
  /** Schedules running right now, so a tick never starts the same one twice. */
  private readonly running = new Set<string>()
  private readonly now: () => number
  private readonly newId: () => string
  private readonly graceMs: number

  constructor(private readonly deps: ScheduleDeps) {
    this.now = deps.now ?? Date.now
    this.newId = deps.newId ?? randomUUID
    this.graceMs = deps.graceMs ?? MISSED_GRACE_MS
  }

  list(): Schedule[] {
    return [...this.items]
  }

  /** Loads the saved schedules, settles what came due while the daemon was down, and starts the clock. */
  async start(): Promise<void> {
    const parsed = PersistedSchema.safeParse(await readJsonFile(this.deps.statePath))
    if (parsed.success) this.items = parsed.data.schedules
    await this.tick()
    this.timer = setInterval(() => void this.tick(), this.deps.tickMs ?? TICK_MS)
    this.timer.unref?.()
  }

  async dispose(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    await this.writes
  }

  async create(input: ScheduleInput): Promise<Schedule> {
    const at = this.iso()
    const schedule: Schedule = {
      ...input,
      id: this.newId(),
      createdAt: at,
      updatedAt: at,
      lastRun: null,
      nextRunAt: this.next(input),
    }
    this.items = [...this.items, schedule]
    await this.save()
    return schedule
  }

  /** Replaces a schedule's definition; its next run follows the new timing (and switch). */
  async update(id: string, input: ScheduleInput): Promise<Schedule> {
    const current = this.find(id)
    const updated: Schedule = { ...current, ...input, updatedAt: this.iso(), nextRunAt: this.next(input) }
    this.items = this.items.map((schedule) => (schedule.id === id ? updated : schedule))
    await this.save()
    return updated
  }

  async remove(id: string): Promise<void> {
    this.find(id)
    this.items = this.items.filter((schedule) => schedule.id !== id)
    await this.save()
  }

  /** Runs a schedule now, enabled or not, without touching its timing (Run now in the app). */
  async run(id: string): Promise<Schedule> {
    return this.execute(this.find(id), false)
  }

  /** Due schedules: those within the grace run, the rest are missed; both move on to the next time. */
  async tick(): Promise<void> {
    const now = this.now()
    for (const schedule of this.items) {
      if (!schedule.enabled || !schedule.nextRunAt || this.running.has(schedule.id)) continue
      const due = Date.parse(schedule.nextRunAt)
      if (!Number.isFinite(due) || due > now) continue
      if (isMissed(new Date(due), new Date(now), this.graceMs)) await this.miss(schedule, due)
      else await this.execute(schedule, true)
    }
  }

  private iso(): string {
    return new Date(this.now()).toISOString()
  }

  private next(schedule: Pick<Schedule, 'when' | 'enabled'>): string | null {
    if (!schedule.enabled) return null
    return nextRunAt(schedule.when, new Date(this.now()))?.toISOString() ?? null
  }

  private async miss(schedule: Schedule, due: number): Promise<void> {
    const run: ScheduleRun = {
      at: new Date(due).toISOString(),
      outcome: 'missed',
      error: null,
      sessionId: null,
    }
    const updated = this.afterRun(schedule, run, true)
    this.deps.logger.info({ scheduleId: schedule.id, dueAt: run.at }, 'scheduled prompt missed')
    await this.replace(updated)
    this.deps.notify('scheduleMissed', updated)
  }

  private async execute(schedule: Schedule, scheduled: boolean): Promise<Schedule> {
    this.running.add(schedule.id)
    let run: ScheduleRun
    try {
      run = await this.deliver(schedule)
    } finally {
      this.running.delete(schedule.id)
    }
    // The schedule may have been edited while the prompt was on its way.
    const latest = this.items.find((item) => item.id === schedule.id) ?? schedule
    const updated = this.afterRun(latest, run, scheduled)
    this.deps.logger.info(
      { scheduleId: schedule.id, outcome: run.outcome, scheduled, reason: run.error ?? undefined },
      'scheduled prompt ran',
    )
    await this.replace(updated)
    this.deps.notify(run.outcome === 'failed' ? 'scheduleFailed' : 'scheduleRan', updated)
    return updated
  }

  private async deliver(schedule: Schedule): Promise<ScheduleRun> {
    const at = this.iso()
    const { target, prompt } = schedule
    try {
      if (target.kind === 'session') {
        const { delivery } = await this.deps.runner.submit(target.sessionId, prompt)
        return { at, outcome: delivery, error: null, sessionId: target.sessionId }
      }
      const { sessionId } = await this.deps.runner.start(target, prompt)
      return { at, outcome: 'started', error: null, sessionId }
    } catch (error) {
      return {
        at,
        outcome: 'failed',
        error: error instanceof Error ? error.message : String(error),
        sessionId: target.kind === 'session' ? target.sessionId : null,
      }
    }
  }

  /** After a scheduled run a once schedule turns itself off and a repeat takes its next time; Run now changes neither. */
  private afterRun(schedule: Schedule, run: ScheduleRun, scheduled: boolean): Schedule {
    if (!scheduled) return { ...schedule, lastRun: run }
    const enabled = schedule.when.kind === 'once' ? false : schedule.enabled
    return { ...schedule, lastRun: run, enabled, nextRunAt: this.next({ when: schedule.when, enabled }) }
  }

  private async replace(updated: Schedule): Promise<void> {
    // Removed while it ran: nothing to record.
    if (!this.items.some((schedule) => schedule.id === updated.id)) return
    this.items = this.items.map((schedule) => (schedule.id === updated.id ? updated : schedule))
    await this.save()
  }

  private async save(): Promise<void> {
    const snapshot = this.items
    const write = this.writes
      .then(() => writeJsonAtomic(this.deps.statePath, { schedules: snapshot }))
      .catch((error: unknown) => this.deps.logger.warn({ err: error }, 'schedules not saved'))
    this.writes = write
    this.deps.broadcaster.broadcast({ type: 'schedules.updated', schedules: this.list() })
    await write
  }

  private find(id: string): Schedule {
    const schedule = this.items.find((item) => item.id === id)
    if (!schedule) throw new DaemonError('not_found', `schedule ${id} not found`)
    return schedule
  }
}
