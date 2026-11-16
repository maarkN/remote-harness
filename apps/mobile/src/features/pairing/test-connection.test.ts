import * as nodeCrypto from 'node:crypto'
import {
  bytesToBase64Url,
  CHANNEL_CLOSE,
  type ChannelSession,
  createNoiseCrypto,
  DaemonHandshake,
  type NodeLikeCrypto,
  type PairingCode,
  PROTOCOL_VERSION,
  pairingIdOf,
} from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { type SocketLike, WRONG_DAEMON_CLOSE } from '@/core/connection/daemon-client'
import { announcePairing, failureForClose, testConnection } from './test-connection'

const crypto = createNoiseCrypto(nodeCrypto as unknown as NodeLikeCrypto)
const daemonKey = crypto.generateKeyPair()
const hello = {
  protocolVersion: PROTOCOL_VERSION,
  daemonVersion: '0.1.0',
  profiles: [],
  defaultRuleScope: 'project',
  muted: { profiles: [], sessions: [] },
}

/** `old`: a daemon from before confirmation codes, which does not know the announce (4002). */
type Behavior = 'ok' | 'down' | 'old'

/** What the fake computer shows once a device announces its code. */
const SHOWN = '123456'

/**
 * Sockets backed by a fake daemon that knows the given codes; `down` addresses refuse at once.
 * Like the daemon, an announce shows the confirmation code (4011) and three wrong codes burn it.
 */
function socketFactory(codes: Uint8Array[], behaviors: Record<string, Behavior>) {
  const urls: string[] = []
  const shown = new Set<string>()
  let attempts = 0
  const factory = (url: string): SocketLike => {
    urls.push(url)
    let session: ChannelSession | null = null
    let stage: 'first' | 'finish' | 'open' | 'closed' = 'first'
    const daemon = new DaemonHandshake(crypto, daemonKey, {
      pairingSecret: (id) =>
        codes.find((c) => bytesToBase64Url(pairingIdOf(crypto, c)) === bytesToBase64Url(id)) ?? null,
      pairingConfirmation: (id) => (shown.has(bytesToBase64Url(id)) ? SHOWN : null),
      isPaired: () => false,
    })
    // Like the daemon, nothing more is read once it closed (the client's `auth` may already follow).
    const closeWith = (code: number) => {
      stage = 'closed'
      queueMicrotask(() => socket.onclose?.({ code }))
    }
    const deliver = (bytes: Uint8Array) =>
      queueMicrotask(() =>
        socket.onmessage?.({
          data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        }),
      )
    const socket: SocketLike = {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send(data) {
        const bytes = new Uint8Array(data)
        if (stage === 'closed') return
        if (stage === 'first') {
          if (behaviors[url] === 'old' && bytes[3] !== 0x01 && bytes[3] !== 0x02)
            return closeWith(CHANNEL_CLOSE.protocolMismatch)
          const step = daemon.start(bytes)
          if (step.kind === 'refused') return closeWith(step.code)
          if (step.kind === 'announce') {
            shown.add(bytesToBase64Url(step.pairingId))
            return closeWith(CHANNEL_CLOSE.confirmationShown)
          }
          if (step.kind === 'send') deliver(step.send)
          stage = 'finish'
          return
        }
        if (stage === 'finish') {
          const step = daemon.finish(bytes)
          if (step.kind === 'wrong-confirmation') {
            attempts += 1
            if (attempts < 3) return closeWith(CHANNEL_CLOSE.wrongConfirmation)
            codes.splice(0)
            return closeWith(CHANNEL_CLOSE.confirmationLocked)
          }
          if (step.kind !== 'paired') return closeWith(step.kind === 'refused' ? step.code : 4001)
          // Single use, like the daemon.
          codes.splice(0)
          session = step.session
          stage = 'open'
          return
        }
        const auth = JSON.parse(session?.openText(bytes) ?? '{}') as { id: string }
        for (const frame of session?.sealText(
          JSON.stringify({ type: 'auth.ok', replyTo: auth.id, ...hello }),
        ) ?? [])
          deliver(frame)
      },
      close() {},
    }
    queueMicrotask(() => {
      if (behaviors[url] === 'down') {
        socket.onclose?.({ code: 1006, reason: 'refused' })
        return
      }
      socket.readyState = 1
      socket.onopen?.({})
    })
    return socket
  }
  return { factory, urls }
}

function code(addresses: string[], secret = crypto.randomBytes(32)): PairingCode {
  return { daemonId: '0'.repeat(32), daemonKey: daemonKey.publicKey, secret, addresses, name: 'Mac' }
}

const options = { crypto, deviceKey: crypto.generateKeyPair(), info: { name: 'iPhone', platform: 'ios' } }

