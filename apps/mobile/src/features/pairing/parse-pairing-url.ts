import { type ParsedPairingCode, pairingCodeFromParams, parsePairingCode } from '@remote-harness/protocol'

export type { ParsedPairingCode } from '@remote-harness/protocol'

/** A scanned QR or a pasted `remoteharness://pair?…` link. */
export function parsePairingLink(raw: string): ParsedPairingCode {
  return parsePairingCode(raw)
}

type RouteParams = Record<string, string | string[] | undefined>

/**
 * The pairing code of a deep link opened on `/pair` (e.g. scanned with the iOS Camera app); null
 * when the route was opened without one.
 */
export function pairingCodeFromRoute(params: RouteParams): ParsedPairingCode | null {
  if (!params.v && !params.token) return null
  const all = (name: string): string[] => {
    const value = params[name]
    if (value === undefined) return []
    return Array.isArray(value) ? value : [value]
  }
  return pairingCodeFromParams(
    (name) => all(name)[0] ?? null,
    (name) => all(name).flatMap((value) => value.split(',')),
  )
}

/** What this device tells the daemon about itself when pairing (shown in its device list). */
export function deviceInfo(os: string, isPad: boolean): { name: string; platform: string } {
  if (os === 'ios') return { name: isPad ? 'iPad' : 'iPhone', platform: 'ios' }
  if (os === 'android') return { name: 'Android', platform: 'android' }
  return { name: os, platform: os }
}
