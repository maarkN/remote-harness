import type { AccountLimits, LivePalette, PermissionRequestInfo, Session } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'

/** How many sessions the medium widgets list. */
export const WIDGET_SESSION_LIMIT = 3

/** A session's state as widgets show it; `pending` = a permission request waits for an answer. */
export type WidgetSessionState = 'pending' | 'waiting' | 'running' | 'idle'

export type WidgetSession = {
  id: string
  title: string
  state: WidgetSessionState
  /** Epoch ms it entered that state (the request's time while one is pending). */
  since: number
  /** Opens the session on its computer. */
  link: string
}

/** The oldest pending request that one tap can answer (never a question or a plan). */
export type WidgetRequest = {
  requestId: string
  sessionId: string
  tool: string
  /** "Bash asks for permission". */
  text: string
}

export type WidgetLimit = { percent: number; resetsAt: number }

/** Texts the widgets show, already translated: they cannot translate by themselves. */
export type WidgetLabels = {
  waiting: string
  running: string
  states: Record<WidgetSessionState, string>
  /** "{tool} asks for permission": the snapshot fills in the tool. */
  request: string
  allow: string
  deny: string
  answering: string
  empty: string
  pair: string
  /** "Updated {time}": the widget puts the snapshot's clock time in `{time}`. */
  updated: string
  fiveHour: string
  weekly: string
}

export type WidgetSnapshot = {
  /** `pair`: no paired computer, the widgets only invite to open the app. */
  kind: 'computer' | 'pair'
  daemonId: string | null
  /** Name of the computer, empty when unknown. */
  computer: string
  waiting: number
  running: number
  sessions: WidgetSession[]
  request: WidgetRequest | null
  /** A request answered from the widget, until the next snapshot: its buttons say "Sending…". */
  answering: string | null
  limits: { fiveHour: WidgetLimit | null; weekly: WidgetLimit | null }
  /** Epoch ms the snapshot was built. */
  updatedAt: number
  labels: WidgetLabels
  palette: LivePalette
  /** Opens the session list. */
  listLink: string
}

/** Scheme of the links widgets open (the app's first scheme). */
const SCHEME = 'remoteharness://'

/** Deep link of a session on its computer (the computer becomes the active one first). */
export function widgetSessionLink(sessionId: string, daemonId: string | null): string {
  const computer = daemonId ? `?computer=${encodeURIComponent(daemonId)}` : ''
  return `${SCHEME}session/${encodeURIComponent(sessionId)}${computer}`
}

/** The translated texts of the widgets. */
export function widgetLabels(t: TFunction, tool = '{tool}'): WidgetLabels {
  return {
    waiting: t('widgets.waiting'),
    running: t('widgets.running'),
    states: {
      pending: t('widgets.states.pending'),
      waiting: t('widgets.states.waiting'),
      running: t('widgets.states.running'),
      idle: t('widgets.states.idle'),
    },
    request: t('widgets.request', { tool }),
    allow: t('widgets.allow'),
    deny: t('widgets.deny'),
    answering: t('widgets.answering'),
    empty: t('widgets.empty'),
    pair: t('widgets.pair'),
    updated: t('widgets.updated'),
    fiveHour: t('widgets.fiveHour'),
    weekly: t('widgets.weekly'),
  }
}

/** The highest percentage of a window across the profiles, ignoring windows that already reset. */
function worstWindow(
  limits: readonly AccountLimits[],
  pick: (limits: AccountLimits) => AccountLimits['fiveHour'],
  now: number,
): WidgetLimit | null {
  let worst: WidgetLimit | null = null
  for (const entry of limits) {
    const window = pick(entry)
    if (!window || window.resetsAt <= now) continue
    if (!worst || window.percent > worst.percent)
      worst = { percent: window.percent, resetsAt: window.resetsAt }
  }
  return worst
}

const time = (iso: string, fallback: number) => {
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? fallback : parsed
}

const RANK: Record<WidgetSessionState, number> = { pending: 0, waiting: 1, running: 2, idle: 3 }

export type WidgetInput = {
  sessions: readonly Session[]
  pending: readonly PermissionRequestInfo[]
  limits: readonly AccountLimits[]
  daemonId: string | null
  computer: string
  labels: WidgetLabels
  palette: LivePalette
  now: number
  /** The last snapshot: a session still in the same state keeps the time it entered it. */
  previous?: WidgetSnapshot | null
}

/**
 * What the widgets show for the active computer. Waiting counts sessions in `waiting` or with a
 * pending request (same rule as the daemon's widget refresh push); running, the other `running`
 * ones. Sessions: a pending request first (oldest first), then waiting, running and idle, the most
 * recently updated first; ended sessions never show.
 */
