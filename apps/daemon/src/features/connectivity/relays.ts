/** Pure choices about connection relays: URLs, home relay selection and failover. */

/** Round trip to a relay's health check, or null when it did not answer. */
export type RelayMeasurement = { url: string; rttMs: number | null }

function base(url: string): string {
  return url.replace(/\/+$/, '')
}

/** `wss://host[/prefix]` → `https://host[/prefix]/healthz` (`ws` → `http`). */
export function healthUrl(relayUrl: string): string {
  return `${base(relayUrl).replace(/^ws(s?):/, 'http$1:')}/healthz`
}

/** The daemon endpoint of a relay. */
export function relayDaemonUrl(relayUrl: string): string {
  return `${base(relayUrl)}/v1/daemon`
}

/** The device endpoint of a relay for a daemon ID (shared with the app). */
export { relayDeviceUrl } from '@remote-harness/protocol'

/** The fastest relay that answered, leaving out `exclude`; null when none answered. */
export function pickHomeRelay(
  measurements: readonly RelayMeasurement[],
  exclude: ReadonlySet<string> = new Set(),
): string | null {
  let best: RelayMeasurement | null = null
  for (const m of measurements) {
    if (m.rttMs === null || exclude.has(m.url)) continue
    if (!best || (best.rttMs ?? Number.POSITIVE_INFINITY) > m.rttMs) best = m
  }
  return best?.url ?? null
}

/** Consecutive failed reconnects to the home relay before measuring again and moving. */
export const FAILOVER_AFTER = 3

/**
 * After the home relay failed `FAILOVER_AFTER` times: the fastest other relay that answers, else
 * the same one again when it is the only one answering (or nothing answers at all).
 */
export function failoverRelay(measurements: readonly RelayMeasurement[], failed: string): string | null {
  return pickHomeRelay(measurements, new Set([failed])) ?? pickHomeRelay(measurements)
}

/** Reconnect delay: 1 s doubling to 30 s. */
export function reconnectDelay(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt))
}
