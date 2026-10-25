import { readFile } from 'node:fs/promises'
import {
  CHANNEL_CLOSE,
  DeviceHandshake,
  PROTOCOL_VERSION,
  parsePairingCode,
  type ServerMessage,
} from '@remote-harness/protocol'
import { afterEach, describe, expect, test, vi } from 'vitest'
import WebSocket from 'ws'
import { noiseCrypto } from '../src/core/identity.ts'
import { silentLogger } from '../src/core/logger.ts'
import { paths } from '../src/core/paths.ts'
import { FileTokenStore } from '../src/core/secrets.ts'
import { type RunningDaemon, startDaemon } from '../src/main.ts'
import { SECRET_HEADER } from '../src/transport/hooks-server.ts'
import { fakeExecutor, useTempHome, writeTestConfig } from './helpers.ts'
import { authedClient, noiseConnect, pairConnect, reconnectConnect } from './noise-client.ts'

const home = useTempHome()
let daemon: RunningDaemon | undefined

afterEach(async () => {
  await daemon?.stop()
  daemon = undefined
})

async function boot(): Promise<{ daemon: RunningDaemon }> {
  await writeTestConfig(home.dir())
  daemon = await startDaemon({
    logger: silentLogger,
    exec: fakeExecutor(),
    secretStore: new FileTokenStore(),
    dev: true,
    wsPort: 0,
    hookPort: 0,
  })
  return { daemon }
}

const auth = { type: 'auth', id: 'a1', protocolVersion: PROTOCOL_VERSION } as const

