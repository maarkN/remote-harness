import { networkInterfaces } from 'node:os'
import type { DaemonPaths } from '@remote-harness/protocol'
import type { DaemonIdentity } from '../../core/identity.ts'
import type { Logger } from '../../core/logger.ts'
import { pairingAddress } from '../../core/pairing.ts'
import type { ClientHub } from '../../transport/connection.ts'
import { RelayConnection } from '../../transport/relay-client.ts'
import type { Link } from '../../transport/secure-connection.ts'
import { directAddresses } from './addresses.ts'
import { measureRelays } from './measure.ts'
import { relayDaemonUrl } from './relays.ts'
import { HomeRelay, type HomeRelayOptions } from './service.ts'

/** Where the direct path listens: `forced` when `--dev` or `--host` chose the one address to offer. */
export type DirectEndpoint = { host: string; port: number; forced: boolean }

export type ConnectivityFeature = {
  paths(): DaemonPaths
  addresses(): string[]
  relay(): string | null
  /** Set once the direct WebSocket listens (never with `direct: off`). */
  setDirect(endpoint: DirectEndpoint): void
  /** Opens the room on the home relay (once the connection handling is ready). */
  start(): void
  stop(): Promise<void>
}

export type ConnectivityOptions = {
  relays: readonly string[]
  /** Off with `relay: off`, and in `--dev` runs. */
  relayEnabled: boolean
  identity: DaemonIdentity
  hub: ClientHub
  logger: Logger
  /** A device channel opened on the relay path. */
  onLink: (link: Link) => void
  /** Overrides for tests. */
  interfaces?: () => ReturnType<typeof networkInterfaces>
  measure?: HomeRelayOptions['measure']
  connect?: HomeRelayOptions['connect']
  refreshMs?: number
}

/** The two paths' state: direct addresses, the home relay, and `daemon.paths` when they change. */
export function registerConnectivityFeature(o: ConnectivityOptions): ConnectivityFeature {
  const interfaces = o.interfaces ?? networkInterfaces
  let direct: DirectEndpoint | null = null
  const addresses = () => {
    if (!direct) return []
    return direct.forced
      ? [pairingAddress(direct.host, direct.port)]
      : directAddresses(interfaces(), direct.port)
  }
  const home = o.relayEnabled
    ? new HomeRelay({
        relays: o.relays,
        logger: o.logger,
        measure: o.measure ?? ((urls) => measureRelays(urls)),
        connect:
          o.connect ??
          ((url) =>
            new RelayConnection({
              url: relayDaemonUrl(url),
              identity: o.identity,
              onLink: o.onLink,
              logger: o.logger,
            })),
      })
    : null
  const paths = (): DaemonPaths => ({
    addresses: addresses(),
    relay: home?.current ?? null,
    relays: home ? [...o.relays] : [],
  })

  let announced = JSON.stringify(paths())
  const announce = () => {
    const next = paths()
    const text = JSON.stringify(next)
    if (text === announced) return
    announced = text
    o.hub.broadcast({ type: 'daemon.paths', ...next })
  }
  home?.onChange(announce)
  // Interfaces come and go (Wi-Fi, VPN): the advertised addresses follow.
  const refresh = setInterval(announce, o.refreshMs ?? 30_000)
  refresh.unref()

  return {
    paths,
    addresses,
    relay: () => home?.current ?? null,
    setDirect(endpoint) {
      direct = endpoint
      announce()
    },
    start: () => home?.start(),
    async stop() {
      clearInterval(refresh)
      await home?.stop()
    },
  }
}
