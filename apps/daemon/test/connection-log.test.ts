import {
  CHANNEL_CLOSE,
  type ChannelSession,
  DeviceHandshake,
  PROTOCOL_VERSION,
  utf8Encode,
} from '@remote-harness/protocol'
import pino from 'pino'
import { afterEach, describe, expect, test } from 'vitest'
import { type WebSocket, WebSocketServer } from 'ws'
import { generateIdentity, noiseCrypto } from '../src/core/identity.ts'
import type { Logger } from '../src/core/logger.ts'
import { ClientHub } from '../src/transport/connection.ts'
import { RELAY_LOST_REASON, RelayConnection } from '../src/transport/relay-client.ts'
import { MessageRouter } from '../src/transport/router.ts'
import { acceptSecureConnection, type Link, type LinkClose } from '../src/transport/secure-connection.ts'
import { DEAD_CONNECTION_REASON, startWsServer } from '../src/transport/ws-server.ts'
import { noiseConnect } from './noise-client.ts'

type Line = Record<string, unknown> & { msg: string }

/** A pino logger whose lines (with the child bindings) land in an array. */
function capturingLogger(): { logger: Logger; lines: Line[]; closed: () => Line[] } {
  const lines: Line[] = []
  const logger = pino({ level: 'info' }, { write: (text: string) => lines.push(JSON.parse(text)) })
  return { logger, lines, closed: () => lines.filter((l) => l.msg === 'connection closed') }
}

/** The daemon's end of an in-memory link; the test plays the device. */
class MemoryLink implements Link {
  readonly toDevice: Uint8Array[] = []
  private readonly messages: Array<(data: Uint8Array, isBinary: boolean) => void> = []
  private readonly closes: Array<(close: LinkClose) => void> = []
  closedWith: { code: number; reason: string } | null = null
  send(data: Uint8Array): void {
    this.toDevice.push(data)
  }
  close(code: number, reason: string): void {
    this.end(code, reason)
  }
  onMessage(fn: (data: Uint8Array, isBinary: boolean) => void): void {
    this.messages.push(fn)
  }
  onClose(fn: (close: LinkClose) => void): void {
    this.closes.push(fn)
  }
  /** The device sends one binary message. */
  deliver(data: Uint8Array): void {
    for (const fn of this.messages) fn(data, true)
  }
  /** The link ends (the device closed it, or the daemon did through `close`). */
  end(code: number, reason: string): void {
    if (this.closedWith) return
    this.closedWith = { code, reason }
    for (const fn of this.closes.splice(0)) fn({ code, reason })
  }
}

const daemonKey = noiseCrypto.generateKeyPair()
const deviceKey = noiseCrypto.generateKeyPair()
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function accept(clock: { now: number }) {
  const { logger, closed } = capturingLogger()
  const link = new MemoryLink()
  acceptSecureConnection(
    link,
    {
      staticKey: daemonKey,
      hooks: {
        pairingSecret: () => null,
        isPaired: () => true,
        paired: async () => ({ ok: true }),
      },
      router: new MessageRouter(logger),
      hub: new ClientHub(),
      logger,
      hello: () => ({ protocolVersion: PROTOCOL_VERSION }) as never,
      now: () => clock.now,
    },
    { path: 'direct', remote: '192.0.2.7' },
  )
  return { link, closed }
}

/** Runs IK and `auth` from the device side; resolves once `auth.ok` was sent. */
async function authenticate(link: MemoryLink): Promise<ChannelSession> {
  const handshake = DeviceHandshake.reconnect(noiseCrypto, { deviceKey, daemonKey: daemonKey.publicKey })
  link.deliver(handshake.start())
  await settle()
  const step = handshake.receive(link.toDevice.shift() as Uint8Array)
  const session = step.session as ChannelSession
  for (const frame of session.sealText(
    JSON.stringify({ type: 'auth', id: 'a1', protocolVersion: PROTOCOL_VERSION }),
  ))
    link.deliver(frame)
  await settle()
  return session
}

