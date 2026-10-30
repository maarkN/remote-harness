import { randomUUID } from 'node:crypto'
import {
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
import type { ClientHub, Connection } from './connection.ts'
import type { MessageRouter } from './router.ts'

export const AUTH_TIMEOUT_MS = 5_000

/**
 * One device's byte pipe to the daemon: a WebSocket on the direct path, a relay channel on the
 * relay path. Every message is binary except what an old app may send as text.
 */
export interface Link {
  send(data: Uint8Array): void
  close(code: number, reason: string): void
  onMessage(fn: (data: Uint8Array, isBinary: boolean) => void): void
  onClose(fn: () => void): void
}

export type PairingResult = { ok: true } | { ok: false; code: number; reason: string }

export type SecureConnectionDeps = {
  staticKey: KeyPair
  hooks: DaemonHandshakeHooks & {
    /** A pairing handshake succeeded: use the code up and record the device. */
    paired(pairingId: Uint8Array, deviceKey: Uint8Array, device: DeviceInfo): Promise<PairingResult>
    /** A device authenticated (its last-seen time). */
    seen?(deviceKey: Uint8Array): void
  }
  router: MessageRouter
  hub: ClientHub
  logger: Logger
  /** Builds the `auth.ok` payload sent after a successful handshake. */
  hello: () => Omit<ServerMessageOf<'auth.ok'>, 'type' | 'replyTo'>
  authTimeoutMs?: number
  onAuthenticated?: (connection: Connection) => void
}

class SecureConnection implements Connection {
  readonly id = randomUUID()
  foreground = false
  deviceId: string | undefined
  session: ChannelSession | null = null
  private readonly closeHandlers: Array<() => void> = []
  private closed = false

  constructor(private readonly link: Link) {
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
  meta: { remote?: string; path?: 'direct' | 'relay' } = {},
): Connection {
  const connection = new SecureConnection(link)
  const log = deps.logger.child({ conn: connection.id.slice(0, 8), ...meta })
  const handshake = new DaemonHandshake(noiseCrypto, deps.staticKey, deps.hooks)
  let stage: 'first' | 'finish' | 'auth' | 'open' | 'closed' = 'first'
  // Messages are handled one at a time: recording a pairing is async.
  let queue = Promise.resolve()

  const refuse = (code: number, reason: string) => {
    if (stage === 'closed') return
    stage = 'closed'
    log.warn({ code, reason }, 'connection refused')
    link.close(code, reason)
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
    if (step.kind !== 'send') return refuse(CHANNEL_CLOSE.unauthorized, 'unexpected handshake')
    link.send(step.send)
    if (step.session) {
      connection.session = step.session
      connection.deviceId = deviceIdOf(step.session.remoteStatic)
      stage = 'auth'
    } else {
      stage = 'finish'
    }
  }

  const handleFinish = async (data: Uint8Array) => {
    const step = handshake.finish(data)
    if (step.kind === 'refused') return refuse(step.code, step.reason)
    if (step.kind !== 'paired') return refuse(CHANNEL_CLOSE.unauthorized, 'unexpected handshake')
    const result = await deps.hooks.paired(step.pairingId, step.session.remoteStatic, step.device)
    if (!result.ok) return refuse(result.code, result.reason)
    log.info({ platform: step.device.platform }, 'device paired')
    connection.session = step.session
    connection.deviceId = deviceIdOf(step.session.remoteStatic)
    stage = 'auth'
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
      clearTimeout(timer)
      deps.hooks.seen?.(session.remoteStatic)
      deps.hub.add(connection)
      connection.send({ type: 'auth.ok', replyTo: message.id, ...deps.hello() })
      deps.onAuthenticated?.(connection)
      log.info('client authenticated')
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
