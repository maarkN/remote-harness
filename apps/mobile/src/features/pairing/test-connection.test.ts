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
import { failureForClose, testConnection } from './test-connection'

const crypto = createNoiseCrypto(nodeCrypto as unknown as NodeLikeCrypto)
const daemonKey = crypto.generateKeyPair()
const hello = {
  protocolVersion: PROTOCOL_VERSION,
  daemonVersion: '0.1.0',
  profiles: [],
  defaultRuleScope: 'project',
  muted: { profiles: [], sessions: [] },
}

type Behavior = 'ok' | 'down'

/** Sockets backed by a fake daemon that knows the given codes; `down` addresses refuse at once. */
function socketFactory(codes: Uint8Array[], behaviors: Record<string, Behavior>) {
  const urls: string[] = []
  const factory = (url: string): SocketLike => {
    urls.push(url)
    let session: ChannelSession | null = null
    let stage: 'first' | 'finish' | 'open' = 'first'
    const daemon = new DaemonHandshake(crypto, daemonKey, {
      pairingSecret: (id) =>
        codes.find((c) => bytesToBase64Url(pairingIdOf(crypto, c)) === bytesToBase64Url(id)) ?? null,
      isPaired: () => false,
    })
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
        if (stage === 'first') {
          const step = daemon.start(bytes)
          if (step.kind === 'refused') {
            queueMicrotask(() => socket.onclose?.({ code: step.code }))
            return
          }
          if (step.kind === 'send') deliver(step.send)
          stage = 'finish'
          return
        }
        if (stage === 'finish') {
          const step = daemon.finish(bytes)
          if (step.kind !== 'paired') {
            queueMicrotask(() => socket.onclose?.({ code: step.kind === 'refused' ? step.code : 4001 }))
            return
          }
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

describe('testConnection (pairing)', () => {
  test('pairs and answers hello', async () => {
    const pairing = code(['10.0.0.2:7337'])
    const { factory } = socketFactory([pairing.secret], {})
    const result = await testConnection(pairing, { ...options, socketFactory: factory })
    expect(result).toMatchObject({ ok: true, hello: { daemonVersion: '0.1.0' } })
  })

  test('a used code is reported as such and not retried on the other addresses', async () => {
    const pairing = code(['10.0.0.2:7337', '10.0.0.3:7337'])
    const { factory, urls } = socketFactory([], {})
    expect(await testConnection(pairing, { ...options, socketFactory: factory })).toEqual({
      ok: false,
      error: 'codeUsed',
    })
    expect(urls).toHaveLength(1)
  })

  test('an address that does not answer moves on to the next one', async () => {
    const pairing = code(['10.0.0.2:7337', '100.64.0.2:7337'])
    const { factory, urls } = socketFactory([pairing.secret], { 'ws://10.0.0.2:7337': 'down' })
    expect(await testConnection(pairing, { ...options, socketFactory: factory })).toMatchObject({ ok: true })
    expect(urls).toEqual(['ws://10.0.0.2:7337', 'ws://100.64.0.2:7337'])
  })

  test('nothing answering is a failure with the reason', async () => {
    const pairing = code(['10.0.0.2:7337'])
    const { factory } = socketFactory([pairing.secret], { 'ws://10.0.0.2:7337': 'down' })
    expect(await testConnection(pairing, { ...options, socketFactory: factory })).toEqual({
      ok: false,
      error: 'failed',
      detail: 'refused',
    })
  })

  test('another daemon key in the answer is refused', async () => {
    const pairing = { ...code(['10.0.0.2:7337']), daemonKey: crypto.generateKeyPair().publicKey }
    const { factory } = socketFactory([pairing.secret], {})
    expect(await testConnection(pairing, { ...options, socketFactory: factory })).toEqual({
      ok: false,
      error: 'wrongComputer',
    })
  })

  test('close codes map to the messages', () => {
    expect(failureForClose(CHANNEL_CLOSE.pairingRefused)).toBe('codeUsed')
    expect(failureForClose(CHANNEL_CLOSE.deviceLimit)).toBe('deviceLimit')
    expect(failureForClose(CHANNEL_CLOSE.protocolMismatch)).toBe('protocol')
    expect(failureForClose(WRONG_DAEMON_CLOSE)).toBe('wrongComputer')
    expect(failureForClose(CHANNEL_CLOSE.unauthorized)).toBe('unauthorized')
  })
})
