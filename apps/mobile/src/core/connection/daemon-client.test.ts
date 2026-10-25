import * as nodeCrypto from 'node:crypto'
import {
  bytesToBase64Url,
  CHANNEL_CLOSE,
  type ChannelSession,
  createNoiseCrypto,
  DaemonHandshake,
  type NodeLikeCrypto,
  PROTOCOL_VERSION,
  pairingIdOf,
} from '@remote-harness/protocol'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  DaemonClient,
  DaemonRequestError,
  daemonUrl,
  type SocketLike,
  WRONG_DAEMON_CLOSE,
} from './daemon-client'

const crypto = createNoiseCrypto(nodeCrypto as unknown as NodeLikeCrypto)
const daemonKey = crypto.generateKeyPair()
const deviceKey = crypto.generateKeyPair()
const paired: Uint8Array[] = []
const codes = new Map<string, Uint8Array>()
const sameKey = (a: Uint8Array, b: Uint8Array) => bytesToBase64Url(a) === bytesToBase64Url(b)

/** A socket with a fake daemon behind it: it runs the Noise responder and decrypts what it gets. */
class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = []
  readyState = 0
  binaryType = ''
  sent: Record<string, unknown>[] = []
  mode: 'pair' | 'reconnect' | null = null
  refused: number | null = null
  private stage: 'first' | 'finish' | 'open' = 'first'
  private session: ChannelSession | null = null
  private readonly daemon = new DaemonHandshake(crypto, daemonKey, {
    pairingSecret: (id) => codes.get(bytesToBase64Url(id)) ?? null,
    isPaired: (key) => paired.some((k) => sameKey(k, key)),
  })
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  constructor(readonly url: string) {
    FakeSocket.instances.push(this)
  }
  send(data: ArrayBuffer) {
    const bytes = new Uint8Array(data)
    if (this.stage === 'first') {
      this.mode = bytes[3] === 1 ? 'pair' : 'reconnect'
      const step = this.daemon.start(bytes)
      if (step.kind === 'refused') {
        this.refused = step.code
        return
      }
      if (step.kind !== 'send') return
      if (step.session) {
        this.session = step.session
        this.stage = 'open'
      } else {
        this.stage = 'finish'
      }
      this.deliver(step.send)
      return
    }
    if (this.stage === 'finish') {
      const step = this.daemon.finish(bytes)
      if (step.kind !== 'paired') {
        this.refused = step.kind === 'refused' ? step.code : -1
        return
      }
      paired.push(step.session.remoteStatic)
      this.session = step.session
      this.stage = 'open'
      return
    }
    const text = this.session?.openText(bytes)
    if (text) this.sent.push(JSON.parse(text))
  }
  close() {
    this.readyState = 3
  }
  // test helpers
  open() {
    this.readyState = 1
    this.onopen?.({})
  }
  receive(message: unknown) {
    for (const frame of this.session?.sealText(JSON.stringify(message)) ?? []) this.deliver(frame)
  }
  drop(code = 1006) {
    this.readyState = 3
    this.onclose?.({ code })
  }
  last() {
    return this.sent.at(-1) as { id: string; type: string }
  }
  private deliver(bytes: Uint8Array) {
    this.onmessage?.({ data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) })
  }
}

const hello = {
  protocolVersion: PROTOCOL_VERSION,
  daemonVersion: '0.1.0',
  profiles: [],
  defaultRuleScope: 'project',
  muted: { profiles: [], sessions: [] },
}

function makeClient(extra: Partial<ConstructorParameters<typeof DaemonClient>[0]> = {}) {
  return new DaemonClient({
    computer: { addresses: ['100.64.0.2:7337'], daemonKey: daemonKey.publicKey, deviceKey },
    crypto,
    socketFactory: (url) => new FakeSocket(url),
    ...extra,
  })
}

function authenticate(socket: FakeSocket) {
  socket.open()
  const auth = socket.last()
  socket.receive({ type: 'auth.ok', replyTo: auth.id, ...hello })
}

