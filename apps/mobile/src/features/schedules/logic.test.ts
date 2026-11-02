import type { Schedule } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import {
  cleanScheduleTitle,
  describeRun,
  describeTarget,
  describeWhen,
  emptyForm,
  formFrom,
  formToInput,
  localDateTime,
  needsAttention,
  onceAt,
  parseDate,
  parseTime,
  sortSchedules,
  toggleDay,
} from './logic'

const { t } = createI18n('en-US')
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0)

const schedule = (patch: Partial<Schedule> = {}): Schedule => ({
  id: 's1',
  title: 'Daily summary',
  prompt: 'Summarize yesterday',
  target: { kind: 'session', sessionId: 'a' },
  when: { kind: 'repeat', time: '09:00', days: [1, 2, 3, 4, 5] },
  enabled: true,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
  lastRun: null,
  nextRunAt: '2026-11-02T12:00:00Z',
  ...patch,
})

describe('time and date fields', () => {
  test('parseTime normalizes HH:MM and rejects the rest', () => {
    expect(parseTime('9:05')).toBe('09:05')
    expect(parseTime(' 23:59 ')).toBe('23:59')
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('9h')).toBeNull()
  })

  test('parseDate keeps real dates only', () => {
    expect(parseDate('2026-11-2')).toBe('2026-11-02')
    expect(parseDate('2026-02-30')).toBeNull()
    expect(parseDate('nov 2')).toBeNull()
  })

  test('onceAt and localDateTime round-trip on the phone clock', () => {
    const iso = onceAt('2026-11-02', '14:30')
    expect(iso).toBe(local(2026, 11, 2, 14, 30).toISOString())
    expect(localDateTime(iso ?? '')).toEqual({ date: '2026-11-02', time: '14:30' })
    expect(onceAt('2026-13-01', '14:30')).toBeNull()
    expect(localDateTime('garbage')).toBeNull()
  })
})

describe('the editor form', () => {
  test('a new form repeats on workdays at 09:00; a preset target is kept', () => {
    const form = emptyForm({ target: { kind: 'session', sessionId: 'a' } })
    expect(form).toMatchObject({ repeat: true, time: '09:00', days: [1, 2, 3, 4, 5], enabled: true })
    expect(form.target).toEqual({ kind: 'session', sessionId: 'a' })
  })

  test('formFrom reads a repeat and a once schedule', () => {
    expect(formFrom(schedule())).toMatchObject({ repeat: true, time: '09:00', days: [1, 2, 3, 4, 5] })
    const once = schedule({ when: { kind: 'once', at: local(2026, 11, 2, 14, 30).toISOString() } })
    expect(formFrom(once)).toMatchObject({ repeat: false, date: '2026-11-02', time: '14:30' })
  })

  test('formToInput validates each field in order', () => {
    const now = local(2026, 11, 1, 10)
    const form = {
      ...emptyForm(),
      title: ' Daily ',
      prompt: 'Go',
      target: { kind: 'session' as const, sessionId: 'a' },
    }
    expect(formToInput(form, now)).toEqual({
      ok: true,
      input: {
        title: 'Daily',
        prompt: 'Go',
        target: { kind: 'session', sessionId: 'a' },
        when: { kind: 'repeat', time: '09:00', days: [1, 2, 3, 4, 5] },
        enabled: true,
      },
    })
    expect(formToInput({ ...form, title: ' ' }, now)).toEqual({ ok: false, error: 'title' })
    expect(formToInput({ ...form, prompt: '' }, now)).toEqual({ ok: false, error: 'prompt' })
    expect(formToInput({ ...form, prompt: 'x'.repeat(8_001) }, now)).toEqual({
      ok: false,
      error: 'promptTooLong',
    })
    expect(formToInput({ ...form, target: null }, now)).toEqual({ ok: false, error: 'target' })
    expect(formToInput({ ...form, time: '25:00' }, now)).toEqual({ ok: false, error: 'time' })
    expect(formToInput({ ...form, repeat: false, date: '' }, now)).toEqual({ ok: false, error: 'date' })
    expect(formToInput({ ...form, repeat: false, date: '2026-10-31' }, now)).toEqual({
      ok: false,
      error: 'past',
    })
    const once = formToInput({ ...form, repeat: false, date: '2026-11-02', time: '8:00' }, now)
    expect(once).toEqual({
      ok: true,
      input: expect.objectContaining({ when: { kind: 'once', at: local(2026, 11, 2, 8).toISOString() } }),
    })
  })

  test('toggleDay and the title cleanup', () => {
    expect(toggleDay([1, 2], 3)).toEqual([1, 2, 3])
    expect(toggleDay([1, 2], 2)).toEqual([1])
    expect(cleanScheduleTitle(`  Daily\n summary ${'x'.repeat(80)}`).length).toBe(60)
  })
})

