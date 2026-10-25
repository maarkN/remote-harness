import {
  type ChannelSession,
  type ClientMessage,
  DeviceHandshake,
  type DeviceInfo,
  type KeyPair,
  PROTOCOL_VERSION,
  parsePairingCode,
  type ServerMessage,
} from '@remote-harness/protocol'
import WebSocket from 'ws'
import { noiseCrypto } from '../src/core/identity.ts'
import type { RunningDaemon } from '../src/main.ts'

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> & { id?: string } : never

/** A test device speaking the Noise channel to a daemon on the direct path. */
export type NoiseClient = {
  ws: WebSocket
  deviceKey: KeyPair
  /** Resolves once the handshake finished (rejects if the socket closes first). */
  ready: Promise<void>
  /** Close code of the socket. */
  closed: Promise<number>
  send(message: WithoutId<ClientMessage>): void
  next(): Promise<ServerMessage>
  /** Reads until a message of that type arrives. */
  until<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>>
  close(): void
}

/** Opens a socket and runs the handshake; messages are decrypted into a queue. */
export function noiseConnect(port: number, handshake: DeviceHandshake, deviceKey: KeyPair): NoiseClient {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`)
  const queue: ServerMessage[] = []
  const waiters: Array<(message: ServerMessage) => void> = []
  let session: ChannelSession | null = null
  let markReady: () => void = () => undefined
  let failReady: (error: Error) => void = () => undefined
  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve
    failReady = reject
  })
  ready.catch(() => undefined)
  const closed = new Promise<number>((resolve) =>
    ws.on('close', (code) => {
      failReady(new Error(`closed ${code}`))
      resolve(code)
    }),
  )
  ws.on('open', () => ws.send(handshake.start()))
  ws.on('message', (data: Buffer) => {
    const bytes = new Uint8Array(data)
    if (!session) {
      const step = handshake.receive(bytes)
      if (step.send) ws.send(step.send)
      if (step.session) {
        session = step.session
        markReady()
      }
      return
    }
    const text = session.openText(bytes)
    if (text === null) return
    const message = JSON.parse(text) as ServerMessage
    const waiter = waiters.shift()
    if (waiter) waiter(message)
    else queue.push(message)
  })
  let seq = 0
  const next = () => {
    const queued = queue.shift()
    return queued ? Promise.resolve(queued) : new Promise<ServerMessage>((resolve) => waiters.push(resolve))
  }
  return {
    ws,
    deviceKey,
    ready,
    closed,
    send(message) {
      if (!session) throw new Error('handshake not finished')
      seq += 1
      for (const frame of session.sealText(JSON.stringify({ id: `t${seq}`, ...message }))) ws.send(frame)
    },
    next,
    async until(type) {
      for (;;) {
        const message = await next()
        if (message.type === type) return message as never
      }
    },
    close: () => ws.close(),
  }
}

/** Pairs a new device with a fresh code from the daemon (XXpsk3), without sending `auth`. */
export function pairConnect(
  daemon: RunningDaemon,
  options: { deviceKey?: KeyPair; info?: DeviceInfo; url?: string } = {},
): NoiseClient {
  const url = options.url ?? daemon.pairing.create()?.url
  const parsed = url ? parsePairingCode(url) : null
  if (!parsed?.ok) throw new Error('no pairing code')
  const deviceKey = options.deviceKey ?? noiseCrypto.generateKeyPair()
  const handshake = DeviceHandshake.pair(noiseCrypto, {
    deviceKey,
    daemonKey: parsed.code.daemonKey,
    secret: parsed.code.secret,
    info: options.info ?? { name: 'Test phone', platform: 'ios' },
  })
  return noiseConnect(daemon.wsPort, handshake, deviceKey)
}

/** Reconnects a paired device (IK), without sending `auth`. */
export function reconnectConnect(daemon: RunningDaemon, deviceKey: KeyPair): NoiseClient {
  const handshake = DeviceHandshake.reconnect(noiseCrypto, {
    deviceKey,
    daemonKey: daemon.identity.noise.publicKey,
  })
  return noiseConnect(daemon.wsPort, handshake, deviceKey)
}

/** Pairs a device, sends `auth` and waits for `auth.ok`: the usual start of an integration test. */
export async function authedClient(daemon: RunningDaemon): Promise<NoiseClient> {
  const client = pairConnect(daemon)
  await client.ready
  client.send({ type: 'auth', id: 'auth', protocolVersion: PROTOCOL_VERSION })
  await client.until('auth.ok')
  return client
}
