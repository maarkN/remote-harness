import type { PermissionRequestInfo, Session } from '@remote-harness/protocol'

/** Least time between two widget refresh pushes of this computer. */
export const WIDGET_REFRESH_INTERVAL_MS = 30_000

/** `data.event` of the widget refresh push; the app fetches the state itself when it gets one. */
export const WIDGET_REFRESH_EVENT = 'widgets'

/**
 * What the phone's widgets show, as one comparable string: sessions waiting for the user (state
 * `waiting` or with a pending request), running sessions and the pending requests. Same counting as
 * the app's snapshot (`src/features/widgets/logic.ts`).
 */
export function widgetSignature(
  sessions: readonly Pick<Session, 'id' | 'state'>[],
  pending: readonly Pick<PermissionRequestInfo, 'requestId' | 'sessionId'>[],
): string {
  const asking = new Set(pending.map((p) => p.sessionId))
  let waiting = 0
  let running = 0
  for (const session of sessions) {
    if (session.state === 'ended') continue
    if (session.state === 'waiting' || asking.has(session.id)) waiting += 1
    else if (session.state === 'running') running += 1
  }
  const requests = pending.map((p) => p.requestId).sort()
  return `${waiting}|${running}|${requests.join(',')}`
}

export type WidgetRefresherDeps = {
  signature: () => string
  /** False while an app is in the foreground (it publishes itself) or with push off. */
  canSend: () => boolean
  send: () => Promise<void>
  now?: () => number
  intervalMs?: number
}

/**
 * Sends the widget refresh push when the signature changes: right away when the last one is older
 * than the interval, otherwise once the interval has passed, with the latest signature (trailing).
 * A change the phones need not hear about (an app in front, push off) only moves the baseline.
 */
export class WidgetRefresher {
  private last: string
  private lastSentAt = Number.NEGATIVE_INFINITY
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly now: () => number
  private readonly intervalMs: number

  constructor(private readonly deps: WidgetRefresherDeps) {
    this.now = deps.now ?? Date.now
    this.intervalMs = deps.intervalMs ?? WIDGET_REFRESH_INTERVAL_MS
    this.last = deps.signature()
  }

  /** Something widgets may show changed. */
  changed(): void {
    if (this.timer) return
    const wait = this.lastSentAt + this.intervalMs - this.now()
    if (wait <= 0) {
      this.flush()
      return
    }
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, wait)
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private flush(): void {
    const signature = this.deps.signature()
    if (signature === this.last) return
    this.last = signature
    if (!this.deps.canSend()) return
    this.lastSentAt = this.now()
    void this.deps.send().catch(() => undefined)
  }
}