export function buildWidgetSnapshot(input: WidgetInput): WidgetSnapshot {
  const { now, daemonId } = input
  const before = new Map(
    input.previous?.daemonId === daemonId ? input.previous.sessions.map((s) => [s.id, s] as const) : [],
  )
  const live = input.sessions.filter((s) => s.state !== 'ended')
  const liveIds = new Set(live.map((s) => s.id))
  const pending = input.pending
    .filter((p) => liveIds.has(p.sessionId))
    .sort((a, b) => time(a.createdAt, now) - time(b.createdAt, now))
  const firstRequest = new Map<string, PermissionRequestInfo>()
  for (const request of pending)
    if (!firstRequest.has(request.sessionId)) firstRequest.set(request.sessionId, request)

  const rows = live.map((session) => {
    const request = firstRequest.get(session.id)
    const state: WidgetSessionState = request
      ? 'pending'
      : session.state === 'waiting'
        ? 'waiting'
        : session.state === 'running'
          ? 'running'
          : 'idle'
    const kept = before.get(session.id)
    const since = request
      ? time(request.createdAt, now)
      : kept && kept.state === state
        ? kept.since
        : time(session.updatedAt, now)
    return { session, state, since }
  })
  const waiting = rows.filter((r) => r.state === 'pending' || r.state === 'waiting').length
  const running = rows.filter((r) => r.state === 'running').length
  const sessions = rows
    .sort(
      (a, b) =>
        RANK[a.state] - RANK[b.state] || (a.state === 'pending' ? a.since - b.since : b.since - a.since),
    )
    .slice(0, WIDGET_SESSION_LIMIT)
    .map(
      ({ session, state, since }): WidgetSession => ({
        id: session.id,
        title: session.title,
        state,
        since,
        link: widgetSessionLink(session.id, daemonId),
      }),
    )
  const oldest = pending.find((p) => !p.interaction && !p.terminal) ?? null
  return {
    kind: 'computer',
    daemonId,
    computer: input.computer,
    waiting,
    running,
    sessions,
    request: oldest
      ? {
          requestId: oldest.requestId,
          sessionId: oldest.sessionId,
          tool: oldest.tool,
          text: input.labels.request.replace('{tool}', oldest.tool),
        }
      : null,
    answering: null,
    limits: {
      fiveHour: worstWindow(input.limits, (l) => l.fiveHour, now),
      weekly: worstWindow(input.limits, (l) => l.sevenDay, now),
    },
    updatedAt: now,
    labels: input.labels,
    palette: input.palette,
    listLink: SCHEME,
  }
}

/** What the widgets draw, without the build time: equal keys need no redraw. */
export function snapshotKey(snapshot: WidgetSnapshot): string {
  const { updatedAt: _time, ...content } = snapshot
  return JSON.stringify(content)
}

/** The snapshot without a paired computer: the widgets invite to open the app. */
export function pairSnapshot(labels: WidgetLabels, palette: LivePalette, now: number): WidgetSnapshot {
  return {
    kind: 'pair',
    daemonId: null,
    computer: '',
    waiting: 0,
    running: 0,
    sessions: [],
    request: null,
    answering: null,
    limits: { fiveHour: null, weekly: null },
    updatedAt: now,
    labels,
    palette,
    listLink: SCHEME,
  }
}

/** The snapshot once a request was answered from the widget: no more buttons for it. */
export function markAnswering(snapshot: WidgetSnapshot, requestId: string): WidgetSnapshot {
  return snapshot.request?.requestId === requestId ? { ...snapshot, answering: requestId } : snapshot
}

/** Prefix of widget button targets that iOS performs in the app's process (see the expo-widgets patch). */
export const APP_TARGET_PREFIX = 'app:'

/** Target of a widget's Allow / Deny button. */
export function widgetTarget(decision: 'allow' | 'deny', requestId: string): string {
  return `${APP_TARGET_PREFIX}${decision}:${requestId}`
}

/** A widget button's answer, or null when the target is not one. */
export function parseWidgetTarget(target: string): { decision: 'allow' | 'deny'; requestId: string } | null {
  if (!target.startsWith(APP_TARGET_PREFIX)) return null
  const match = /^(allow|deny):(.+)$/.exec(target.slice(APP_TARGET_PREFIX.length))
  if (!match?.[1] || !match[2]) return null
  return { decision: match[1] === 'allow' ? 'allow' : 'deny', requestId: match[2] }
}

/** "Updated {time}" with the time filled in. */
export function updatedLine(labels: Pick<WidgetLabels, 'updated'>, clock: string): string {
  return labels.updated.replace('{time}', clock)
}

/** Parses a saved snapshot; null when missing or from another version of the app. */
export function parseSnapshot(raw: string | null): WidgetSnapshot | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<WidgetSnapshot> | null
    if (!value || (value.kind !== 'computer' && value.kind !== 'pair')) return null
    if (!Array.isArray(value.sessions) || !value.labels || !value.palette) return null
    if (typeof value.updatedAt !== 'number') return null
    return value as WidgetSnapshot
  } catch {
    return null
  }
}
