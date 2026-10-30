import type { AccountLimits, LivePalette, PermissionRequestInfo, Session } from '@remote-harness/protocol'
import { runOnShortLivedClient } from '@/core/connection/short-lived'
import { i18n } from '@/core/i18n'
import { resolveMachineName } from '@/core/i18n/machine'
import type { Computer } from '@/core/storage/computer'
import { credentialsStorage } from '@/core/storage/credentials'
import { currentTheme } from '@/core/theme'
import { livePalette } from '../live-status/logic'
import { respondInBackground } from '../push/respond-in-background'
import { buildWidgetSnapshot, markAnswering, pairSnapshot, type WidgetSnapshot, widgetLabels } from './logic'
import { publishWidgets } from './publish'
import { loadSnapshot } from './store'

/** How long a background refresh listens for the limits the daemon sends on connect. */
const LIMITS_WAIT_MS = 1_500

/** The snapshot of a computer from its data, with the app's language and theme. */
export function snapshotOf(
  computer: Pick<Computer, 'daemonId' | 'name' | 'alias'> | null,
  data: {
    sessions: readonly Session[]
    pending: readonly PermissionRequestInfo[]
    limits: readonly AccountLimits[]
    host?: string | null
  },
  /** Background tasks keep the theme of the last snapshot (the saved preference is not read there). */
  palette: LivePalette = livePalette(currentTheme()),
): WidgetSnapshot {
  const labels = widgetLabels(i18n.t)
  const now = Date.now()
  if (!computer) return pairSnapshot(labels, palette, now)
  return buildWidgetSnapshot({
    ...data,
    daemonId: computer.daemonId,
    computer: resolveMachineName(computer.alias, data.host ?? computer.name) ?? '',
    labels,
    palette,
    now,
  })
}

/**
 * Fetches the state of a computer (the active one by default) over a short-lived connection and
 * publishes it: after a widget refresh push or an answer from a widget, with the app maybe closed.
 * Limits the daemon sends on connect are kept; otherwise the last snapshot's stay.
 */
export async function refreshWidgetsInBackground(daemonId?: string): Promise<boolean> {
  const { computers, active } = await credentialsStorage.loadAll()
  const computer = computers.find((c) => c.daemonId === (daemonId ?? active)) ?? null
  if (!computer) {
    if (computers.length === 0)
      await publishWidgets(snapshotOf(null, { sessions: [], pending: [], limits: [] }))
    return false
  }
  // Only the active computer is on the widgets.
  if (computer.daemonId !== active) return false
  const previous = await loadSnapshot()
  const fetched = await runOnShortLivedClient(async (client) => {
    const limits: AccountLimits[] = []
    const off = client.on('limits.updated', (m) => limits.push(m.limits))
    try {
      const [sessions, permissions] = await Promise.all([
        client.request({ type: 'sessions.list' }),
        client.request({ type: 'permissions.list' }),
        new Promise((resolve) => setTimeout(resolve, LIMITS_WAIT_MS)),
      ])
      return {
        sessions: sessions.type === 'sessions.snapshot' ? sessions.sessions : [],
        pending: permissions.type === 'permissions.result' ? permissions.requests : [],
        limits,
        host: client.hello?.host ?? null,
      }
    } finally {
      off()
    }
  }, computer.daemonId)
  if (!fetched.ok) return false
  const snapshot = snapshotOf(computer, fetched.value, previous?.palette)
  const keepLimits = fetched.value.limits.length === 0 && previous?.daemonId === computer.daemonId
  await publishWidgets(keepLimits && previous ? { ...snapshot, limits: previous.limits } : snapshot)
  return true
}

/** Answers runs once per request, also when the same tap reaches the app twice. */
const answers = new Map<string, Promise<boolean>>()

/**
 * Allow / Deny tapped on a widget: its buttons give way to "Sending…" at once, the answer goes to the
 * snapshot's computer over a short-lived connection, then the widgets get the fresh state (which
 * brings the request back if the answer failed).
 */
export function answerFromWidget(
  decision: 'allow' | 'deny',
  requestId: string,
  daemonId?: string,
): Promise<boolean> {
  const running = answers.get(requestId)
  if (running) return running
  const answer = (async () => {
    const snapshot = await loadSnapshot()
    if (snapshot) await publishWidgets(markAnswering(snapshot, requestId))
    const target = daemonId || snapshot?.daemonId || undefined
    const ok = await respondInBackground(requestId, decision, target)
    if (!ok) answers.delete(requestId)
    await refreshWidgetsInBackground(target).catch(() => false)
    return ok
  })()
  answers.set(requestId, answer)
  return answer
}
