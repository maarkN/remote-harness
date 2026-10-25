import { formatPairingCode } from '@remote-harness/protocol'
import type { DaemonIdentity } from './identity.ts'

/** `host:port` as the tray and the pairing code show it; IPv6 hosts in brackets. */
export function pairingAddress(host: string, port: number): string {
  return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`
}

/** The link the app scans to pair (`remote-harness pair`, the setup and the tray's QR). */
export function pairingLink(o: {
  identity: DaemonIdentity
  secret: Uint8Array
  addresses: string[]
  name: string
  relay?: string
}): string {
  return formatPairingCode({
    daemonId: o.identity.daemonId,
    daemonKey: o.identity.noise.publicKey,
    secret: o.secret,
    addresses: o.addresses,
    name: o.name,
    ...(o.relay ? { relay: o.relay } : {}),
  })
}
