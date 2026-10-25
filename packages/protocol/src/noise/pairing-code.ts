import { base64UrlToBytes, bytesToBase64Url } from './bytes.ts'
import { PAIRING_SECRET_LENGTH } from './channel.ts'

/** Pairing code version (`v=` in the link). */
export const PAIRING_CODE_VERSION = 2
/** How long a pairing code is accepted after the daemon creates it. */
export const PAIRING_CODE_TTL_MS = 5 * 60_000
const DAEMON_ID = /^[0-9a-f]{32}$/
const MAX_ADDRESSES = 8

/** What a pairing code carries: who the daemon is, where to find it, and the single-use secret. */
export type PairingCode = {
  /** Hex hash of the daemon's connection relay key (its room on the relay). */
  daemonId: string
  /** The daemon's Noise static public key. */
  daemonKey: Uint8Array
  secret: Uint8Array
  /** Direct `host:port` addresses (IPv6 in brackets). */
  addresses: string[]
  /** The daemon's home connection relay (`wss://…`), when it has one. */
  relay?: string
  /** The computer's machine name. */
  name: string
}

export function formatPairingCode(code: PairingCode): string {
  const params: [string, string][] = [
    ['v', String(PAIRING_CODE_VERSION)],
    ['id', code.daemonId],
    ['k', bytesToBase64Url(code.daemonKey)],
    ['s', bytesToBase64Url(code.secret)],
    ...code.addresses.map((address): [string, string] => ['a', address]),
    ...(code.relay ? [['r', code.relay] as [string, string]] : []),
    ['n', code.name],
  ]
  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
  return `remoteharness://pair?${query}`
}

/** Query string to key/values, without URLSearchParams (not complete in every JS runtime). */
export function parseQuery(query: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const part of query.split('&')) {
    if (!part) continue
    const eq = part.indexOf('=')
    const decode = (text: string) => {
      try {
        return decodeURIComponent(text.replace(/\+/g, ' '))
      } catch {
        return ''
      }
    }
    const key = decode(eq < 0 ? part : part.slice(0, eq))
    const value = eq < 0 ? '' : decode(part.slice(eq + 1))
    out.set(key, [...(out.get(key) ?? []), value])
  }
  return out
}

export type ParsedPairingCode =
  | { ok: true; code: PairingCode }
  /** A `host`/`port`/`token` link from before protocol 2: the daemon must be updated. */
  | { ok: false; reason: 'legacy' | 'invalid' }

/** `host:port` with a port, IPv6 in brackets; no scheme, path or spaces. */
export function isAddress(value: string): boolean {
  const match = /^(\[[0-9a-fA-F:.]+\]|[A-Za-z0-9.-]+):(\d{1,5})$/.exec(value)
  if (!match) return false
  const port = Number(match[2])
  return port >= 1 && port <= 65535
}

function isRelayUrl(value: string): boolean {
  return /^wss?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[^\s]*)?$/.test(value)
}

/** Reads a pairing code from its query parameters (a deep link's params or a parsed URL). */
export function pairingCodeFromParams(
  get: (name: string) => string | null,
  getAll: (name: string) => string[],
): ParsedPairingCode {
  if (get('token') && get('host')) return { ok: false, reason: 'legacy' }
  if (get('v') !== String(PAIRING_CODE_VERSION)) return { ok: false, reason: 'invalid' }
  const daemonId = get('id') ?? ''
  const daemonKey = base64UrlToBytes(get('k') ?? '')
  const secret = base64UrlToBytes(get('s') ?? '')
  const addresses = getAll('a').filter(isAddress).slice(0, MAX_ADDRESSES)
  const relay = get('r') ?? undefined
  const name = (get('n') ?? '').trim().slice(0, 64)
  if (
    !DAEMON_ID.test(daemonId) ||
    daemonKey?.length !== 32 ||
    secret?.length !== PAIRING_SECRET_LENGTH ||
    (relay !== undefined && !isRelayUrl(relay)) ||
    (addresses.length === 0 && !relay)
  )
    return { ok: false, reason: 'invalid' }
  return { ok: true, code: { daemonId, daemonKey, secret, addresses, ...(relay ? { relay } : {}), name } }
}

/** A connection relay's device endpoint for a daemon (`wss://relay/v1/device/<daemon ID>`). */
export function relayDeviceUrl(relayUrl: string, daemonId: string): string {
  return `${relayUrl.replace(/\/+$/, '')}/v1/device/${daemonId}`
}

/** Parses `remoteharness://pair?…` (or the same link with the `claude-remote://` scheme). */
export function parsePairingCode(raw: string): ParsedPairingCode {
  const match = /^(?:remoteharness|claude-remote):\/\/pair\/?\?(.*)$/i.exec(raw.trim())
  if (!match?.[1]) return { ok: false, reason: 'invalid' }
  const params = parseQuery(match[1])
  return pairingCodeFromParams(
    (name) => params.get(name)?.[0] ?? null,
    (name) => params.get(name) ?? [],
  )
}
