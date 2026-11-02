import type {
  Schedule,
  ScheduleInput,
  ScheduleRun,
  ScheduleTarget,
  ScheduleWhen,
  Session,
} from '@remote-harness/protocol'
import { SCHEDULE_PROMPT_MAX, SCHEDULE_TITLE_MAX } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'
import { relativeTime, shortPath } from '@/core/utils/time'

/** Weekdays in display order (Monday first), as `Date.getDay()` numbers. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const
export const WORKDAYS = [1, 2, 3, 4, 5] as const

/** `9:00` or `09:00` → `09:00`; anything else `null`. */
export function parseTime(input: string): string | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(input)
  if (!match?.[1] || !match[2]) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** `YYYY-MM-DD` → the same, or `null` when it is not a real date. */
export function parseDate(input: string): string | null {
  const match = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(input)
  if (!match?.[1] || !match[2] || !match[3]) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The instant of a local date and time on this phone's clock (ISO); `null` when either is not valid. */
export function onceAt(date: string, time: string): string | null {
  const day = parseDate(date)
  const clock = parseTime(time)
  if (!day || !clock) return null
  const [y, m, d] = day.split('-').map(Number)
  const [hours, minutes] = clock.split(':').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, hours ?? 0, minutes ?? 0, 0, 0).toISOString()
}

const pad = (value: number) => String(value).padStart(2, '0')

/** `YYYY-MM-DD` and `HH:MM` of an instant, on this phone's clock. */
export function localDateTime(iso: string): { date: string; time: string } | null {
  const at = new Date(iso)
  if (!Number.isFinite(at.getTime())) return null
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  }
}

export function cleanScheduleTitle(input: string): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, SCHEDULE_TITLE_MAX).trim()
}

/** What the editor holds; `formToInput` turns it into what the daemon takes. */
export type ScheduleForm = {
  title: string
  prompt: string
  target: ScheduleTarget | null
  repeat: boolean
  /** `HH:MM`, both for once and repeat. */
  time: string
  /** Repeat: weekdays (none = every day). */
  days: number[]
  /** Once: `YYYY-MM-DD`. */
  date: string
  enabled: boolean
}

export type ScheduleFormError = 'title' | 'prompt' | 'promptTooLong' | 'target' | 'time' | 'date' | 'past'

export function emptyForm(preset: { target?: ScheduleTarget | null } = {}): ScheduleForm {
  return {
    title: '',
    prompt: '',
    target: preset.target ?? null,
    repeat: true,
    time: '09:00',
    days: [...WORKDAYS],
    date: '',
    enabled: true,
  }
}

/** The editor's fields for an existing schedule. */
export function formFrom(schedule: Schedule): ScheduleForm {
  const when = schedule.when
  const once = when.kind === 'once' ? localDateTime(when.at) : null
  return {
    title: schedule.title,
    prompt: schedule.prompt,
    target: schedule.target,
    repeat: when.kind === 'repeat',
    time: when.kind === 'repeat' ? when.time : (once?.time ?? '09:00'),
    days: when.kind === 'repeat' ? [...when.days] : [...WORKDAYS],
    date: once?.date ?? '',
    enabled: schedule.enabled,
  }
}

/** Validates the form; a once schedule must be ahead of `now`. */
export function formToInput(
  form: ScheduleForm,
  now: Date = new Date(),
): { ok: true; input: ScheduleInput } | { ok: false; error: ScheduleFormError } {
  const title = cleanScheduleTitle(form.title)
  if (!title) return { ok: false, error: 'title' }
  const prompt = form.prompt.trim()
  if (!prompt) return { ok: false, error: 'prompt' }
  if (prompt.length > SCHEDULE_PROMPT_MAX) return { ok: false, error: 'promptTooLong' }
  if (!form.target) return { ok: false, error: 'target' }
  const time = parseTime(form.time)
  if (!time) return { ok: false, error: 'time' }
  let when: ScheduleWhen
  if (form.repeat) {
    when = { kind: 'repeat', time, days: [...new Set(form.days)].sort((a, b) => a - b) }
  } else {
    const at = onceAt(form.date, time)
    if (!at) return { ok: false, error: 'date' }
    if (Date.parse(at) <= now.getTime()) return { ok: false, error: 'past' }
    when = { kind: 'once', at }
  }
  return { ok: true, input: { title, prompt, target: form.target, when, enabled: form.enabled } }
}

