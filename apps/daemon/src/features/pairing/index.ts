import { bytesToBase64Url, CHANNEL_CLOSE, PAIRING_CODE_TTL_MS } from '@remote-harness/protocol'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { DaemonError } from '../../core/errors.ts'
import type { EventBus } from '../../core/event-bus.ts'
import type { DaemonEvents } from '../../core/events.ts'
import { type DaemonIdentity, noiseCrypto } from '../../core/identity.ts'
import type { Logger } from '../../core/logger.ts'
import { pairingLink } from '../../core/pairing.ts'
import { paths } from '../../core/paths.ts'
import type { ClientHub, Connection } from '../../transport/connection.ts'
import type { MessageRouter } from '../../transport/router.ts'
import type { SecureConnectionDeps } from '../../transport/secure-connection.ts'
import { type CodeState, type LiveCode, PairingCodes } from './codes.ts'
import { deviceInfoOf, MAX_PAIRED_DEVICES, PairedDevices } from './devices.ts'

/** `id`: the code's pairing ID (base64url), which names it in `pairing.progress` and the CLI. */
export type PairingLink = { url: string; expiresAt: number; id: string }

export type PairingFeature = {
  hooks: SecureConnectionDeps['hooks']
  devices: PairedDevices
  /** A fresh single-use code (CLI, setup, `pairing.create`); null while there is no path to offer. */
  create(): PairingLink | null
  /** The tray's code, reused while more than a minute is left. */
  current(): PairingLink | null
  /** Where a code stands (waiting, presented with its confirmation code, paired, locked, expired). */
  state(id: string): CodeState
  /** Unpairs a device: closes its connections and tells the other features. */
  revoke(deviceId: string): Promise<boolean>
}

export type PairingOptions = {
  identity: DaemonIdentity
  hooks: FastifyInstance
  router: MessageRouter
  hub: ClientHub
  bus: EventBus<DaemonEvents>
  logger: Logger
  /** Where devices reach this daemon directly, and its home relay (both may change). */
  addresses: () => string[]
  relay: () => string | null
  name: () => string
  devicesPath?: string
  now?: () => number
}

const RevokeBodySchema = z.object({ id: z.string().min(1) })

/**
 * Pairing codes, the paired devices, their list and revocation (from a device and from the CLI's
 * admin routes) and `pairing.create`.
 */