describe('descriptions', () => {
  test('describeWhen in words', () => {
    expect(describeWhen({ kind: 'repeat', time: '09:00', days: [] }, t, 'en-US')).toBe('Every day at 09:00')
    expect(describeWhen({ kind: 'repeat', time: '09:00', days: [1, 2, 3, 4, 5] }, t, 'en-US')).toBe(
      'Weekdays at 09:00',
    )
    expect(describeWhen({ kind: 'repeat', time: '18:30', days: [0, 3] }, t, 'en-US')).toBe(
      'Wed, Sun at 18:30',
    )
    const once = describeWhen({ kind: 'once', at: local(2026, 11, 2, 14, 30).toISOString() }, t, 'en-US')
    expect(once).toMatch(/^Once · .*Nov.*2.*14:30|^Once · .*Nov.*2.*2:30/)
    expect(
      describeWhen({ kind: 'repeat', time: '09:00', days: [1, 2, 3, 4, 5] }, createI18n('pt-BR').t, 'pt-BR'),
    ).toBe('Dias úteis às 09:00')
  })

  test('describeTarget names the session or the new session', () => {
    const sessions = { a: { title: 'Fix login' } }
    const profiles = [
      { id: 'p1', name: 'Work' },
      { id: 'p2', name: 'Personal' },
    ]
    expect(describeTarget({ kind: 'session', sessionId: 'a' }, sessions, profiles, t)).toBe('Fix login')
    expect(describeTarget({ kind: 'session', sessionId: 'gone' }, sessions, profiles, t)).toBe(
      'Session no longer open',
    )
    expect(
      describeTarget(
        { kind: 'new', profileId: 'p2', cwd: '/Users/me/code/app', worktree: false },
        sessions,
        profiles,
        t,
      ),
    ).toBe('New session · ~/code/app · Personal')
    expect(
      describeTarget(
        { kind: 'new', profileId: 'p1', cwd: '/srv/app', worktree: false },
        sessions,
        [profiles[0]!],
        t,
      ),
    ).toBe('New session · /srv/app')
  })

  test('describeRun and needsAttention', () => {
    const now = Date.parse('2026-11-02T12:03:00Z')
    const at = '2026-11-02T12:00:00Z'
    expect(describeRun(null, t, now)).toBe('Never ran')
    expect(describeRun({ at, outcome: 'sent', error: null, sessionId: 'a' }, t, now)).toMatch(/^Sent /)
    expect(describeRun({ at, outcome: 'missed', error: null, sessionId: null }, t, now)).toMatch(/^Missed /)
    expect(describeRun({ at, outcome: 'failed', error: 'no pane', sessionId: null }, t, now)).toBe(
      'Failed: no pane',
    )
    expect(
      needsAttention(schedule({ lastRun: { at, outcome: 'missed', error: null, sessionId: null } })),
    ).toBe(true)
    expect(needsAttention(schedule({ lastRun: { at, outcome: 'sent', error: null, sessionId: 'a' } }))).toBe(
      false,
    )
    expect(needsAttention(schedule())).toBe(false)
  })

  test('sortSchedules: next run first, spent ones last', () => {
    const list = [
      schedule({ id: 'b', title: 'B', nextRunAt: null }),
      schedule({ id: 'c', title: 'C', nextRunAt: '2026-11-03T09:00:00Z' }),
      schedule({ id: 'a', title: 'A', nextRunAt: null }),
      schedule({ id: 'd', title: 'D', nextRunAt: '2026-11-02T09:00:00Z' }),
    ]
    expect(sortSchedules(list).map((s) => s.id)).toEqual(['d', 'c', 'a', 'b'])
  })
})