beforeEach(() => {
  FakeSocket.instances = []
  paired.splice(0, paired.length, deviceKey.publicKey)
  codes.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('DaemonClient', () => {
  test('authenticates first and becomes ready', async () => {
    const client = makeClient()
    const ready = vi.fn()
    client.onReady(ready)
    client.connect()
    const socket = FakeSocket.instances[0]!
    expect(socket.url).toBe('ws://100.64.0.2:7337')
    socket.open()
    expect(socket.binaryType).toBe('arraybuffer')
    expect(socket.mode).toBe('reconnect')
    expect(socket.last()).toEqual({ type: 'auth', id: expect.any(String), protocolVersion: PROTOCOL_VERSION })
    expect(client.status).toBe('authenticating')
    socket.receive({ type: 'auth.ok', replyTo: socket.last().id, ...hello })
    await vi.runAllTicks()
    await Promise.resolve()
    expect(client.status).toBe('open')
    expect(ready).toHaveBeenCalledOnce()
  })

  test('correlates replies and rejects error replies', async () => {
    const client = makeClient()
    client.connect()
    const socket = FakeSocket.instances[0]!
    authenticate(socket)
    await Promise.resolve()
    const list = client.request({ type: 'sessions.list' })
    socket.receive({ type: 'sessions.snapshot', replyTo: socket.last().id, sessions: [] })
    await expect(list).resolves.toMatchObject({ type: 'sessions.snapshot' })
    const input = client.request({ type: 'session.input', sessionId: 's', text: 'oi' })
    socket.receive({ type: 'error', replyTo: socket.last().id, code: 'not_controllable', message: 'x' })
    await expect(input).rejects.toMatchObject({ code: 'not_controllable' })
  })

  test('times out requests', async () => {
    const client = makeClient({ requestTimeoutMs: 15_000 })
    client.connect()
    authenticate(FakeSocket.instances[0]!)
    await Promise.resolve()
    const pending = client.request({ type: 'ping' })
    vi.advanceTimersByTime(15_001)
    await expect(pending).rejects.toBeInstanceOf(DaemonRequestError)
  })

  test('reports error replies and timeouts with the request type, not lost connections', async () => {
    const client = makeClient({ requestTimeoutMs: 15_000 })
    const failures: Array<[string, string]> = []
    client.onRequestError((type, error) => failures.push([type, error.code]))
    client.connect()
    const socket = FakeSocket.instances[0]!
    authenticate(socket)
    await Promise.resolve()
    const start = client.request({ type: 'session.start', profileId: 'p', cwd: '/x' })
    socket.receive({ type: 'error', replyTo: socket.last().id, code: 'invalid_cwd', message: 'nope' })
    await expect(start).rejects.toMatchObject({ code: 'invalid_cwd' })
    const ping = client.request({ type: 'ping' })
    vi.advanceTimersByTime(15_001)
    await expect(ping).rejects.toMatchObject({ code: 'timeout' })
    const list = client.request({ type: 'sessions.list' })
    socket.drop()
    await expect(list).rejects.toMatchObject({ code: 'disconnected' })
    expect(failures).toEqual([
      ['session.start', 'invalid_cwd'],
      ['ping', 'timeout'],
    ])
  })

  test('reconnects with exponential backoff and resubscribes', async () => {
    const client = makeClient()
    const ready = vi.fn()
    client.onReady(ready)
    client.connect()
    authenticate(FakeSocket.instances[0]!)
    await Promise.resolve()
    FakeSocket.instances[0]!.drop()
    expect(client.status).toBe('reconnecting')
    vi.advanceTimersByTime(999)
    expect(FakeSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.instances).toHaveLength(2)
    FakeSocket.instances[1]!.drop()
    vi.advanceTimersByTime(1_999)
    expect(FakeSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    authenticate(FakeSocket.instances[2]!)
    await Promise.resolve()
    expect(ready).toHaveBeenCalledTimes(2)
  })

  test('caps the backoff at 30s and resumes immediately on demand', () => {
    const client = makeClient()
    client.connect()
    for (let i = 0; i < 8; i++) {
      FakeSocket.instances.at(-1)!.drop()
      vi.advanceTimersByTime(30_000)
    }
    const count = FakeSocket.instances.length
    FakeSocket.instances.at(-1)!.drop()
    client.resumeNow()
    expect(FakeSocket.instances.length).toBe(count + 1)
  })

  test('stops when the daemon does not know this device', () => {
    paired.splice(0)
    const client = makeClient()
    client.connect()
    const socket = FakeSocket.instances[0]!
    socket.open()
    expect(socket.refused).toBe(CHANNEL_CLOSE.unauthorized)
    expect(socket.sent).toEqual([])
    socket.drop(CHANNEL_CLOSE.unauthorized)
    expect(client.status).toBe('unauthorized')
    expect(client.closeCode).toBe(CHANNEL_CLOSE.unauthorized)
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  test('pairs with a code once, then reconnects with its own key', async () => {
    paired.splice(0)
    const secret = crypto.randomBytes(32)
    codes.set(bytesToBase64Url(pairingIdOf(crypto, secret)), secret)
    const client = makeClient({ pairing: { secret, info: { name: 'iPhone', platform: 'ios' } } })
    client.connect()
    const first = FakeSocket.instances[0]!
    first.open()
    expect(first.mode).toBe('pair')
    expect(paired).toHaveLength(1)
    expect(sameKey(paired[0] as Uint8Array, deviceKey.publicKey)).toBe(true)
    first.receive({ type: 'auth.ok', replyTo: first.last().id, ...hello })
    await Promise.resolve()
    expect(client.status).toBe('open')
    first.drop()
    vi.advanceTimersByTime(1_000)
    const second = FakeSocket.instances[1]!
    second.open()
    expect(second.mode).toBe('reconnect')
    expect(second.last()).toMatchObject({ type: 'auth' })
  })

  test('refuses a daemon whose static key is not the one in the code, for good', () => {
    const secret = crypto.randomBytes(32)
    codes.set(bytesToBase64Url(pairingIdOf(crypto, secret)), secret)
    const client = makeClient({
      computer: { addresses: ['h:1'], daemonKey: crypto.generateKeyPair().publicKey, deviceKey },
      pairing: { secret, info: { name: '', platform: '' } },
    })
    client.connect()
    FakeSocket.instances[0]!.open()
    expect(client.status).toBe('unauthorized')
    expect(client.closeCode).toBe(WRONG_DAEMON_CLOSE)
    expect(FakeSocket.instances[0]!.sent).toEqual([])
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  test('a refused pairing code is final', () => {
    const client = makeClient({
      pairing: { secret: crypto.randomBytes(32), info: { name: '', platform: '' } },
    })
    client.connect()
    const socket = FakeSocket.instances[0]!
    socket.open()
    expect(socket.refused).toBe(CHANNEL_CLOSE.pairingRefused)
    socket.drop(CHANNEL_CLOSE.pairingRefused)
    expect(client.status).toBe('unauthorized')
    expect(client.closeCode).toBe(CHANNEL_CLOSE.pairingRefused)
  })

  test('tries the addresses in turn', () => {
    const client = makeClient({
      computer: { addresses: ['10.0.0.2:7337', '[fd7a::1]:7337'], daemonKey: daemonKey.publicKey, deviceKey },
    })
    client.connect()
    FakeSocket.instances[0]!.drop()
    vi.advanceTimersByTime(1_000)
    FakeSocket.instances[1]!.drop()
    vi.advanceTimersByTime(2_000)
    expect(FakeSocket.instances.map((s) => s.url)).toEqual([
      'ws://10.0.0.2:7337',
      'ws://[fd7a::1]:7337',
      'ws://10.0.0.2:7337',
    ])
  })

  test('large replies arrive in several frames', async () => {
    const client = makeClient()
    client.connect()
    const socket = FakeSocket.instances[0]!
    authenticate(socket)
    await Promise.resolve()
    const image = client.request({ type: 'transcript.image', sessionId: 's', imageId: 'i' })
    const data = 'A'.repeat(300_000)
    socket.receive({
      type: 'transcript.image',
      replyTo: socket.last().id,
      imageId: 'i',
      mediaType: 'image/png',
      data,
    })
    await expect(image).resolves.toMatchObject({ data })
  })

  test('a revoked device and refusals through the relay (41xx) are final', () => {
    for (const [code, read] of [
      [CHANNEL_CLOSE.revoked, CHANNEL_CLOSE.revoked],
      [4101, CHANNEL_CLOSE.unauthorized],
      [4105, CHANNEL_CLOSE.pairingRefused],
    ]) {
      FakeSocket.instances = []
      const client = makeClient()
      client.connect()
      FakeSocket.instances[0]!.drop(code)
      expect(client.status).toBe('unauthorized')
      expect(client.closeCode).toBe(read)
    }
  })

  test('formats addresses', () => {
    expect(daemonUrl('[fd7a::1]:7337')).toBe('ws://[fd7a::1]:7337')
  })
})

describe('selectProfiles', () => {
  test('returns a stable empty array before hello', async () => {
    const { selectProfiles, useConnectionStore } = await import('./connection-store')
    const state = useConnectionStore.getState()
    expect(selectProfiles(state)).toBe(selectProfiles({ ...state }))
  })
})

describe('DaemonClient unreachable computer', () => {
  test('an attempt with no answer is abandoned after the connect timeout and marked unreachable', async () => {
    const client = makeClient({ connectTimeoutMs: 10_000 })
    const statuses: Array<[string, boolean]> = []
    client.onStatus((status) => statuses.push([status, client.unreachable]))
    client.connect()
    const first = FakeSocket.instances[0]!
    vi.advanceTimersByTime(9_999)
    expect(client.unreachable).toBe(false)
    vi.advanceTimersByTime(1)
    expect(first.readyState).toBe(3)
    expect(client.unreachable).toBe(true)
    expect(client.status).toBe('reconnecting')
    expect(statuses.at(-1)).toEqual(['reconnecting', true])

    // The computer wakes: the next attempt opens and the flag clears.
    vi.advanceTimersByTime(1_000)
    const second = FakeSocket.instances[1]!
    authenticate(second)
    await Promise.resolve()
    expect(client.status).toBe('open')
    expect(client.unreachable).toBe(false)
    // A late close of the abandoned socket changes nothing.
    first.drop()
    expect(client.status).toBe('open')
  })

  test('a connection refused at once is not unreachable and notifies the flip', () => {
    const client = makeClient({ connectTimeoutMs: 10_000 })
    const flags: boolean[] = []
    client.onStatus(() => flags.push(client.unreachable))
    client.connect()
    vi.advanceTimersByTime(10_000)
    expect(client.unreachable).toBe(true)
    vi.advanceTimersByTime(1_000)
    FakeSocket.instances[1]!.drop()
    expect(client.unreachable).toBe(false)
    expect(client.status).toBe('reconnecting')
    expect(flags.at(-1)).toBe(false)
  })

  test('close() cancels a pending connect timeout', () => {
    const client = makeClient({ connectTimeoutMs: 10_000 })
    client.connect()
    client.close()
    vi.advanceTimersByTime(20_000)
    expect(client.unreachable).toBe(false)
    expect(client.status).toBe('closed')
    expect(FakeSocket.instances).toHaveLength(1)
  })
})
