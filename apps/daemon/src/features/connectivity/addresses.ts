import type { NetworkInterfaceInfo } from 'node:os'
import { pairingAddress } from '../../core/pairing.ts'

/** At most this many direct addresses go into `paths` and pairing codes. */
export const MAX_DIRECT_ADDRESSES = 8

function linkLocal(info: NetworkInterfaceInfo): boolean {
  if (info.family === 'IPv4') return info.address.startsWith('169.254.')
  return /^fe[89ab]/i.test(info.address)
}

/**
 * Container and virtual machine bridges (Docker, Podman, LXD, libvirt, Kubernetes CNIs): their
 * addresses only exist inside the computer, so a phone would wait on them for nothing.
 */
const BRIDGE_INTERFACE = /^(docker|br-|veth|virbr|cni|flannel|cali|vxlan|podman|lxdbr|lxcbr)/

/**
 * The `host:port` addresses devices may try on the direct path: every non-loopback, non-link-local
 * interface address outside container bridges, IPv4 first, without duplicates.
 */
export function directAddresses(
  interfaces: Record<string, NetworkInterfaceInfo[] | undefined>,
  port: number,
): string[] {
  const v4: string[] = []
  const v6: string[] = []
  for (const [name, infos] of Object.entries(interfaces)) {
    if (BRIDGE_INTERFACE.test(name)) continue
    for (const info of infos ?? []) {
      if (info.internal || linkLocal(info)) continue
      const address = pairingAddress(info.address, port)
      const list = info.family === 'IPv4' ? v4 : v6
      if (!list.includes(address)) list.push(address)
    }
  }
  return [...v4, ...v6].slice(0, MAX_DIRECT_ADDRESSES)
}