export async function registerPairingFeature(o: PairingOptions): Promise<PairingFeature> {
  const now = o.now ?? Date.now
  const codes = new PairingCodes(noiseCrypto, now, PAIRING_CODE_TTL_MS)
  const devices = new PairedDevices(o.devicesPath ?? paths.pairedDevices(), now)
  await devices.load()

  const reachable = () => o.addresses().length > 0 || o.relay() !== null
  const link = (code: LiveCode): PairingLink => {
    const relay = o.relay()
    return {
      url: pairingLink({
        identity: o.identity,
        secret: code.secret,
        addresses: o.addresses(),
        name: o.name(),
        ...(relay ? { relay } : {}),
      }),
      expiresAt: code.expiresAt,
      id: code.pairingId,
    }
  }

  // The connection that created a code with `pairing.create` follows it (ADR-0009); nobody else.
  const owners = new Map<string, Connection>()
  const progress = (
    id: string,
    update: { state: 'presented'; code: string } | { state: 'paired' | 'locked' },
  ) => {
    owners.get(id)?.send({ type: 'pairing.progress', id, ...update })
    if (update.state !== 'presented') owners.delete(id)
  }

  const revoke = async (deviceId: string): Promise<boolean> => {
    const removed = await devices.revoke(deviceId)
    if (!removed) return false
    o.hub.closeDevice(deviceId, CHANNEL_CLOSE.revoked, 'device revoked')
    o.bus.emit('device.revoked', { deviceId })
    o.logger.info({ device: deviceId }, 'device revoked')
    return true
  }

  const feature: PairingFeature = {
    devices,
    hooks: {
      pairingSecret: (pairingId) => codes.secretFor(pairingId),
      pairingConfirmation: (pairingId) => codes.confirmationFor(pairingId),
      presented: (pairingId) => {
        const shown = codes.present(pairingId)
        if (!shown) return null
        const id = bytesToBase64Url(pairingId)
        // Never logged: the digits only go where the code was shown.
        if (shown.created) o.bus.emit('pairing.presented', { pairingId: id })
        progress(id, { state: 'presented', code: shown.code })
        return shown.code
      },
      wrongConfirmation: (pairingId) => {
        const outcome = codes.wrongConfirmation(pairingId)
        const id = bytesToBase64Url(pairingId)
        if (outcome === 'locked') {
          o.logger.warn('pairing code burned after 3 wrong confirmation codes')
          o.bus.emit('pairing.locked', { pairingId: id })
          progress(id, { state: 'locked' })
        } else o.logger.warn('wrong confirmation code')
        return outcome
      },
      isPaired: (deviceKey) => devices.has(deviceKey),
      paired: async (pairingId, deviceKey, device) => {
        // The limit is checked before the code is used up, so a refused device does not burn it.
        if (!devices.has(deviceKey) && devices.devices().length >= MAX_PAIRED_DEVICES)
          return { ok: false, code: CHANNEL_CLOSE.deviceLimit, reason: 'device limit reached' }
        if (!codes.consume(pairingId))
          return { ok: false, code: CHANNEL_CLOSE.pairingRefused, reason: 'pairing code used or expired' }
        await devices.add(deviceKey, device)
        progress(bytesToBase64Url(pairingId), { state: 'paired' })
        return { ok: true }
      },
      seen: (deviceKey, app) => {
        devices
          .touch(deviceKey, app)
          .catch((error: unknown) => o.logger.warn({ err: error }, 'device last seen not saved'))
      },
    },
    create: () => (reachable() ? link(codes.create()) : null),
    current: () => (reachable() ? link(codes.current()) : null),
    state: (id) => codes.state(id),
    revoke,
  }

  o.router.register('devices.list', (_msg, connection) => ({
    type: 'devices.result',
    devices: devices.devices().map((d) => deviceInfoOf(d, connection.deviceId)),
  }))
  o.router.register('devices.rename', async (msg, connection) => {
    if (!(await devices.rename(msg.deviceId, msg.name)))
      throw new DaemonError('not_found', `no device ${msg.deviceId}`)
    o.bus.emit('device.renamed', { deviceId: msg.deviceId })
    o.logger.info({ device: msg.deviceId }, 'device renamed')
    return {
      type: 'devices.result',
      devices: devices.devices().map((d) => deviceInfoOf(d, connection.deviceId)),
    }
  })
  o.router.register('devices.revoke', async (msg) => {
    if (!(await revoke(msg.deviceId))) throw new DaemonError('not_found', `no device ${msg.deviceId}`)
    return undefined
  })
  o.router.register('pairing.create', (_msg, connection) => {
    const created = feature.create()
    if (!created) throw new DaemonError('internal', 'no path to offer yet')
    owners.set(created.id, connection)
    connection.onClose(() => {
      if (owners.get(created.id) === connection) owners.delete(created.id)
    })
    return {
      type: 'pairing.code',
      url: created.url,
      expiresAt: new Date(created.expiresAt).toISOString(),
      id: created.id,
    }
  })

  o.hooks.post('/admin/pairing-code', async (_request, reply) => {
    const created = feature.create()
    if (!created) return reply.code(503).send({ error: 'not listening yet' })
    o.logger.info('pairing code created')
    return created
  })
  // `remote-harness pair` and the setup wait on their code here (only with the hooks secret).
  o.hooks.get<{ Params: { id: string } }>('/admin/pairing-code/:id', async (request) =>
    codes.state(request.params.id),
  )
  o.hooks.get('/admin/devices', async () => ({ devices: devices.devices().map((d) => deviceInfoOf(d)) }))
  o.hooks.post('/admin/devices/revoke', async (request, reply) => {
    const body = RevokeBodySchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: 'id required' })
    if (!(await revoke(body.data.id))) return reply.code(404).send({ error: 'no such device' })
    return { ok: true }
  })
  return feature
}
