import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNEL_CLOSE, normalizeChannelClose, PROTOCOL_VERSION } from '@remote-harness/protocol'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { noiseCrypto } from '../src/core/identity.ts'
import { silentLogger } from '../src/core/logger.ts'
import { FileTokenStore } from '../src/core/secrets.ts'
import { relayDeviceUrl } from '../src/features/connectivity/relays.ts'
import { type RunningDaemon, startDaemon } from '../src/main.ts'
import { fakeExecutor, useTempHome, writeTestConfig } from './helpers.ts'
import { pairConnect, reconnectConnect } from './noise-client.ts'

// End to end against the real connection relay (apps/relay, Go); skipped where Go is not installed.
const hasGo = spawnSync('go', ['version']).status === 0
const RELAY_DIR = join(import.meta.dirname, '..', '..', 'relay')

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

describe.skipIf(!hasGo)('relay path through the Go relay', () => {
  const home = useTempHome()
  let relay: ChildProcess | undefined
  let relayUrl = ''
  let binDir = ''
  let daemon: RunningDaemon | undefined

  beforeAll(async () => {
    binDir = mkdtempSync(join(tmpdir(), 'rh-relay-'))
    const built = spawnSync('go', ['build', '-o', join(binDir, 'relay'), '.'], { cwd: RELAY_DIR })
    if (built.status !== 0) throw new Error(`go build failed: ${built.stderr}`)
    const port = await freePort()
    relay = spawn(join(binDir, 'relay'), [], { env: { ...process.env, RELAY_ADDR: `127.0.0.1:${port}` } })
    relayUrl = `ws://127.0.0.1:${port}`
    const deadline = Date.now() + 10_000
    for (;;) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break
      } catch {
        if (Date.now() > deadline) throw new Error('relay did not start')
        await new Promise((r) => setTimeout(r, 50))
      }
    }
  }, 120_000)

  afterAll(() => {
    relay?.kill('SIGTERM')
    rmSync(binDir, { recursive: true, force: true })
  })

  afterEach(async () => {
    await daemon?.stop()
    daemon = undefined
  })

  async function boot(): Promise<RunningDaemon> {
    // Only the relay path: nothing listens for direct connections.
    await writeTestConfig(home.dir(), ['claudin'], { relays: [relayUrl], direct: 'off' })
    daemon = await startDaemon({
      logger: silentLogger,
      exec: fakeExecutor(),
      secretStore: new FileTokenStore(),
      wsPort: 0,
      hookPort: 0,
      connectivity: { measure: async (urls) => urls.map((url) => ({ url, rttMs: 1 })) },
    })
    const deadline = Date.now() + 10_000
    while (daemon.pairing.current() === null && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 20))
    return daemon
  }

  test('pairs and reconnects through the relay; the pairing code names it', async () => {
    const d = await boot()
    const link = d.pairing.create()
    expect(link?.url).toContain(`r=${encodeURIComponent(relayUrl)}`)
    // The relay accepts devices once the daemon's room is open.
    const via = relayDeviceUrl(relayUrl, d.identity.daemonId)
    let client = pairConnect(d, { url: link?.url, via })
    for (let i = 0; i < 50; i++) {
      const outcome = await client.ready.then(
        () => 'ready',
        () => 'closed',
      )
      if (outcome === 'ready') break
      await new Promise((r) => setTimeout(r, 100))
      client = pairConnect(d, { url: d.pairing.create()?.url, via })
    }
    await client.ready
    client.send({ type: 'auth', id: 'a', protocolVersion: PROTOCOL_VERSION })
    const hello = await client.until('auth.ok')
    expect(hello.paths).toEqual({ addresses: [], relay: relayUrl, relays: [relayUrl] })
    client.close()

    const again = reconnectConnect(d, client.deviceKey, via)
    await again.ready
    again.send({ type: 'auth', id: 'b', protocolVersion: PROTOCOL_VERSION })
    await again.until('auth.ok')
    again.send({ type: 'ping', id: 'p' })
    expect(await again.until('pong')).toMatchObject({ replyTo: 'p' })
    again.close()
  }, 30_000)

  test('an unpaired key is dropped with 4101, which the app reads as 4001', async () => {
    const d = await boot()
    const via = relayDeviceUrl(relayUrl, d.identity.daemonId)
    // Wait until the room is open (a device of an unknown daemon would get 4004).
    for (let i = 0; i < 50; i++) {
      const probe = reconnectConnect(d, noiseCrypto.generateKeyPair(), via)
      const code = await probe.closed
      if (code !== 4004) {
        expect(code).toBe(4101)
        expect(normalizeChannelClose(code)).toBe(CHANNEL_CLOSE.unauthorized)
        return
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error('the daemon never opened its room')
  }, 30_000)
})
