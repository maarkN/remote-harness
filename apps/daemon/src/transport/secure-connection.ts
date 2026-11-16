import { randomUUID } from 'node:crypto'
import {
  type AppBuild,
  CHANNEL_CLOSE,
  type ChannelSession,
  DaemonHandshake,
  type DaemonHandshakeHooks,
  type DeviceInfo,
  type KeyPair,
  NoiseError,
  PROTOCOL_VERSION,
  parseClientMessage,
  type ServerMessage,
  type ServerMessageOf,
} from '@remote-harness/protocol'
import { deviceIdOf, noiseCrypto } from '../core/identity.ts'
import type { Logger } from '../core/logger.ts'
import type { ClientHub, Connection, ConnectionPath } from './connection.ts'
import type { MessageRouter } from './router.ts'

export const AUTH_TIMEOUT_MS = 5_000

/** How a link ended; `byDaemon` when the daemon ended it below the connection (a dead socket). */
export type LinkClose = { code: number; reason: string; byDaemon?: boolean }

/**
 * One device's byte pipe to the daemon: a WebSocket on the direct path, a relay channel on the
 * relay path. Every message is binary except what an old app may send as text.
 */
export interface Link {
  send(data: Uint8Array): void
  close(code: number, reason: string): void
  onMessage(fn: (data: Uint8Array, isBinary: boolean) => void): void
  /** The link ended: its close code and reason (as the WebSocket or the relay's CLOSE frame gave them). */
  onClose(fn: (close: LinkClose) => void): void
}

export type PairingResult = { ok: true } | { ok: false; code: number; reason: string }

export type SecureConnectionDeps = {
  staticKey: KeyPair
  hooks: DaemonHandshakeHooks & {
    /** A pairing handshake succeeded: use the code up and record the device. */
    paired(pairingId: Uint8Array, deviceKey: Uint8Array, device: DeviceInfo): Promise<PairingResult>
    /** A device authenticated (its last-seen time and the app build it sent, if any). */
    seen?(deviceKey: Uint8Array, app: AppBuild | undefined): void
    /** A device presented a live code (ADR-0009): show its confirmation code. */
    presented?(pairingId: Uint8Array): string | null
    /** A pairing used another confirmation code; `locked` when that burned the pairing code. */
    wrongConfirmation?(pairingId: Uint8Array): 'retry' | 'locked'
  }
  router: MessageRouter
  hub: ClientHub
  logger: Logger
  /** Builds the `auth.ok` payload sent after a successful handshake. */
  hello: () => Omit<ServerMessageOf<'auth.ok'>, 'type' | 'replyTo'>
  authTimeoutMs?: number
  onAuthenticated?: (connection: Connection) => void
  /** The clock for how long a connection stayed open (tests). */
  now?: () => number
}

class SecureConnection implements Connection {
  readonly id = randomUUID()
  foreground = false
  deviceId: string | undefined
  session: ChannelSession | null = null
  /** The code and reason the daemon closed the connection with, when it did. */
  closing: { code: number; reason: string } | null = null
  private readonly closeHandlers: Array<() => void> = []
  private closed = false

  constructor(
    private readonly link: Link,
    readonly path?: ConnectionPath,
  ) {
    link.onClose(() => {
      this.closed = true
      for (const fn of this.closeHandlers.splice(0)) fn()
    })
  }

  send(message: ServerMessage): void {
    if (this.closed || !this.session) return
    for (const frame of this.session.sealText(JSON.stringify(message))) this.link.send(frame)
  }

  onClose(fn: () => void): void {
    this.closeHandlers.push(fn)
  }

  close(code = 1000, reason = ''): void {
    this.closing ??= { code, reason }
    this.link.close(code, reason)
  }
}

/**
 * Runs the Noise handshake on a link, then the JSON protocol inside the channel: nothing is sent
 * before the device's `auth` decrypts, and any failure closes the link.
 */
