import * as nodeCrypto from 'node:crypto'
import { describe, expect, test } from 'vitest'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  CHANNEL_CLOSE,
  ChannelSession,
  createNoiseCrypto,
  DaemonHandshake,
  type DaemonHandshakeStep,
  DeviceHandshake,
  decodePreface,
  formatPairingCode,
  HandshakeState,
  type KeyPair,
  type NodeLikeCrypto,
  NoiseError,
  pairingIdOf,
  parsePairingCode,
  utf8Decode,
  utf8Encode,
} from '../src/index.ts'
import { NOISE_TEST_VECTORS, runNoiseVector } from '../src/noise/test-vectors.ts'

const crypto = createNoiseCrypto(nodeCrypto as unknown as NodeLikeCrypto)

describe('official Noise vectors', () => {
  test.each(NOISE_TEST_VECTORS.map((v) => [v.protocol_name, v] as const))('%s', (_name, vector) => {
    expect(runNoiseVector(crypto, vector)).toEqual([])
  })
})

type World = {
  daemonKey: KeyPair
  deviceKey: KeyPair
  secret: Uint8Array
  codes: Map<string, Uint8Array>
  paired: Uint8Array[]
}

function world(): World {
  const secret = crypto.randomBytes(32)
  return {
    daemonKey: crypto.generateKeyPair(),
    deviceKey: crypto.generateKeyPair(),
    secret,
    codes: new Map([[bytesToBase64Url(pairingIdOf(crypto, secret)), secret]]),
    paired: [],
  }
}

function daemonSide(w: World): DaemonHandshake {
  return new DaemonHandshake(crypto, w.daemonKey, {
    pairingSecret: (id) => w.codes.get(bytesToBase64Url(id)) ?? null,
    isPaired: (key) => w.paired.some((k) => bytesToBase64Url(k) === bytesToBase64Url(key)),
  })
}

/** Runs a full pairing; returns both sessions. */
function pair(w: World, secret = w.secret): { device: ChannelSession; daemon: DaemonHandshakeStep } {
  const device = DeviceHandshake.pair(crypto, {
    deviceKey: w.deviceKey,
    daemonKey: w.daemonKey.publicKey,
    secret,
    info: { name: 'Pixel 9', platform: 'android' },
  })
  const daemon = daemonSide(w)
  const second = daemon.start(device.start())
  if (second.kind !== 'send') throw new Error(`refused: ${JSON.stringify(second)}`)
  const third = device.receive(second.send)
  if (!third.send || !third.session) throw new Error('no third message')
  return { device: third.session, daemon: daemon.finish(third.send) }
}

function reconnect(w: World): { device: ChannelSession; daemon: ChannelSession } {
  const device = DeviceHandshake.reconnect(crypto, {
    deviceKey: w.deviceKey,
    daemonKey: w.daemonKey.publicKey,
  })
  const second = daemonSide(w).start(device.start())
  if (second.kind !== 'send' || !second.session) throw new Error(`refused: ${JSON.stringify(second)}`)
  const done = device.receive(second.send)
  if (!done.session || done.send) throw new Error('IK must finish in two messages')
  return { device: done.session, daemon: second.session }
}

function roundTrip(from: ChannelSession, to: ChannelSession, text: string): string | null {
  let out: string | null = null
  for (const frame of from.sealText(text)) out = to.openText(frame)
  return out
}

