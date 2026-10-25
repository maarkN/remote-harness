import type { NetworkInterfaceInfo } from 'node:os'
import { pairingAddress } from '../../core/pairing.ts'

/** At most this many direct addresses go into `paths` and pairing codes. */
export const MAX_DIRECT_ADDRESSES = 8

function linkLocal(info: NetworkInterfaceInfo): boolean {
  if (info.family === 'IPv4') return info.address.startsWith('169.254.')
  return /^fe[89ab]/i.test(info.address)
}

/**
 * The `host:port` addresses devices may try on the direct path: every non-loopback, non-link-local
 * interface address, IPv4 first, without duplicates.
 */
export function directAddresses(
  interfaces: Record<string, NetworkInterfaceInfo[] | undefined>,
  port: number,
): string[] {
  const v4: string[] = []
  const v6: string[] = []
  for (const infos of Object.values(interfaces)) {
    for (const info of infos ?? []) {
      if (info.internal || linkLocal(info)) continue
      const address = pairingAddress(info.address, port)
      const list = info.family === 'IPv4' ? v4 : v6
      if (!list.includes(address)) list.push(address)
    }
  }
  return [...v4, ...v6].slice(0, MAX_DIRECT_ADDRESSES)
}