/** Toggles a weekday in the form's set. */
export function toggleDay(days: readonly number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
}

const sameSet = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index])

/** "Every day at 09:00", "Weekdays at 09:00", "Mon, Wed at 09:00", "Once · 2 Nov, 14:30". */
export function describeWhen(when: ScheduleWhen, t: TFunction, locale: string): string {
  if (when.kind === 'once') {
    const at = new Date(when.at)
    const day = at.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    const time = at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return t('schedules.when.once', { when: `${day}, ${time}` })
  }
  if (when.days.length === 0 || when.days.length === 7) return t('schedules.when.daily', { time: when.time })
  if (sameSet(when.days, WORKDAYS)) return t('schedules.when.workdays', { time: when.time })
  const names = WEEKDAYS.filter((day) => when.days.includes(day)).map((day) => t(`schedules.days.d${day}`))
  return t('schedules.when.days', { days: names.join(', '), time: when.time })
}

/** The session's title, or "New session · <folder>" (with the profile when there are several). */
export function describeTarget(
  target: ScheduleTarget,
  sessions: Readonly<Record<string, Pick<Session, 'title'>>>,
  profiles: readonly { id: string; name: string }[],
  t: TFunction,
): string {
  if (target.kind === 'session') {
    return sessions[target.sessionId]?.title ?? t('schedules.target.goneSession')
  }
  const profile = profiles.length > 1 ? profiles.find((p) => p.id === target.profileId)?.name : undefined
  const where = `${t('schedules.target.newSession')} · ${shortPath(target.cwd)}`
  return profile ? `${where} · ${profile}` : where
}

/** "Sent 3 min ago", "Missed · 09:00", "Failed: <reason>". */
export function describeRun(run: ScheduleRun | null, t: TFunction, now: number = Date.now()): string {
  if (!run) return t('schedules.run.never')
  const ago = relativeTime(run.at, t, now)
  switch (run.outcome) {
    case 'sent':
    case 'queued':
    case 'started':
      return t(`schedules.run.${run.outcome}`, { ago })
    case 'missed':
      return t('schedules.run.missed', { ago })
    case 'failed':
      return t('schedules.run.failed', { reason: run.error ?? '' })
  }
}

/** "Next: Mon, 2 Nov, 09:00", or why there is none (off, or spent). */
export function describeNext(
  schedule: Pick<Schedule, 'nextRunAt' | 'enabled'>,
  t: TFunction,
  locale: string,
): string {
  if (!schedule.nextRunAt) return t(schedule.enabled ? 'schedules.next.none' : 'schedules.next.off')
  const at = new Date(schedule.nextRunAt)
  if (!Number.isFinite(at.getTime())) return t('schedules.next.none')
  const when = at.toLocaleString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return t('schedules.next.at', { when })
}

/** Missed and failed runs wait for the user (Run now). */
export function needsAttention(schedule: Pick<Schedule, 'lastRun'>): boolean {
  return schedule.lastRun?.outcome === 'missed' || schedule.lastRun?.outcome === 'failed'
}

/** Next run first; without one (disabled, spent) last; then by title. */
export function sortSchedules(schedules: readonly Schedule[]): Schedule[] {
  return [...schedules].sort((a, b) => {
    if (a.nextRunAt && b.nextRunAt) return a.nextRunAt.localeCompare(b.nextRunAt)
    if (a.nextRunAt !== null || b.nextRunAt !== null) return a.nextRunAt ? -1 : 1
    return a.title.localeCompare(b.title)
  })
}