describe('pairing (XXpsk3)', () => {
  test('pairs, learns the device key and its name, and carries messages both ways', () => {
    const w = world()
    const { device, daemon } = pair(w)
    expect(daemon.kind).toBe('paired')
    if (daemon.kind !== 'paired') return
    expect(daemon.device).toEqual({ name: 'Pixel 9', platform: 'android' })
    expect(bytesToBase64Url(daemon.session.remoteStatic)).toBe(bytesToBase64Url(w.deviceKey.publicKey))
    expect(roundTrip(device, daemon.session, '{"type":"auth"}')).toBe('{"type":"auth"}')
    expect(roundTrip(daemon.session, device, 'olá 👋')).toBe('olá 👋')
  })

  test('an unknown pairing code is refused before any handshake work', () => {
    const w = world()
    w.codes.clear()
    const device = DeviceHandshake.pair(crypto, {
      deviceKey: w.deviceKey,
      daemonKey: w.daemonKey.publicKey,
      secret: w.secret,
      info: { name: '', platform: '' },
    })
    expect(daemonSide(w).start(device.start())).toMatchObject({
      kind: 'refused',
      code: CHANNEL_CLOSE.pairingRefused,
    })
  })

  test('a wrong secret fails at the third message', () => {
    const w = world()
    const wrong = crypto.randomBytes(32)
    // Same pairing ID (the daemon finds a code) but the device holds another secret.
    w.codes.set(bytesToBase64Url(pairingIdOf(crypto, wrong)), w.secret)
    expect(pair(w, wrong).daemon).toMatchObject({ kind: 'refused', code: CHANNEL_CLOSE.pairingRefused })
  })

  test('the device refuses a daemon whose static key is not the one in the code', () => {
    const w = world()
    const device = DeviceHandshake.pair(crypto, {
      deviceKey: w.deviceKey,
      daemonKey: crypto.generateKeyPair().publicKey,
      secret: w.secret,
      info: { name: '', platform: '' },
    })
    const second = daemonSide(w).start(device.start())
    if (second.kind !== 'send') throw new Error('refused')
    expect(() => device.receive(second.send)).toThrow(NoiseError)
  })

  test('a tampered preface breaks the handshake', () => {
    const w = world()
    const device = DeviceHandshake.pair(crypto, {
      deviceKey: w.deviceKey,
      daemonKey: w.daemonKey.publicKey,
      secret: w.secret,
      info: { name: '', platform: '' },
    })
    const first = device.start()
    // Flip the mode byte to reconnect: the daemon then reads garbage as IK.
    const tampered = Uint8Array.from(first)
    tampered[3] = 0x02
    expect(daemonSide(w).start(tampered)).toMatchObject({ kind: 'refused' })
  })
})

describe('reconnect (IK)', () => {
  test('a paired key reconnects in one round trip', () => {
    const w = world()
    w.paired.push(w.deviceKey.publicKey)
    const { device, daemon } = reconnect(w)
    expect(roundTrip(device, daemon, 'hello')).toBe('hello')
    expect(roundTrip(daemon, device, 'world')).toBe('world')
  })

  test('an unknown device is refused with 4001', () => {
    const w = world()
    const device = DeviceHandshake.reconnect(crypto, {
      deviceKey: w.deviceKey,
      daemonKey: w.daemonKey.publicKey,
    })
    expect(daemonSide(w).start(device.start())).toMatchObject({
      kind: 'refused',
      code: CHANNEL_CLOSE.unauthorized,
    })
  })

  test('a device that has the wrong daemon key cannot complete', () => {
    const w = world()
    w.paired.push(w.deviceKey.publicKey)
    const device = DeviceHandshake.reconnect(crypto, {
      deviceKey: w.deviceKey,
      daemonKey: crypto.generateKeyPair().publicKey,
    })
    expect(daemonSide(w).start(device.start())).toMatchObject({
      kind: 'refused',
      code: CHANNEL_CLOSE.unauthorized,
    })
  })
})

describe('transport', () => {
  test('tampered frames fail closed', () => {
    const w = world()
    w.paired.push(w.deviceKey.publicKey)
    const { device, daemon } = reconnect(w)
    const [frame] = device.sealText('{"type":"ping"}')
    const tampered = Uint8Array.from(frame as Uint8Array)
    tampered[5] = (tampered[5] ?? 0) ^ 1
    expect(() => daemon.open(tampered)).toThrow(NoiseError)
  })

  test('a replayed frame fails (its nonce was used)', () => {
    const w = world()
    w.paired.push(w.deviceKey.publicKey)
    const { device, daemon } = reconnect(w)
    const [frame] = device.sealText('once')
    expect(daemon.openText(frame as Uint8Array)).toBe('once')
    expect(() => daemon.open(frame as Uint8Array)).toThrow(NoiseError)
  })

  test('frames out of order fail', () => {
    const w = world()
    w.paired.push(w.deviceKey.publicKey)
    const { device, daemon } = reconnect(w)
    device.sealText('a')
    const [b] = device.sealText('b')
    expect(() => daemon.open(b as Uint8Array)).toThrow(NoiseError)
  })

  test('large messages are split into Noise-sized chunks and reassembled', () => {
    const w = world()
    w.paired.push(w.deviceKey.publicKey)
    const { device, daemon } = reconnect(w)
    const big = 'x'.repeat(200_000)
    const frames = device.sealText(big)
    expect(frames.length).toBe(4)
    for (const frame of frames) expect(frame.length).toBeLessThanOrEqual(65535)
    expect(frames.slice(0, -1).map((f) => daemon.open(f))).toEqual([null, null, null])
    expect(daemon.openText(frames.at(-1) as Uint8Array)?.length).toBe(200_000)
  })

  test('an empty message is one frame', () => {
    const w = world()
    w.paired.push(w.deviceKey.publicKey)
    const { device, daemon } = reconnect(w)
    const frames = device.seal(new Uint8Array(0))
    expect(frames).toHaveLength(1)
    expect(daemon.open(frames[0] as Uint8Array)).toEqual(new Uint8Array(0))
  })

  test('messages over the cap are refused on both sides', () => {
    const w = world()
    w.paired.push(w.deviceKey.publicKey)
    const { device } = reconnect(w)
    expect(() => device.seal(new Uint8Array(8 * 1024 * 1024 + 1))).toThrow(NoiseError)
    const responderKey = crypto.generateKeyPair()
    const options = { pattern: 'IK' as const, prologue: new Uint8Array(0) }
    const initiator = new HandshakeState(crypto, {
      ...options,
      initiator: true,
      staticKey: crypto.generateKeyPair(),
      remoteStatic: responderKey.publicKey,
    })
    const responder = new HandshakeState(crypto, { ...options, initiator: false, staticKey: responderKey })
    responder.readMessage(initiator.writeMessage())
    initiator.readMessage(responder.writeMessage())
    const sender = ChannelSession.from(initiator.handshakeResult)
    const receiver = ChannelSession.from(responder.handshakeResult, 100)
    const frames = sender.seal(new Uint8Array(70_000))
    expect(() => {
      for (const frame of frames) receiver.open(frame)
    }).toThrow(NoiseError)
  })
})