describe('connection closed log line (#590)', () => {
  test('an authenticated connection the device closes: code, reason, who and how long it was open', async () => {
    const clock = { now: 1_000 }
    const { link, closed } = accept(clock)
    await authenticate(link)
    clock.now += 3_600_000
    link.end(1000, 'bye')
    expect(closed()).toEqual([
      expect.objectContaining({
        level: 30,
        conn: expect.any(String),
        path: 'direct',
        device: expect.any(String),
        code: 1000,
        reason: 'bye',
        by: 'device',
        openMs: 3_600_000,
      }),
    ])
    expect(closed()[0]).not.toHaveProperty('closedDuring')
  })

  test('a connection closed mid-handshake says so and has no open time', async () => {
    const clock = { now: 0 }
    const { link, closed } = accept(clock)
    link.deliver(
      DeviceHandshake.reconnect(noiseCrypto, { deviceKey, daemonKey: daemonKey.publicKey }).start(),
    )
    await settle()
    link.end(1006, '')
    expect(closed()).toEqual([
      expect.objectContaining({ code: 1006, by: 'device', closedDuring: 'auth', device: expect.any(String) }),
    ])
    const early = accept(clock)
    early.link.end(1001, 'going away')
    expect(early.closed()).toEqual([expect.objectContaining({ code: 1001, closedDuring: 'handshake' })])
    expect(early.closed()[0]).not.toHaveProperty('openMs')
  })

  test('a connection the daemon refuses or closes is logged with its code and reason, once', async () => {
    const clock = { now: 0 }
    const { link, closed } = accept(clock)
    link.deliver(utf8Encode('not a preface at all'))
    await settle()
    expect(link.closedWith?.code).toBe(CHANNEL_CLOSE.protocolMismatch)
    expect(closed()).toEqual([
      expect.objectContaining({
        code: CHANNEL_CLOSE.protocolMismatch,
        by: 'daemon',
        closedDuring: 'handshake',
      }),
    ])
  })
})

describe('dead connections on the direct path (#590)', () => {
  test('a phone that stops answering pings after `auth.ok` is terminated and logged as dead', async () => {
    const { logger, closed } = capturingLogger()
    const wss = await startWsServer({
      host: '127.0.0.1',
      port: 0,
      heartbeatMs: 40,
      staticKey: daemonKey,
      hooks: { pairingSecret: () => null, isPaired: () => true, paired: async () => ({ ok: true }) },
      router: new MessageRouter(logger),
      hub: new ClientHub(),
      logger,
      hello: () => ({ protocolVersion: PROTOCOL_VERSION }) as never,
    })
    const address = wss.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const handshake = DeviceHandshake.reconnect(noiseCrypto, { deviceKey, daemonKey: daemonKey.publicKey })
    const client = noiseConnect(port, handshake, deviceKey, { autoPong: false })
    // Pongs by hand until `auth.ok`, then none: on a slow runner a 40 ms ping could otherwise
    // drop the socket before `auth.ok`, and the test would wait for it forever.
    let authenticated = false
    client.ws.on('ping', () => {
      if (!authenticated) client.ws.pong()
    })
    await client.ready
    client.send({ type: 'auth', protocolVersion: PROTOCOL_VERSION })
    expect(await client.next()).toMatchObject({ type: 'auth.ok' })
    authenticated = true
    expect(await client.closed).toBe(1006)
    await settle()
    expect(closed()).toEqual([
      expect.objectContaining({
        path: 'direct',
        code: 1006,
        reason: DEAD_CONNECTION_REASON,
        by: 'daemon',
        openMs: expect.any(Number),
      }),
    ])
    await new Promise<void>((resolve) => wss.close(() => resolve()))
  })
})

describe('relay CLOSE frames reach the link (#590)', () => {
  let server: WebSocketServer | undefined
  afterEach(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
    server = undefined
  })

  /** A relay that opens the room, then channel 7, and hands the test its socket. */
  async function fakeRelay(): Promise<{ url: string; socket: Promise<WebSocket> }> {
    server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
    await new Promise<void>((resolve) => server?.once('listening', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const socket = new Promise<WebSocket>((resolve) => {
      server?.once('connection', (ws) => {
        ws.send(Uint8Array.of(0x01, ...new Uint8Array(32)))
        ws.once('message', () => {
          ws.send(Uint8Array.of(0x03))
          ws.send(Uint8Array.of(0x10, 0, 0, 0, 7))
          resolve(ws)
        })
      })
    })
    return { url: `ws://127.0.0.1:${port}`, socket }
  }

  test('an idle channel closed by the relay arrives with 4010 and a reason', async () => {
    const relay = await fakeRelay()
    const links: Link[] = []
    const ended = new Promise<[number, string]>((resolve) => {
      const connection = new RelayConnection({
        url: relay.url,
        identity: generateIdentity(),
        logger: capturingLogger().logger,
        onLink: (link) => {
          links.push(link)
          link.onClose(({ code, reason }) => {
            resolve([code, reason])
            connection.close()
          })
        },
      })
    })
    const socket = await relay.socket
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(links).toHaveLength(1)
    socket.send(Uint8Array.of(0x12, 0, 0, 0, 7, 0x0f, 0xaa))
    expect(await ended).toEqual([4010, 'idle on the relay'])
  })

  test('a relay connection that ends closes its channels as lost', async () => {
    const relay = await fakeRelay()
    const ended = new Promise<[number, string]>((resolve) => {
      new RelayConnection({
        url: relay.url,
        identity: generateIdentity(),
        logger: capturingLogger().logger,
        onLink: (link) => link.onClose(({ code, reason }) => resolve([code, reason])),
      })
    })
    const socket = await relay.socket
    await new Promise((resolve) => setTimeout(resolve, 20))
    socket.close(1012, 'restart')
    expect(await ended).toEqual([1012, RELAY_LOST_REASON])
  })
})
