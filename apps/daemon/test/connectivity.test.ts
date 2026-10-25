import type { NetworkInterfaceInfo } from 'node:os'
import { describe, expect, test } from 'vitest'
import { silentLogger } from '../src/core/logger.ts'
import { directAddresses, MAX_DIRECT_ADDRESSES } from '../src/features/connectivity/addresses.ts'
import { measureRelay } from '../src/features/connectivity/measure.ts'
import {
  FAILOVER_AFTER,
  failoverRelay,
  healthUrl,
  pickHomeRelay,
  reconnectDelay,
  relayDaemonUrl,
  relayDeviceUrl,
} from '../src/features/connectivity/relays.ts'
import { HomeRelay, type RelaySession } from '../src/features/connectivity/service.ts'

const US = 'wss://us.relay.remoteharness.app'
const BR = 'wss://br.relay.remoteharness.app'

describe('relay choices', () => {
  test('URLs', () => {
    expect(healthUrl(US)).toBe('https://us.relay.remoteharness.app/healthz')
    expect(healthUrl('ws://127.0.0.1:8080/')).toBe('http://127.0.0.1:8080/healthz')
    expect(relayDaemonUrl(`${US}/`)).toBe(`${US}/v1/daemon`)
    expect(relayDeviceUrl(BR, 'ab')).toBe(`${BR}/v1/device/ab`)
  })

  test('the fastest relay that answers wins', () => {
    expect(
      pickHomeRelay([
        { url: US, rttMs: 180 },
        { url: BR, rttMs: 15 },
      ]),
    ).toBe(BR)
    expect(
      pickHomeRelay([
        { url: US, rttMs: 180 },
        { url: BR, rttMs: null },
      ]),
    ).toBe(US)
    expect(pickHomeRelay([{ url: US, rttMs: null }])).toBeNull()
  })

  test('failover prefers another relay, else the same one', () => {
    const both = [
      { url: US, rttMs: 180 },
      { url: BR, rttMs: 15 },
    ]
    expect(failoverRelay(both, BR)).toBe(US)
    expect(
      failoverRelay(
        [
          { url: US, rttMs: null },
          { url: BR, rttMs: 20 },
        ],
        BR,
      ),
    ).toBe(BR)
  })

  test('backoff doubles up to 30 s', () => {
    expect([0, 1, 2, 5, 10].map(reconnectDelay)).toEqual([1_000, 2_000, 4_000, 30_000, 30_000])
  })
})

describe('direct addresses', () => {
  const v4 = (address: string, internal = false): NetworkInterfaceInfo =>
    ({ address, family: 'IPv4', internal, netmask: '', mac: '', cidr: null }) as NetworkInterfaceInfo
  const v6 = (address: string): NetworkInterfaceInfo =>
    ({
      address,
      family: 'IPv6',
      internal: false,
      netmask: '',
      mac: '',
      cidr: null,
      scopeid: 0,
    }) as NetworkInterfaceInfo

  test('LAN and tailnet addresses, IPv4 first, no loopback or link-local', () => {
    const interfaces = {
      lo0: [v4('127.0.0.1', true), v6('::1')],
      en0: [v4('192.168.1.20'), v6('fe80::1'), v6('2804:14c::20')],
      utun4: [v4('100.101.1.2'), v6('fd7a:115c:a1e0::2')],
      bridge0: [v4('169.254.10.1')],
    }
    // ::1 is not flagged internal in this fixture: loopback must still be left out by `internal`.
    interfaces.lo0[1] = { ...(interfaces.lo0[1] as NetworkInterfaceInfo), internal: true }
    expect(directAddresses(interfaces, 7337)).toEqual([
      '192.168.1.20:7337',
      '100.101.1.2:7337',
      '[2804:14c::20]:7337',
      '[fd7a:115c:a1e0::2]:7337',
    ])
  })

  test('at most 8', () => {
    const many = { en0: Array.from({ length: 20 }, (_, i) => v4(`10.0.0.${i + 1}`)) }
    expect(directAddresses(many, 1)).toHaveLength(MAX_DIRECT_ADDRESSES)
  })
})

