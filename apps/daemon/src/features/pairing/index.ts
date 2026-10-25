import { CHANNEL_CLOSE, PAIRING_CODE_TTL_MS } from '@remote-harness/protocol'
import type { FastifyInstance } from 'fastify'
import { type DaemonIdentity, noiseCrypto } from '../../core/identity.ts'
import type { Logger } from '../../core/logger.ts'
import { pairingLink } from '../../core/pairing.ts'
import { paths } from '../../core/paths.ts'
import type { SecureConnectionDeps } from '../../transport/secure-connection.ts'
import { type LiveCode, PairingCodes } from './codes.ts'
import { MAX_PAIRED_DEVICES, PairedDevices } from './devices.ts'

export type PairingLink = { url: string; expiresAt: number }

export type PairingFeature = {
  hooks: SecureConnectionDeps['hooks']
  devices: PairedDevices
  /** A fresh single-use code (CLI, setup); null until the daemon listens. */
  create(): PairingLink | null
  /** The tray's code, reused while more than a minute is left. */
  current(): PairingLink | null
}

export type PairingOptions = {
  identity: DaemonIdentity
  hooks: FastifyInstance
  logger: Logger
  /** Where devices reach this daemon directly, once the WebSocket listens. */
  addresses: () => string[]
  name: () => string
  devicesPath?: string
  now?: () => number
}

/** Pairing codes, the paired devices and `POST /admin/pairing-code` for the CLI and the setup. */
export async function registerPairingFeature(o: PairingOptions): Promise<PairingFeature> {
  const now = o.now ?? Date.now
  const codes = new PairingCodes(noiseCrypto, now, PAIRING_CODE_TTL_MS)
  const devices = new PairedDevices(o.devicesPath ?? paths.pairedDevices(), now)
  await devices.load()

  const link = (code: LiveCode): PairingLink | null => {
    const addresses = o.addresses()
    if (addresses.length === 0) return null
    return {
      url: pairingLink({ identity: o.identity, secret: code.secret, addresses, name: o.name() }),
      expiresAt: code.expiresAt,
    }
  }

  const feature: PairingFeature = {
    devices,
    hooks: {
      pairingSecret: (pairingId) => codes.secretFor(pairingId),
      isPaired: (deviceKey) => devices.has(deviceKey),
      paired: async (pairingId, deviceKey, device) => {
        // The limit is checked before the code is used up, so a refused device does not burn it.
        if (!devices.has(deviceKey) && devices.devices().length >= MAX_PAIRED_DEVICES)
          return { ok: false, code: CHANNEL_CLOSE.deviceLimit, reason: 'device limit reached' }
        if (!codes.consume(pairingId))
          return { ok: false, code: CHANNEL_CLOSE.pairingRefused, reason: 'pairing code used or expired' }
        await devices.add(deviceKey, device)
        return { ok: true }
      },
    },
    create: () => (o.addresses().length > 0 ? link(codes.create()) : null),
    current: () => (o.addresses().length > 0 ? link(codes.current()) : null),
  }

  o.hooks.post('/admin/pairing-code', async (_request, reply) => {
    const created = feature.create()
    if (!created) return reply.code(503).send({ error: 'not listening yet' })
    o.logger.info('pairing code created')
    return created
  })
  return feature
}
