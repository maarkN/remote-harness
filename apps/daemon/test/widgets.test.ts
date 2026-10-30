import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { paths } from '../src/core/paths.ts'
import { DeviceRegistry } from '../src/features/push/devices.ts'
import { buildPush, buildSilent } from '../src/features/push/sender.ts'
import { WidgetRefresher, widgetSignature } from '../src/features/widgets/refresh.ts'
import { useTempHome } from './helpers.ts'

useTempHome()

describe('widgetSignature', () => {
  test('counts waiting (state or pending request) and running, ignores ended, lists requests', () => {
    const sessions = [
      { id: 'a', state: 'running' as const },
      { id: 'b', state: 'running' as const },
      { id: 'c', state: 'waiting' as const },
      { id: 'd', state: 'idle' as const },
      { id: 'e', state: 'ended' as const },
    ]
    const pending = [
      { requestId: 'r2', sessionId: 'b' },
      { requestId: 'r1', sessionId: 'b' },
    ]
    expect(widgetSignature(sessions, pending)).toBe('2|1|r1,r2')
    expect(widgetSignature(sessions, [])).toBe('1|2|')
  })
})

describe('WidgetRefresher', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup(canSend = () => true) {
    let signature = 'a'
    const sent: string[] = []
    const refresher = new WidgetRefresher({
      signature: () => signature,
      canSend,
      send: async () => {
        sent.push(signature)
      },
      now: () => Date.now(),
      intervalMs: 30_000,
    })
    return { refresher, sent, set: (next: string) => (signature = next) }
  }

  test('sends at once, then at most once per interval with the latest signature', () => {
    const { refresher, sent, set } = setup()
    set('b')
    refresher.changed()
    expect(sent).toEqual(['b'])
    for (const next of ['c', 'd', 'e']) {
      set(next)
      refresher.changed()
    }
    expect(sent).toEqual(['b'])
    vi.advanceTimersByTime(30_000)
    expect(sent).toEqual(['b', 'e'])
  })

  test('no push when nothing widgets show changed', () => {
    const { refresher, sent } = setup()
    refresher.changed()
    vi.advanceTimersByTime(60_000)
    expect(sent).toEqual([])
  })

  test('changes while sending is not allowed only move the baseline', () => {
    let allowed = false
    const { refresher, sent, set } = setup(() => allowed)
    set('b')
    refresher.changed()
    allowed = true
    refresher.changed()
    expect(sent).toEqual([])
    set('c')
    refresher.changed()
    expect(sent).toEqual(['c'])
  })
})

describe('silent push', () => {
  test('data only: iOS background push, Android normal priority with a collapse key', () => {
    const message = {
      title: '',
      body: '',
      data: { event: 'widgets', daemonId: 'd1' },
      silent: true,
      collapseKey: 'widgets',
    }
    const payload = buildSilent(['t'], message)
    expect(payload).toEqual({
      tokens: ['t'],
      data: { event: 'widgets', daemonId: 'd1' },
      apns: {
        headers: { 'apns-push-type': 'background', 'apns-priority': '5' },
        payload: { aps: { contentAvailable: true } },
      },
      android: { priority: 'normal', collapseKey: 'widgets' },
    })
    expect(buildPush(['t'], message)).toEqual(payload)
    expect(payload).not.toHaveProperty('notification')
  })
})

describe('device registration with widgets', () => {
  test('keeps the widgets flag with the token', async () => {
    const devices = new DeviceRegistry(paths.devices())
    await devices.register('iphone', 'ios', undefined, 'dev-a', { widgets: true })
    await devices.register('pixel', 'android', undefined, 'dev-b', { turnActions: true })
    const again = new DeviceRegistry(paths.devices())
    await again.load()
    expect(again.devices().map((d) => [d.token, d.widgets, d.turnActions])).toEqual([
      ['pixel', undefined, true],
      ['iphone', true, undefined],
    ])
  })
})

describe('integration: device.register with widgets', () => {
  test('stores the flag sent by the app', async () => {
    const { readFile } = await import('node:fs/promises')
    const { startDaemon } = await import('../src/main.ts')
    const { FileTokenStore } = await import('../src/core/secrets.ts')
    const { silentLogger } = await import('../src/core/logger.ts')
    const { fakeExecutor, writeTestConfig } = await import('./helpers.ts')
    const { authedClient } = await import('./noise-client.ts')
    const root = paths.devices().replace(/\/\.remote-harness\/devices\.json$/, '')
    await writeTestConfig(root, ['claudin'])
    const daemon = await startDaemon({
      logger: silentLogger,
      exec: fakeExecutor(),
      secretStore: new FileTokenStore(),
      dev: true,
      wsPort: 0,
      hookPort: 0,
      pushSender: null,
    })
    const client = await authedClient(daemon)
    try {
      client.send({ type: 'device.register', id: '2', fcmToken: 'iphone', platform: 'ios', widgets: true })
      await client.until('ack')
      const saved = JSON.parse(await readFile(paths.devices(), 'utf8'))
      expect(saved.tokens).toMatchObject([{ token: 'iphone', platform: 'ios', widgets: true }])
    } finally {
      client.close()
      await daemon.stop()
    }
  })
})