describe('preface', () => {
  test('text and other protocols are recognized', () => {
    expect(decodePreface(utf8Encode('{"type":"auth"}'))).toMatchObject({
      ok: false,
      reason: 'not_remote_harness',
    })
    expect(decodePreface(Uint8Array.of(0x52, 0x48, 9, 2))).toMatchObject({ ok: false, reason: 'version' })
    expect(decodePreface(Uint8Array.of(0x52, 0x48, 2, 1, 0))).toMatchObject({
      ok: false,
      reason: 'malformed',
    })
  })
})

describe('pairing code', () => {
  const code = {
    daemonId: '0123456789abcdef0123456789abcdef',
    daemonKey: crypto.generateKeyPair().publicKey,
    secret: crypto.randomBytes(32),
    addresses: ['100.101.1.2:7337', '[fd7a:115c::1]:7337'],
    relay: 'wss://us.relay.remoteharness.app',
    name: 'MacBook do Marco',
  }

  test('round trip', () => {
    const parsed = parsePairingCode(formatPairingCode(code))
    expect(parsed).toEqual({ ok: true, code })
  })

  test('the old scheme is accepted, the old format is recognized as legacy', () => {
    const link = formatPairingCode(code).replace('remoteharness://', 'claude-remote://')
    expect(parsePairingCode(link).ok).toBe(true)
    expect(parsePairingCode('claude-remote://pair?host=100.1.1.1&port=7337&token=abcdefghijklmnop')).toEqual({
      ok: false,
      reason: 'legacy',
    })
  })

  test('invalid codes', () => {
    const good = formatPairingCode(code)
    for (const bad of [
      'https://example.com',
      good.replace('v=2', 'v=3'),
      good.replace(/id=[^&]+/, 'id=zz'),
      good.replace(/k=[^&]+/, 'k=AAAA'),
      good.replace(/s=[^&]+/, 's=AAAA'),
      good.replace(/r=[^&]+/, 'r=http%3A%2F%2Fx'),
      formatPairingCode({ ...code, addresses: [], relay: undefined as unknown as string }),
    ]) {
      expect(parsePairingCode(bad), bad).toMatchObject({ ok: false, reason: 'invalid' })
    }
  })

  test('addresses that are not host:port are dropped', () => {
    const parsed = parsePairingCode(
      formatPairingCode({ ...code, addresses: ['evil host:1', '10.0.0.2:7337', 'x:99999'] }),
    )
    expect(parsed.ok && parsed.code.addresses).toEqual(['10.0.0.2:7337'])
  })
})

describe('bytes', () => {
  test('base64url round trip and refusal', () => {
    for (const length of [0, 1, 2, 3, 31, 32, 33]) {
      const bytes = crypto.randomBytes(length)
      expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes)
      expect(bytesToBase64Url(bytes)).toBe(Buffer.from(bytes).toString('base64url'))
    }
    expect(base64UrlToBytes('a+b/')).toBeNull()
    expect(base64UrlToBytes('A')).toBeNull()
  })

  test('utf-8 round trip', () => {
    const text = 'ação 👋 中文'
    expect(utf8Decode(utf8Encode(text))).toBe(text)
  })
})
