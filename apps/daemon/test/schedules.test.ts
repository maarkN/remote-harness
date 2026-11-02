import { join } from 'node:path'
import type { ScheduleInput, ServerMessage } from '@remote-harness/protocol'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { DaemonError } from '../src/core/errors.ts'
import { silentLogger } from '../src/core/logger.ts'
import { type ScheduleEvent, ScheduleService } from '../src/features/schedules/service.ts'
import { isMissed, MISSED_GRACE_MS, nextRunAt } from '../src/features/schedules/timing.ts'
import { useTempHome } from './helpers.ts'

const home = useTempHome()
const services: ScheduleService[] = []
afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.dispose()))
})

/** A local date (the computer's clock), month 1-12. 2026-11-01 is a Sunday. */
const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s, 0)

describe('nextRunAt', () => {
  test('once: the instant while it is ahead, nothing once it passed', () => {
    const at = local(2026, 11, 2, 9, 0)
    const when = { kind: 'once' as const, at: at.toISOString() }
    expect(nextRunAt(when, local(2026, 11, 1, 10))?.getTime()).toBe(at.getTime())
    expect(nextRunAt(when, at)).toBeNull()
    expect(nextRunAt({ kind: 'once', at: 'garbage' }, at)).toBeNull()
  })

  test('every day: today at the time while ahead, else tomorrow', () => {
    const when = { kind: 'repeat' as const, time: '09:00', days: [] }
    expect(nextRunAt(when, local(2026, 11, 2, 8, 30))?.getTime()).toBe(local(2026, 11, 2, 9).getTime())
    expect(nextRunAt(when, local(2026, 11, 2, 9, 0))?.getTime()).toBe(local(2026, 11, 3, 9).getTime())
  })

  test('weekdays skip the weekend', () => {
    const when = { kind: 'repeat' as const, time: '09:00', days: [1, 2, 3, 4, 5] }
    // Friday 6 Nov after the time → Monday 9 Nov.
    expect(nextRunAt(when, local(2026, 11, 6, 10))?.getTime()).toBe(local(2026, 11, 9, 9).getTime())
    // Sunday → Monday.
    expect(nextRunAt(when, local(2026, 11, 1, 12))?.getTime()).toBe(local(2026, 11, 2, 9).getTime())
    const sunday = { kind: 'repeat' as const, time: '23:30', days: [0] }
    expect(nextRunAt(sunday, local(2026, 11, 1, 23, 45))?.getTime()).toBe(
      local(2026, 11, 8, 23, 30).getTime(),
    )
  })

  test('isMissed applies the grace', () => {
    const due = local(2026, 11, 2, 9)
    expect(isMissed(due, local(2026, 11, 2, 9, 2))).toBe(false)
    expect(isMissed(due, new Date(due.getTime() + MISSED_GRACE_MS + 1))).toBe(true)
  })
})

