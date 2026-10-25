import * as nodeCrypto from 'node:crypto'
import { createNoiseCrypto, formatPairingCode, type NodeLikeCrypto } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { computerFromCode, parseStoredComputer, serializeComputer } from '@/core/storage/computer'
import { deviceInfo, pairingCodeFromRoute, parsePairingLink } from './parse-pairing-url'

const crypto = createNoiseCrypto(nodeCrypto as unknown as NodeLikeCrypto)
const code = {
  daemonId: '0123456789abcdef0123456789abcdef',
  daemonKey: crypto.generateKeyPair().publicKey,
  secret: crypto.randomBytes(32),
  addresses: ['100.101.1.2:7337', '[fd7a::1]:7337'],
  name: 'Mac mini',
}

describe('pairing links', () => {
  test('a scanned or pasted link', () => {
    expect(parsePairingLink(formatPairingCode(code))).toEqual({ ok: true, code })
    expect(parsePairingLink(` ${formatPairingCode(code)}\n`).ok).toBe(true)
  })

  test('a protocol-1 link is recognized, other text is invalid', () => {
    expect(parsePairingLink('claude-remote://pair?host=100.1.1.1&port=7337&token=abcdefghijklmnopq')).toEqual(
      {
        ok: false,
        reason: 'legacy',
      },
    )
    expect(parsePairingLink('https://example.com')).toEqual({ ok: false, reason: 'invalid' })
  })

  test('deep link route params, with one or several addresses', () => {
    const query = new URL(formatPairingCode(code).replace('remoteharness://pair', 'https://x/pair'))
      .searchParams
    const params: Record<string, string | string[]> = {}
    for (const [key, value] of query) {
      const previous = params[key]
      params[key] = previous === undefined ? value : [previous as string, value].flat()
    }
    expect(pairingCodeFromRoute(params)).toEqual({ ok: true, code })
    expect(pairingCodeFromRoute({})).toBeNull()
    expect(pairingCodeFromRoute({ host: 'h', port: '1', token: 't' })).toEqual({
      ok: false,
      reason: 'legacy',
    })
  })

  test('device info', () => {
    expect(deviceInfo('ios', true)).toEqual({ name: 'iPad', platform: 'ios' })
    expect(deviceInfo('ios', false)).toEqual({ name: 'iPhone', platform: 'ios' })
    expect(deviceInfo('android', false)).toEqual({ name: 'Android', platform: 'android' })
  })
})

describe('stored computer', () => {
  test('round trip', () => {
    const computer = computerFromCode(code, crypto.generateKeyPair())
    expect(parseStoredComputer(serializeComputer(computer))).toEqual({ kind: 'computer', computer })
  })

  test('a protocol-1 credential is legacy; garbage is nothing', () => {
    expect(parseStoredComputer(JSON.stringify({ host: 'h', port: 1, token: 't' }))).toEqual({
      kind: 'legacy',
    })
    expect(parseStoredComputer('{oops')).toEqual({ kind: 'none' })
    expect(parseStoredComputer(null)).toEqual({ kind: 'none' })
    expect(parseStoredComputer(JSON.stringify({ v: 2, daemonId: 'x' }))).toEqual({ kind: 'none' })
  })
})