describe('announcePairing (#593)', () => {
  test('the computer shows the confirmation code: the target that answered comes back', async () => {
    const pairing = code(['10.0.0.2:7337'])
    const { factory } = socketFactory([pairing.secret], {})
    expect(await announcePairing(pairing, { crypto, socketFactory: factory })).toEqual({
      ok: true,
      target: { addresses: ['10.0.0.2:7337'] },
    })
  })

  test('an address that does not answer moves on; the relay is the last resort', async () => {
    const pairing = { ...code(['10.0.0.2:7337']), relay: 'wss://br.relay.remoteharness.app' }
    const { factory, urls } = socketFactory([pairing.secret], { 'ws://10.0.0.2:7337': 'down' })
    expect(await announcePairing(pairing, { crypto, socketFactory: factory })).toEqual({
      ok: true,
      target: { addresses: [], daemonId: '0'.repeat(32), relay: 'wss://br.relay.remoteharness.app' },
    })
    expect(urls).toEqual([
      'ws://10.0.0.2:7337',
      `wss://br.relay.remoteharness.app/v1/device/${'0'.repeat(32)}`,
    ])
  })

  test('a used code is reported at once, and so is a computer that must be updated', async () => {
    const used = code(['10.0.0.2:7337', '10.0.0.3:7337'])
    const first = socketFactory([], {})
    expect(await announcePairing(used, { crypto, socketFactory: first.factory })).toEqual({
      ok: false,
      error: 'codeUsed',
    })
    expect(first.urls).toHaveLength(1)
    const old = code(['10.0.0.2:7337'])
    const second = socketFactory([old.secret], { 'ws://10.0.0.2:7337': 'old' })
    expect(await announcePairing(old, { crypto, socketFactory: second.factory })).toEqual({
      ok: false,
      error: 'computerUpdate',
    })
  })
})

describe('testConnection (pairing)', () => {
  /** Announces like the app does, then pairs with `confirmation`. */
  async function pairWith(
    pairing: PairingCode,
    behaviors: Record<string, Behavior> = {},
    confirmation = SHOWN,
  ) {
    const fake = socketFactory([pairing.secret], behaviors)
    const announced = await announcePairing(pairing, { crypto, socketFactory: fake.factory })
    if (!announced.ok) throw new Error(announced.error)
    const result = await testConnection(pairing, {
      ...options,
      socketFactory: fake.factory,
      confirmation,
      first: announced.target,
    })
    return { result, fake, target: announced.target }
  }

  test('pairs with the code shown on the computer and answers hello', async () => {
    const { result } = await pairWith(code(['10.0.0.2:7337']))
    expect(result).toMatchObject({ ok: true, hello: { daemonVersion: '0.1.0' } })
  })

  test('pairs first where the announce was answered (the relay away from home)', async () => {
    const pairing = { ...code(['10.0.0.2:7337']), relay: 'wss://br.relay.remoteharness.app' }
    const { result, fake } = await pairWith(pairing, { 'ws://10.0.0.2:7337': 'down' })
    expect(result).toMatchObject({ ok: true })
    expect(fake.urls).toEqual([
      'ws://10.0.0.2:7337',
      `wss://br.relay.remoteharness.app/v1/device/${'0'.repeat(32)}`,
      `wss://br.relay.remoteharness.app/v1/device/${'0'.repeat(32)}`,
    ])
  })

  test('a wrong code can be typed again; the third burns the pairing code', async () => {
    const pairing = code(['10.0.0.2:7337'])
    const fake = socketFactory([pairing.secret], {})
    const announced = await announcePairing(pairing, { crypto, socketFactory: fake.factory })
    if (!announced.ok) throw new Error(announced.error)
    const attempt = (confirmation: string) =>
      testConnection(pairing, {
        ...options,
        socketFactory: fake.factory,
        confirmation,
        first: announced.target,
      })
    expect(await attempt('000001')).toEqual({ ok: false, error: 'wrongConfirmation' })
    expect(await attempt('000002')).toEqual({ ok: false, error: 'wrongConfirmation' })
    expect(await attempt('000003')).toEqual({ ok: false, error: 'confirmationLocked' })
  })

  test('a pairing the computer has not shown a code for asks to type the one it shows now', async () => {
    const pairing = code(['10.0.0.2:7337'])
    const { factory } = socketFactory([pairing.secret], {})
    expect(
      await testConnection(pairing, { ...options, socketFactory: factory, confirmation: SHOWN }),
    ).toEqual({
      ok: false,
      error: 'confirmationRequired',
    })
  })

  test('nothing answering is a failure with the reason', async () => {
    const pairing = code(['10.0.0.2:7337'])
    const { factory } = socketFactory([pairing.secret], { 'ws://10.0.0.2:7337': 'down' })
    expect(
      await testConnection(pairing, { ...options, socketFactory: factory, confirmation: SHOWN }),
    ).toEqual({
      ok: false,
      error: 'failed',
      detail: 'refused',
    })
  })

  test('another daemon key in the answer is refused', async () => {
    const pairing = { ...code(['10.0.0.2:7337']), daemonKey: crypto.generateKeyPair().publicKey }
    const { result } = await pairWith(pairing)
    expect(result).toEqual({ ok: false, error: 'wrongComputer' })
  })

  test('close codes map to the messages', () => {
    expect(failureForClose(CHANNEL_CLOSE.pairingRefused)).toBe('codeUsed')
    expect(failureForClose(CHANNEL_CLOSE.deviceLimit)).toBe('deviceLimit')
    expect(failureForClose(CHANNEL_CLOSE.protocolMismatch)).toBe('protocol')
    expect(failureForClose(WRONG_DAEMON_CLOSE)).toBe('wrongComputer')
    expect(failureForClose(CHANNEL_CLOSE.unauthorized)).toBe('unauthorized')
    expect(failureForClose(CHANNEL_CLOSE.confirmationShown)).toBe('confirmationRequired')
    expect(failureForClose(CHANNEL_CLOSE.wrongConfirmation)).toBe('wrongConfirmation')
    expect(failureForClose(CHANNEL_CLOSE.confirmationLocked)).toBe('confirmationLocked')
  })
})