describe('ScheduleService', () => {
  function setup(options: { statePath?: string } = {}) {
    const sent: ServerMessage[] = []
    const events: [ScheduleEvent, string][] = []
    let now = local(2026, 11, 2, 8, 0).getTime()
    let seq = 0
    let delivery: 'sent' | 'queued' = 'sent'
    const submit = vi.fn(async (_sessionId: string, _prompt: string) => ({ delivery }))
    const start = vi.fn(async () => ({ sessionId: 'new1' }))
    const service = new ScheduleService({
      runner: { submit, start },
      broadcaster: { broadcast: (m) => sent.push(m) },
      statePath: options.statePath ?? join(home.dir(), `schedules-${Math.random()}.json`),
      logger: silentLogger,
      notify: (event, schedule) => events.push([event, schedule.id]),
      now: () => now,
      newId: () => `s${++seq}`,
      // The interval never fires in tests; `tick` is called by hand.
      tickMs: 24 * 3_600_000,
    })
    services.push(service)
    return {
      service,
      sent,
      events,
      submit,
      start,
      lists: () => sent.filter((m) => m.type === 'schedules.updated'),
      setNow: (date: Date) => {
        now = date.getTime()
      },
      setDelivery: (value: 'sent' | 'queued') => {
        delivery = value
      },
    }
  }

  const weekdays = (patch: Partial<ScheduleInput> = {}): ScheduleInput => ({
    title: 'Daily summary',
    prompt: 'Summarize yesterday',
    target: { kind: 'session', sessionId: 'sess1' },
    when: { kind: 'repeat', time: '09:00', days: [1, 2, 3, 4, 5] },
    enabled: true,
    ...patch,
  })

  test('create computes the next run and broadcasts the list', async () => {
    const f = setup()
    const schedule = await f.service.create(weekdays())
    expect(schedule.id).toBe('s1')
    expect(schedule.nextRunAt).toBe(local(2026, 11, 2, 9).toISOString())
    expect(schedule.lastRun).toBeNull()
    expect(f.lists().at(-1)).toEqual({ type: 'schedules.updated', schedules: [schedule] })
    const disabled = await f.service.create(weekdays({ enabled: false }))
    expect(disabled.nextRunAt).toBeNull()
  })

  test('a due run within the grace is delivered; the schedule moves on and the phone hears of it', async () => {
    const f = setup()
    await f.service.create(weekdays())
    f.setNow(local(2026, 11, 2, 9, 1))
    await f.service.tick()
    expect(f.submit).toHaveBeenCalledWith('sess1', 'Summarize yesterday')
    const [schedule] = f.service.list()
    expect(schedule?.lastRun).toMatchObject({ outcome: 'sent', sessionId: 'sess1', error: null })
    expect(schedule?.nextRunAt).toBe(local(2026, 11, 3, 9).toISOString())
    expect(f.events).toEqual([['scheduleRan', 's1']])
    // Not run twice at the same tick.
    await f.service.tick()
    expect(f.submit).toHaveBeenCalledTimes(1)
  })

  test('a busy session queues the prompt', async () => {
    const f = setup()
    f.setDelivery('queued')
    await f.service.create(weekdays())
    f.setNow(local(2026, 11, 2, 9, 0, 30))
    await f.service.tick()
    expect(f.service.list()[0]?.lastRun?.outcome).toBe('queued')
  })

  test('a new-session target starts a session with the prompt', async () => {
    const f = setup()
    const target = { kind: 'new' as const, profileId: 'claudin', cwd: '/w', worktree: true, name: 'Daily' }
    await f.service.create(weekdays({ target }))
    f.setNow(local(2026, 11, 2, 9, 0, 10))
    await f.service.tick()
    expect(f.start).toHaveBeenCalledWith(target, 'Summarize yesterday')
    expect(f.service.list()[0]?.lastRun).toMatchObject({ outcome: 'started', sessionId: 'new1' })
    expect(f.events).toEqual([['scheduleRan', 's1']])
  })

  test('a run past the grace is missed, not run, and the next time moves on', async () => {
    const f = setup()
    await f.service.create(weekdays())
    f.setNow(local(2026, 11, 2, 9, 20))
    await f.service.tick()
    expect(f.submit).not.toHaveBeenCalled()
    const [schedule] = f.service.list()
    expect(schedule?.lastRun).toMatchObject({ outcome: 'missed', at: local(2026, 11, 2, 9).toISOString() })
    expect(schedule?.nextRunAt).toBe(local(2026, 11, 3, 9).toISOString())
    expect(schedule?.enabled).toBe(true)
    expect(f.events).toEqual([['scheduleMissed', 's1']])
  })

  test('a once schedule turns itself off after its run; Run now leaves the timing alone', async () => {
    const f = setup()
    const at = local(2026, 11, 2, 14, 30)
    const once = await f.service.create(weekdays({ when: { kind: 'once', at: at.toISOString() } }))
    expect(once.nextRunAt).toBe(at.toISOString())
    const ran = await f.service.run(once.id)
    expect(ran.lastRun?.outcome).toBe('sent')
    expect(ran.enabled).toBe(true)
    expect(ran.nextRunAt).toBe(at.toISOString())
    f.setNow(local(2026, 11, 2, 14, 31))
    await f.service.tick()
    const [schedule] = f.service.list()
    expect(schedule?.enabled).toBe(false)
    expect(schedule?.nextRunAt).toBeNull()
    expect(f.submit).toHaveBeenCalledTimes(2)
  })

  test('a failure is recorded with its reason and pushed as failed', async () => {
    const f = setup()
    f.submit.mockRejectedValueOnce(new DaemonError('not_found', 'session sess1 not found'))
    await f.service.create(weekdays())
    f.setNow(local(2026, 11, 2, 9, 0, 5))
    await f.service.tick()
    expect(f.service.list()[0]?.lastRun).toMatchObject({
      outcome: 'failed',
      error: 'session sess1 not found',
      sessionId: 'sess1',
    })
    expect(f.events).toEqual([['scheduleFailed', 's1']])
  })

  test('update recomputes the next run, disabling clears it, remove drops it', async () => {
    const f = setup()
    const created = await f.service.create(weekdays())
    const updated = await f.service.update(
      created.id,
      weekdays({ when: { kind: 'repeat', time: '18:00', days: [] } }),
    )
    expect(updated.nextRunAt).toBe(local(2026, 11, 2, 18).toISOString())
    expect((await f.service.update(created.id, weekdays({ enabled: false }))).nextRunAt).toBeNull()
    await f.service.remove(created.id)
    expect(f.service.list()).toEqual([])
    await expect(f.service.update('nope', weekdays())).rejects.toBeInstanceOf(DaemonError)
    await expect(f.service.run('nope')).rejects.toBeInstanceOf(DaemonError)
  })

  test('schedules are saved and restored; a run due while down is missed at start', async () => {
    const statePath = join(home.dir(), 'schedules.json')
    const first = setup({ statePath })
    await first.service.create(weekdays())
    await first.service.dispose()

    const second = setup({ statePath })
    second.setNow(local(2026, 11, 2, 9, 30))
    await second.service.start()
    const [schedule] = second.service.list()
    expect(schedule?.id).toBe('s1')
    expect(schedule?.title).toBe('Daily summary')
    expect(schedule?.lastRun?.outcome).toBe('missed')
    expect(schedule?.nextRunAt).toBe(local(2026, 11, 3, 9).toISOString())
    expect(second.events).toEqual([['scheduleMissed', 's1']])
  })
})