export function acceptSecureConnection(
  link: Link,
  deps: SecureConnectionDeps,
  meta: { remote?: string; path?: ConnectionPath } = {},
): Connection {
  const connection = new SecureConnection(link, meta.path)
  const log = deps.logger.child({ conn: connection.id.slice(0, 8), ...meta })
  const handshake = new DaemonHandshake(noiseCrypto, deps.staticKey, deps.hooks)
  const now = deps.now ?? Date.now
  let stage: 'first' | 'finish' | 'auth' | 'open' | 'closed' = 'first'
  /** How far the connection got, kept after it closes for the close line. */
  let reached: 'handshake' | 'auth' | 'open' = 'handshake'
  let authenticatedAt = 0
  // Messages are handled one at a time: recording a pairing is async.
  let queue = Promise.resolve()

  // One line per connection that ends, so the log shows how long each phone stayed (#590).
  link.onClose((close) => {
    const byDaemon = connection.closing !== null || close.byDaemon === true
    const { code, reason } = connection.closing ?? close
    log.info(
      {
        ...(connection.deviceId ? { device: connection.deviceId } : {}),
        code,
        reason,
        by: byDaemon ? 'daemon' : 'device',
        ...(reached === 'open' ? { openMs: now() - authenticatedAt } : { closedDuring: reached }),
      },
      'connection closed',
    )
  })

  const refuse = (code: number, reason: string) => {
    if (stage === 'closed') return
    stage = 'closed'
    log.warn({ code, reason }, 'connection refused')
    connection.close(code, reason)
  }

  const timer = setTimeout(() => {
    if (stage !== 'open') refuse(CHANNEL_CLOSE.handshakeTimeout, 'handshake timeout')
  }, deps.authTimeoutMs ?? AUTH_TIMEOUT_MS)
  connection.onClose(() => {
    clearTimeout(timer)
    stage = 'closed'
  })

  const handleFirst = (data: Uint8Array) => {
    const step = handshake.start(data)
    if (step.kind === 'refused') return refuse(step.code, step.reason)
    if (step.kind === 'announce') {
      // Not a refusal: the computer now shows the confirmation code, which the phone asks for.
      deps.hooks.presented?.(step.pairingId)
      stage = 'closed'
      log.info('pairing code presented')
      connection.close(CHANNEL_CLOSE.confirmationShown, 'enter the code shown on the computer')
      return
    }
    if (step.kind !== 'send') return refuse(CHANNEL_CLOSE.unauthorized, 'unexpected handshake')
    link.send(step.send)
    if (step.session) {
      connection.session = step.session
      connection.deviceId = deviceIdOf(step.session.remoteStatic)
      stage = 'auth'
      reached = 'auth'
    } else {
      stage = 'finish'
    }
  }

  const handleFinish = async (data: Uint8Array) => {
    const step = handshake.finish(data)
    if (step.kind === 'refused') return refuse(step.code, step.reason)
    if (step.kind === 'wrong-confirmation') {
      const outcome = deps.hooks.wrongConfirmation?.(step.pairingId) ?? 'retry'
      return outcome === 'locked'
        ? refuse(CHANNEL_CLOSE.confirmationLocked, 'too many wrong confirmation codes')
        : refuse(CHANNEL_CLOSE.wrongConfirmation, 'wrong confirmation code')
    }
    if (step.kind !== 'paired') return refuse(CHANNEL_CLOSE.unauthorized, 'unexpected handshake')
    const result = await deps.hooks.paired(step.pairingId, step.session.remoteStatic, step.device)
    if (!result.ok) return refuse(result.code, result.reason)
    log.info({ platform: step.device.platform }, 'device paired')
    connection.session = step.session
    connection.deviceId = deviceIdOf(step.session.remoteStatic)
    stage = 'auth'
    reached = 'auth'
  }

  const handleFrame = (data: Uint8Array) => {
    const session = connection.session
    if (!session) return refuse(CHANNEL_CLOSE.unauthorized, 'no session')
    let text: string | null
    try {
      text = session.openText(data)
    } catch (error) {
      const tooBig = error instanceof NoiseError && error.message === 'message too large'
      return refuse(tooBig ? CHANNEL_CLOSE.tooBig : CHANNEL_CLOSE.unauthorized, 'bad frame')
    }
    if (text === null) return
    const parsed = parseClientMessage(text)
    if (!parsed.ok) {
      connection.send({
        type: 'error',
        replyTo: parsed.error.id,
        code: parsed.error.code,
        message: parsed.error.message,
      })
      deps.router.reportRejected(parsed.error.type ?? '(malformed)', parsed.error.code)
      if (stage === 'auth') refuse(CHANNEL_CLOSE.unauthorized, 'unauthorized')
      return
    }
    const message = parsed.value
    if (stage === 'auth') {
      if (message.type !== 'auth') return refuse(CHANNEL_CLOSE.unauthorized, 'auth expected')
      if (Math.trunc(message.protocolVersion) !== PROTOCOL_VERSION) {
        connection.send({
          type: 'error',
          replyTo: message.id,
          code: 'protocol_mismatch',
          message: `daemon speaks protocol ${PROTOCOL_VERSION}`,
        })
        return refuse(CHANNEL_CLOSE.protocolMismatch, 'protocol mismatch')
      }
      stage = 'open'
      reached = 'open'
      authenticatedAt = now()
      clearTimeout(timer)
      deps.hooks.seen?.(session.remoteStatic, message.app)
      deps.hub.add(connection)
      connection.send({ type: 'auth.ok', replyTo: message.id, ...deps.hello() })
      deps.onAuthenticated?.(connection)
      // Which build connects, for "which app was it?" from the computer (#591).
      log.info(message.app ? { app: message.app } : {}, 'client authenticated')
      return
    }
    if (message.type === 'auth') {
      connection.send({ type: 'auth.ok', replyTo: message.id, ...deps.hello() })
      return
    }
    void deps.router.dispatch(message, connection)
  }

  link.onMessage((data, isBinary) => {
    queue = queue.then(async () => {
      if (stage === 'closed') return
      // An app speaking protocol 1 sends its JSON `auth` as text.
      if (!isBinary) return refuse(CHANNEL_CLOSE.protocolMismatch, 'protocol mismatch')
      if (stage === 'first') return handleFirst(data)
      if (stage === 'finish') return handleFinish(data)
      return handleFrame(data)
    })
    queue = queue.catch((error: unknown) => {
      log.error({ err: error }, 'connection handler failed')
      refuse(CHANNEL_CLOSE.unauthorized, 'internal error')
    })
  })
  return connection
}