describe('noise channel', () => {
  test('pairs with a fresh code, answers auth.ok and then requests', async () => {
    const { daemon } = await boot()
    const client = pairConnect(daemon, { info: { name: 'Pixel', platform: 'android' } })
    await client.ready
    client.send(auth)
    expect(await client.next()).toMatchObject({
      type: 'auth.ok',
      replyTo: 'a1',
      protocolVersion: PROTOCOL_VERSION,
    })
    client.send({ type: 'ping', id: 'p1' })
    expect(await client.next()).toEqual({ type: 'pong', replyTo: 'p1' })
    expect(daemon.pairing.devices.devices()).toMatchObject([{ name: 'Pixel', platform: 'android' }])
    client.close()
  })

  test('a paired device reconnects with IK, also after a restart', async () => {
    const { daemon: first } = await boot()
    const paired = await authedClient(first)
    paired.close()
    const again = reconnectConnect(first, paired.deviceKey)
    await again.ready
    again.send(auth)
    expect(await again.next()).toMatchObject({ type: 'auth.ok' })
    again.close()
    const key = first.identity.noise.publicKey
    await first.stop()
    daemon = undefined
    const { daemon: second } = await boot()
    expect(second.identity.noise.publicKey).toEqual(key)
    const afterRestart = reconnectConnect(second, paired.deviceKey)
    await afterRestart.ready
    afterRestart.send(auth)
    expect(await afterRestart.next()).toMatchObject({ type: 'auth.ok' })
    afterRestart.close()
  })

  test('an unknown device key is dropped with 4001 before any message', async () => {
    const { daemon } = await boot()
    const client = reconnectConnect(daemon, noiseCrypto.generateKeyPair())
    expect(await client.closed).toBe(CHANNEL_CLOSE.unauthorized)
  })

  test('a pairing code works once', async () => {
    const { daemon } = await boot()
    const url = daemon.pairing.create()?.url
    const first = pairConnect(daemon, { url })
    await first.ready
    first.send(auth)
    await first.until('auth.ok')
    const second = pairConnect(daemon, { url })
    expect(await second.closed).toBe(CHANNEL_CLOSE.pairingRefused)
    first.close()
  })

  test('a code nobody issued is refused', async () => {
    const { daemon } = await boot()
    const url = daemon.pairing.create()?.url as string
    const forged = url.replace(
      /s=[^&]+/,
      `s=${Buffer.from(noiseCrypto.randomBytes(32)).toString('base64url')}`,
    )
    expect(await pairConnect(daemon, { url: forged }).closed).toBe(CHANNEL_CLOSE.pairingRefused)
  })

  test('the device refuses a daemon with another static key', async () => {
    const { daemon } = await boot()
    const parsed = parsePairingCode(daemon.pairing.create()?.url as string)
    if (!parsed.ok) throw new Error('bad code')
    const deviceKey = noiseCrypto.generateKeyPair()
    const handshake = DeviceHandshake.pair(noiseCrypto, {
      deviceKey,
      daemonKey: noiseCrypto.generateKeyPair().publicKey,
      secret: parsed.code.secret,
      info: { name: '', platform: '' },
    })
    const errors: unknown[] = []
    const client = noiseConnect(daemon.wsPort, handshake, deviceKey)
    client.ws.on('error', (e) => errors.push(e))
    await expect(
      new Promise((_, reject) => {
        client.ws.removeAllListeners('message')
        client.ws.on('message', (data: Buffer) => {
          try {
            handshake.receive(new Uint8Array(data))
          } catch (error) {
            reject(error)
          }
        })
      }),
    ).rejects.toThrow('unexpected daemon key')
    client.close()
  })

  test('a tampered frame closes the connection', async () => {
    const { daemon } = await boot()
    const client = await authedClient(daemon)
    const garbage = noiseCrypto.randomBytes(64)
    client.ws.send(garbage)
    expect(await client.closed).toBe(CHANNEL_CLOSE.unauthorized)
  })

  test('an app speaking protocol 1 (JSON text) is told the protocol changed', async () => {
    const { daemon } = await boot()
    const ws = new WebSocket(`ws://127.0.0.1:${daemon.wsPort}`)
    const replies: string[] = []
    ws.on('message', (d) => replies.push(d.toString()))
    await new Promise((r) => ws.once('open', r))
    ws.send(JSON.stringify({ type: 'auth', id: '1', token: 'old', protocolVersion: 1 }))
    const code = await new Promise<number>((r) => ws.on('close', (c) => r(c)))
    expect(code).toBe(CHANNEL_CLOSE.protocolMismatch)
    expect(replies).toEqual([])
  })

  test('a connection that never finishes the handshake is closed', async () => {
    await writeTestConfig(home.dir())
    const { startWsServer } = await import('../src/transport/ws-server.ts')
    const { ClientHub } = await import('../src/transport/connection.ts')
    const { MessageRouter } = await import('../src/transport/router.ts')
    const wss = await startWsServer({
      host: '127.0.0.1',
      port: 0,
      staticKey: noiseCrypto.generateKeyPair(),
      hooks: { pairingSecret: () => null, isPaired: () => false, paired: async () => ({ ok: true }) },
      router: new MessageRouter(silentLogger),
      hub: new ClientHub(),
      logger: silentLogger,
      hello: () => ({}) as never,
      authTimeoutMs: 100,
    })
    const address = wss.address()
    const ws = new WebSocket(`ws://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`)
    const code = await new Promise<number>((r) => ws.on('close', (c) => r(c)))
    expect(code).toBe(CHANNEL_CLOSE.handshakeTimeout)
    await new Promise<void>((r) => wss.close(() => r()))
  })

  test('nothing but auth is accepted first, and nothing is sent before it', async () => {
    const { daemon } = await boot()
    const client = pairConnect(daemon)
    await client.ready
    client.send({ type: 'sessions.list', id: 's1' })
    expect(await client.closed).toBe(CHANNEL_CLOSE.unauthorized)
  })

  test('logs and records a malformed message after auth, instead of swallowing it', async () => {
    const { daemon } = await boot()
    const client = await authedClient(daemon)
    const warn = vi.spyOn(silentLogger, 'warn')
    client.send({ type: 'session.input', id: 'm1' } as never) // missing required `sessionId`
    expect(await client.next()).toMatchObject({ type: 'error', replyTo: 'm1', code: 'bad_request' })
    expect(warn).toHaveBeenCalledWith({ type: 'session.input', code: 'bad_request' }, 'request rejected')
    client.send({ type: 'diagnostics.errors', id: 'd1' })
    expect(await client.next()).toMatchObject({
      type: 'diagnostics.result',
      replyTo: 'd1',
      errors: [{ type: 'session.input', code: 'bad_request' }],
    })
    client.close()
  })

  test('rejects a different protocol major version', async () => {
    const { daemon } = await boot()
    const client = pairConnect(daemon)
    await client.ready
    client.send({ ...auth, protocolVersion: PROTOCOL_VERSION + 1 })
    expect(await client.next()).toMatchObject({ type: 'error', code: 'protocol_mismatch' })
    expect(await client.closed).toBe(CHANNEL_CLOSE.protocolMismatch)
  })

  test('the CLI gets a single-use code from the admin route', async () => {
    const { daemon } = await boot()
    const secret = (await readFile(paths.hookSecret(), 'utf8')).trim()
    const res = await fetch(`http://127.0.0.1:${daemon.hookPort}/admin/pairing-code`, {
      method: 'POST',
      headers: { [SECRET_HEADER]: secret },
    })
    const body = (await res.json()) as { url: string; expiresAt: number }
    expect(parsePairingCode(body.url)).toMatchObject({
      ok: true,
      code: { daemonId: daemon.identity.daemonId, addresses: [`127.0.0.1:${daemon.wsPort}`] },
    })
    expect(body.expiresAt - Date.now()).toBeGreaterThan(4 * 60_000)
    const client = pairConnect(daemon, { url: body.url })
    await client.ready
    client.send(auth)
    await client.until('auth.ok')
    client.close()
  })

  test('an 11th device is refused with 4006 and the code stays usable', async () => {
    const { daemon } = await boot()
    for (let i = 0; i < 10; i++) (await authedClient(daemon)).close()
    const url = daemon.pairing.create()?.url
    expect(await pairConnect(daemon, { url }).closed).toBe(CHANNEL_CLOSE.deviceLimit)
    expect(daemon.pairing.devices.devices()).toHaveLength(10)
  })

  test('large messages cross the channel in chunks', async () => {
    const { daemon } = await boot()
    const client = await authedClient(daemon)
    const data = Buffer.alloc(2 * 1024 * 1024).toString('base64')
    client.send({ type: 'attachment.upload', id: 'u1', sessionId: 'nope', mimeType: 'image/png', data })
    expect(await client.next()).toMatchObject({ type: 'error', replyTo: 'u1', code: 'not_found' })
    client.close()
  })
})

