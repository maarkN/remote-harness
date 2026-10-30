import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NOISE_TEST_VECTORS, runNoiseVector } from '@remote-harness/protocol/noise-test-vectors'
import { describe, expect, test } from 'vitest'
import { noiseCrypto } from '../src/core/identity.ts'
import { PairingCodes, REUSE_MIN_LEFT_MS } from '../src/features/pairing/codes.ts'
import { deviceIdOf, MAX_PAIRED_DEVICES, PairedDevices } from '../src/features/pairing/devices.ts'
import { useTempHome } from './helpers.ts'

const home = useTempHome()

describe('Noise vectors with the daemon primitives (node:crypto)', () => {
  test.each(NOISE_TEST_VECTORS.map((v) => [v.protocol_name, v] as const))('%s', (_name, vector) => {
    expect(runNoiseVector(noiseCrypto, vector)).toEqual([])
  })
})

describe('pairing codes', () => {
  const clock = () => {
    let now = 1_000_000
    return { now: () => now, advance: (ms: number) => (now += ms) }
  }
  const id = (code: { pairingId: string }) => Buffer.from(code.pairingId, 'base64url')

  test('a code works once within 5 minutes', () => {
    const c = clock()
    const codes = new PairingCodes(noiseCrypto, c.now)
    const code = codes.create()
    expect(codes.secretFor(id(code))).toEqual(code.secret)
    c.advance(4 * 60_000)
    expect(codes.consume(id(code))).toBe(true)
    expect(codes.secretFor(id(code))).toBeNull()
    expect(codes.consume(id(code))).toBe(false)
  })

  test('an expired code is refused', () => {
    const c = clock()
    const codes = new PairingCodes(noiseCrypto, c.now)
    const code = codes.create()
    c.advance(5 * 60_000 + 1)
    expect(codes.secretFor(id(code))).toBeNull()
    expect(codes.consume(id(code))).toBe(false)
  })

  test('several codes coexist; each is its own', () => {
    const codes = new PairingCodes(noiseCrypto)
    const a = codes.create()
    const b = codes.create()
    expect(a.secret).not.toEqual(b.secret)
    expect(codes.consume(id(a))).toBe(true)
    expect(codes.secretFor(id(b))).toEqual(b.secret)
  })

  test('the tray reuses its code while more than a minute is left, never a used one', () => {
    const c = clock()
    const codes = new PairingCodes(noiseCrypto, c.now)
    const first = codes.current()
    c.advance(60_000)
    expect(codes.current()).toBe(first)
    c.advance(5 * 60_000 - 60_000 - REUSE_MIN_LEFT_MS)
    const second = codes.current()
    expect(second).not.toBe(first)
    codes.consume(id(second))
    expect(codes.current()).not.toBe(second)
  })
})

describe('paired devices', () => {
  const key = () => noiseCrypto.generateKeyPair().publicKey

  test('persists and reloads, keyed by the public key', async () => {
    const path = join(home.dir(), 'paired-devices.json')
    const devices = new PairedDevices(path, () => 42)
    await devices.load()
    const phone = key()
    expect(await devices.add(phone, { name: 'iPhone', platform: 'ios' })).toBe(true)
    const reloaded = new PairedDevices(path)
    await reloaded.load()
    expect(reloaded.has(phone)).toBe(true)
    expect(reloaded.has(key())).toBe(false)
    expect(reloaded.devices()).toEqual([
      {
        id: deviceIdOf(phone),
        publicKey: Buffer.from(phone).toString('base64url'),
        name: 'iPhone',
        platform: 'ios',
        pairedAt: 42,
        lastSeen: 42,
      },
    ])
    expect((await readFile(path, 'utf8')).includes('privateKey')).toBe(false)
  })

  test('at most 10 devices; pairing again with a known key is not a new one', async () => {
    const devices = new PairedDevices(join(home.dir(), 'paired.json'))
    await devices.load()
    const keys = Array.from({ length: MAX_PAIRED_DEVICES }, key)
    for (const k of keys) expect(await devices.add(k, { name: 'p', platform: 'ios' })).toBe(true)
    expect(await devices.add(key(), { name: 'eleventh', platform: 'ios' })).toBe(false)
    expect(await devices.add(keys[0] as Uint8Array, { name: 'renamed', platform: 'ios' })).toBe(true)
    expect(devices.devices()).toHaveLength(MAX_PAIRED_DEVICES)
  })

  test('a corrupt file is an empty list', async () => {
    const { writeFile } = await import('node:fs/promises')
    const path = join(home.dir(), 'broken.json')
    await writeFile(path, '{not json')
    const devices = new PairedDevices(path)
    await devices.load()
    expect(devices.devices()).toEqual([])
  })
})