describe('measuring a relay', () => {
  test('the fastest of two answers, null when it never answers', async () => {
    let t = 0
    const now = () => t
    const answers = [50, 20]
    const fetchImpl = async () => {
      t += answers.shift() ?? 0
      return { ok: true }
    }
    expect(await measureRelay(US, fetchImpl, now)).toEqual({ url: US, rttMs: 20 })
    const down = async () => {
      throw new Error('ECONNREFUSED')
    }
    expect(await measureRelay(US, down, now)).toEqual({ url: US, rttMs: null })
    expect(await measureRelay(US, async () => ({ ok: false }), now)).toEqual({ url: US, rttMs: null })
  })
})

/** A relay session that opens (or fails) when told to, and closes on demand. */
function fakeSession(outcome: 'open' | 'fail'): RelaySession & { drop(code?: number): void } {
  let close: (code: number) => void = () => undefined
  const closed = new Promise<number>((resolve) => {
    close = resolve
  })
  const ready = outcome === 'open' ? Promise.resolve() : Promise.reject(new Error('refused'))
  ready.catch(() => undefined)
  return { ready, closed, close: () => close(1001), drop: (code = 1012) => close(code) }
}

describe('home relay', () => {
  const tick = () => new Promise((resolve) => setImmediate(resolve))

  test('stays on the fastest relay across drops and moves only after repeated failures', async () => {
    const plan: Record<string, Array<'open' | 'fail'>> = {
      [BR]: ['open', 'open', 'fail', 'fail', 'fail'],
      [US]: ['open'],
    }
    const sessions: Array<{ url: string; session: ReturnType<typeof fakeSession> }> = []
    const homes: Array<string | null> = []
    const relay = new HomeRelay({
      relays: [US, BR],
      logger: silentLogger,
      measure: async (urls) => urls.map((url) => ({ url, rttMs: url === BR ? 15 : 180 })),
      connect: (url) => {
        const session = fakeSession(plan[url]?.shift() ?? 'fail')
        sessions.push({ url, session })
        return session
      },
      sleep: async () => undefined,
    })
    relay.onChange((home) => homes.push(home))
    relay.start()
    await tick()
    expect(relay.current).toBe(BR)
    // A relay restart: back on the same relay.
    sessions.at(-1)?.session.drop(1012)
    await tick()
    await tick()
    expect(sessions.map((s) => s.url)).toEqual([BR, BR])
    // It goes down for good: three failures, then the US relay.
    sessions.at(-1)?.session.drop(1006)
    for (let i = 0; i < 10; i++) await tick()
    expect(sessions.map((s) => s.url)).toEqual([BR, BR, BR, BR, BR, US])
    expect(FAILOVER_AFTER).toBe(3)
    expect(homes).toEqual([BR, US])
    await relay.stop()
  })

  test('keeps trying while no relay answers', async () => {
    let measured = 0
    const relay = new HomeRelay({
      relays: [US],
      logger: silentLogger,
      measure: async (urls) => {
        measured += 1
        return urls.map((url) => ({ url, rttMs: measured >= 3 ? 30 : null }))
      },
      connect: () => fakeSession('open'),
      sleep: async () => undefined,
    })
    relay.start()
    for (let i = 0; i < 10; i++) await tick()
    expect(measured).toBe(3)
    expect(relay.current).toBe(US)
    await relay.stop()
  })
})

describe('paths config', () => {
  test('defaults, a self-hosted relay, and both paths off refused', async () => {
    const { ConfigSchema, DEFAULT_RELAYS } = await import('../src/core/config.ts')
    const profiles = [{ id: 'p', name: 'P', configDir: '~/.claude', color: '#fff' }]
    expect(ConfigSchema.parse({ profiles })).toMatchObject({
      relays: DEFAULT_RELAYS,
      relay: 'on',
      direct: 'on',
    })
    expect(ConfigSchema.parse({ profiles, relays: ['wss://relay.example.com'] }).relays).toEqual([
      'wss://relay.example.com',
    ])
    expect(ConfigSchema.safeParse({ profiles, relays: ['https://relay.example.com'] }).success).toBe(false)
    const both = ConfigSchema.safeParse({ profiles, relay: 'off', direct: 'off' })
    expect(both.success).toBe(false)
    expect(both.error?.issues[0]?.message).toMatch(/both be off/)
  })
})