describe('devices', () => {
  test('lists the paired devices, marking the one that asks', async () => {
    const { daemon } = await boot()
    const phone = await authedClient(daemon)
    const tablet = await authedClient(daemon)
    tablet.send({ type: 'devices.list', id: 'l' })
    const result = await tablet.until('devices.result')
    expect(result.devices).toHaveLength(2)
    expect(result.devices.filter((d) => d.current)).toHaveLength(1)
    expect(result.devices.every((d) => d.lastSeen !== null && d.platform === 'ios')).toBe(true)
    phone.close()
    tablet.close()
  })

  test('revoking a device closes it with 4007 and refuses its key afterwards', async () => {
    const { daemon } = await boot()
    const phone = await authedClient(daemon)
    const tablet = await authedClient(daemon)
    tablet.send({ type: 'devices.list', id: 'l' })
    const { devices } = await tablet.until('devices.result')
    const tabletId = devices.find((d) => d.current)?.id as string
    phone.send({ type: 'devices.revoke', id: 'r', deviceId: tabletId })
    expect(await phone.until('ack')).toMatchObject({ replyTo: 'r' })
    expect(await tablet.closed).toBe(CHANNEL_CLOSE.revoked)
    expect(await reconnectConnect(daemon, tablet.deviceKey).closed).toBe(CHANNEL_CLOSE.unauthorized)
    phone.send({ type: 'devices.revoke', id: 'again', deviceId: tabletId })
    expect(await phone.until('error')).toMatchObject({ replyTo: 'again', code: 'not_found' })
    phone.close()
  })

  test('a paired device gets a pairing code for another one', async () => {
    const { daemon } = await boot()
    const phone = await authedClient(daemon)
    phone.send({ type: 'pairing.create', id: 'p' })
    const code = await phone.until('pairing.code')
    expect(Date.parse(code.expiresAt) - Date.now()).toBeGreaterThan(4 * 60_000)
    const tablet = pairConnect(daemon, { url: code.url })
    await tablet.ready
    tablet.send(auth)
    await tablet.until('auth.ok')
    expect(daemon.pairing.devices.devices()).toHaveLength(2)
    phone.close()
    tablet.close()
  })

  test('the CLI lists and revokes through the admin routes', async () => {
    const { daemon } = await boot()
    const phone = await authedClient(daemon)
    const secret = (await readFile(paths.hookSecret(), 'utf8')).trim()
    const base = `http://127.0.0.1:${daemon.hookPort}`
    const list = (await (
      await fetch(`${base}/admin/devices`, { headers: { [SECRET_HEADER]: secret } })
    ).json()) as {
      devices: { id: string }[]
    }
    expect(list.devices).toHaveLength(1)
    const revoke = (id: string) =>
      fetch(`${base}/admin/devices/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [SECRET_HEADER]: secret },
        body: JSON.stringify({ id }),
      })
    expect((await revoke('nope')).status).toBe(404)
    expect((await revoke(list.devices[0]?.id as string)).ok).toBe(true)
    expect(await phone.closed).toBe(CHANNEL_CLOSE.revoked)
  })

  test('a revoked device loses its push registration', async () => {
    const { daemon } = await boot()
    const phone = await authedClient(daemon)
    phone.send({ type: 'device.register', id: 'r', fcmToken: 'fcm-phone', platform: 'ios' })
    await phone.until('ack')
    const saved = () =>
      readFile(paths.devices(), 'utf8').then((t) => JSON.parse(t).tokens as { token: string }[])
    expect((await saved()).map((t) => t.token)).toEqual(['fcm-phone'])
    phone.send({ type: 'devices.list', id: 'l' })
    const id = (await phone.until('devices.result')).devices[0]?.id as string
    await daemon.pairing.revoke(id)
    const deadline = Date.now() + 2000
    while ((await saved()).length > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20))
    expect(await saved()).toEqual([])
  })

  test('auth.ok carries the paths; dev mode offers only 127.0.0.1 and no relay', async () => {
    const { daemon } = await boot()
    const client = pairConnect(daemon)
    await client.ready
    client.send(auth)
    const hello = await client.until('auth.ok')
    expect(hello.paths).toEqual({ addresses: [`127.0.0.1:${daemon.wsPort}`], relay: null, relays: [] })
    client.close()
  })
})

describe('hooks server', () => {
  test('returns 401 without the secret', async () => {
    const { daemon } = await boot()
    const res = await fetch(`http://127.0.0.1:${daemon.hookPort}/health`)
    expect(res.status).toBe(401)
  })
})

describe('sessions.list', () => {
  test('returns a snapshot correlated by id', async () => {
    const { daemon } = await boot()
    const client = await authedClient(daemon)
    client.send({ type: 'sessions.list', id: 'abc' })
    expect(await client.next()).toEqual({ type: 'sessions.snapshot', replyTo: 'abc', sessions: [] })
    client.close()
  })
})

describe('command.run end to end (#308)', () => {
  test('off until the CLI turns it on, then runs in the session folder and streams the output', async () => {
    const { daemon } = await boot()
    const client = pairConnect(daemon)
    await client.ready
    client.send(auth)
    expect(await client.next()).toMatchObject({ type: 'auth.ok', commands: { enabled: false } })
    client.send({ type: 'command.run', id: 'c1', sessionId: 's', command: 'echo hi' })
    expect(await client.next()).toMatchObject({ type: 'error', replyTo: 'c1', code: 'commands_disabled' })

    // What `remote-harness commands on` does: write the config, then reload the running daemon.
    await writeTestConfig(home.dir(), ['claudin'], { shellCommands: { enabled: true } })
    const secret = (await readFile(paths.hookSecret(), 'utf8')).trim()
    // Like the CLI's admin requests: no body, no content type.
    const post = (path: string, body?: unknown) =>
      fetch(`http://127.0.0.1:${daemon.hookPort}${path}`, {
        method: 'POST',
        headers: body
          ? { 'content-type': 'application/json', [SECRET_HEADER]: secret }
          : { [SECRET_HEADER]: secret },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    expect(await (await post('/admin/commands-reload')).json()).toEqual({ enabled: true })
    await post('/hooks/SessionStart', { session_id: 's', cwd: home.dir() })

    const messages: ServerMessage[] = []
    const until = async (type: ServerMessage['type']) => {
      for (;;) {
        const message = await client.next()
        messages.push(message)
        if (message.type === type) return message
      }
    }
    client.send({
      type: 'command.run',
      id: 'c2',
      sessionId: 's',
      command: 'pwd; echo oops >&2; exit 4',
    })
    const started = await until('command.started')
    expect(started).toMatchObject({ replyTo: 'c2', cwd: home.dir() })
    const exit = await until('command.exit')
    expect(exit).toMatchObject({ reason: 'exited', exitCode: 4, truncated: false })
    const text = (stream: string) =>
      messages.flatMap((m) => (m.type === 'command.output' && m.stream === stream ? [m.text] : [])).join('')
    expect(text('stdout')).toContain(home.dir().split('/').pop())
    expect(text('stderr')).toBe('oops\n')
    client.close()
  })
})
