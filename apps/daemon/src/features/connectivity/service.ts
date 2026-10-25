import type { Logger } from '../../core/logger.ts'
import {
  FAILOVER_AFTER,
  failoverRelay,
  pickHomeRelay,
  type RelayMeasurement,
  reconnectDelay,
} from './relays.ts'

/** One open room on a relay (a `RelayConnection` in production, a fake in tests). */
export type RelaySession = { ready: Promise<void>; closed: Promise<number>; close(): void }

export type HomeRelayOptions = {
  relays: readonly string[]
  measure: (urls: readonly string[]) => Promise<RelayMeasurement[]>
  connect: (relayUrl: string) => RelaySession
  logger: Logger
  /** Waits between attempts (injected so tests run fast). */
  sleep?: (ms: number) => Promise<void>
}

/**
 * Keeps the daemon's room open on its home relay: the fastest relay at start, kept while it works
 * (reconnecting with backoff) and changed only after `FAILOVER_AFTER` failed reconnects in a row.
 */
export class HomeRelay {
  private home: string | null = null
  /** The relay being tried (the home relay once its room opens). */
  private target: string | null = null
  private session: RelaySession | null = null
  private stopped = false
  private readonly listeners = new Set<(home: string | null) => void>()
  private readonly sleep: (ms: number) => Promise<void>
  private running: Promise<void> | null = null

  constructor(private readonly o: HomeRelayOptions) {
    this.sleep = o.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  /** The relay devices should find this daemon on (kept while reconnecting to it). */
  get current(): string | null {
    return this.home
  }

  onChange(fn: (home: string | null) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  start(): void {
    this.running ??= this.loop().catch((error: unknown) =>
      this.o.logger.error({ err: error }, 'home relay loop failed'),
    )
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.session?.close()
    await this.running
  }

  private setHome(url: string | null): void {
    if (url === this.home) return
    this.home = url
    this.o.logger.info({ relay: url }, 'home relay')
    for (const fn of this.listeners) fn(url)
  }

  private async loop(): Promise<void> {
    let measureAttempt = 0
    while (!this.stopped) {
      const measured = await this.o.measure(this.o.relays)
      if (this.stopped) return
      const failed = this.target
      const next = failed ? failoverRelay(measured, failed) : pickHomeRelay(measured)
      if (!next) {
        this.o.logger.warn('no connection relay answers')
        await this.sleep(reconnectDelay(measureAttempt++))
        continue
      }
      measureAttempt = 0
      this.target = next
      await this.stay(next)
    }
  }

  /** Stays on one relay until it fails `FAILOVER_AFTER` times in a row (or the daemon stops). */
  private async stay(url: string): Promise<void> {
    let failures = 0
    while (!this.stopped && failures < FAILOVER_AFTER) {
      const session = this.o.connect(url)
      this.session = session
      try {
        await session.ready
        failures = 0
        // Announced once the room is open there, so devices never look for us on a relay we are not on.
        this.setHome(url)
        this.o.logger.info({ relay: url }, 'room open on the relay')
        const code = await session.closed
        if (this.stopped) return
        this.o.logger.info({ relay: url, code }, 'relay connection closed')
        // A restart (1012) or a dropped socket: back soon, same relay.
        await this.sleep(reconnectDelay(0))
      } catch (error) {
        failures += 1
        this.o.logger.warn({ relay: url, failures, err: error }, 'relay connection failed')
        if (failures < FAILOVER_AFTER) await this.sleep(reconnectDelay(failures - 1))
      } finally {
        this.session = null
      }
    }
  }
}
