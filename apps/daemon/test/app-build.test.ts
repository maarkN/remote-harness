import { DeviceHandshake, PROTOCOL_VERSION } from '@remote-harness/protocol'
import pino from 'pino'
import { describe, expect, test, vi } from 'vitest'
import { noiseCrypto } from '../src/core/identity.ts'
import { ClientHub } from '../src/transport/connection.ts'
import { MessageRouter } from '../src/transport/router.ts'
import { startWsServer } from '../src/transport/ws-server.ts'
import { noiseConnect } from './noise-client.ts'

const daemonKey = noiseCrypto.generateKeyPair()

async function connectAndAuth(app?: unknown) {
  const lines: Array<Record<string, unknown>> = []
  const logger = pino({ level: 'info' }, { write: (text: string) => lines.push(JSON.parse(text)) })
  const seen = vi.fn()
  const wss = await startWsServer({
    host: '127.0.0.1',
    port: 0,
    staticKey: daemonKey,
    hooks: { pairingSecret: () => null, isPaired: () => true, paired: async () => ({ ok: true }), seen },
    router: new MessageRouter(logger),
    hub: new ClientHub(),
    logger,
    hello: () => ({ protocolVersion: PROTOCOL_VERSION }) as never,
  })
  const address = wss.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const deviceKey = noiseCrypto.generateKeyPair()
  const client = noiseConnect(
    port,
    DeviceHandshake.reconnect(noiseCrypto, { deviceKey, daemonKey: daemonKey.publicKey }),
    deviceKey,
  )
  await client.ready
  client.send({ type: 'auth', protocolVersion: PROTOCOL_VERSION, ...(app ? { app } : {}) } as never)
  expect(await client.next()).toMatchObject({ type: 'auth.ok' })
  client.close()
  await new Promise<void>((resolve) => wss.close(() => resolve()))
  return { authenticated: lines.find((l) => l.msg === 'client authenticated'), seen, deviceKey }
}

describe('the app build of each phone (#591)', () => {
  test('`client authenticated` carries the build and the device record gets it', async () => {
    const app = { version: '1.2.2', runtime: 'a1b2c3', update: '0199f2d4-1c2b-7a3e-9b1f-2a3c4d5e6f70' }
    const { authenticated, seen, deviceKey } = await connectAndAuth(app)
    expect(authenticated).toMatchObject({ app })
    expect(seen).toHaveBeenCalledWith(deviceKey.publicKey, app)
  })

  test('an app that sends no build, or a malformed one, still connects', async () => {
    for (const app of [undefined, { version: 42 }]) {
      const { authenticated, seen } = await connectAndAuth(app)
      expect(authenticated).toBeDefined()
      expect(authenticated).not.toHaveProperty('app')
      expect(seen).toHaveBeenCalledWith(expect.any(Uint8Array), undefined)
    }
  })
})
