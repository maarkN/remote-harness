import { existsSync } from 'node:fs'
import type { PushMode } from '@remote-harness/protocol'
import { effectiveLocale, loadConfig } from '../../core/config.ts'
import { messagesFor } from '../../core/i18n/index.ts'
import { displayHostName, paths } from '../../core/paths.ts'
import type { DaemonContext } from '../../main.ts'
import { DeviceRegistry } from './devices.ts'
import { type PushSetting, resolvePushMode, SwitchablePushSender } from './mode.ts'
import { createRelaySender } from './relay-sender.ts'
import { createFirebaseSender, type PushSender } from './sender.ts'
import { PushService, type TurnInfo } from './service.ts'

export async function registerPushFeature(
  ctx: DaemonContext,
  options: {
    isMuted: (profileId: string | null, sessionId: string) => boolean
    /** Late hooks of an ended session (an idle notification after `/exit`) send no push. */
    isEnded?: (sessionId: string) => boolean
    /** A session's input and queue, for the actions of its turn pushes. */
    turnInfo?: (sessionId: string) => TurnInfo | null
    sender?: PushSender | null
  },
) {
  const devices = new DeviceRegistry(paths.devices())
  await devices.load()
  // Push follows the paired devices: nothing for a device that was revoked or never paired.
  if (ctx.pairedDeviceIds) await devices.prune(ctx.pairedDeviceIds())
  ctx.bus.on('device.revoked', ({ deviceId }) => {
    devices
      .removeDevice(deviceId)
      .then((tokens) => ctx.bus.emit('push.tokens.dropped', { tokens }))
      .catch((error: unknown) => ctx.logger.warn({ err: error }, 'push registration not removed'))
  })
  const relay = createRelaySender(ctx.logger)
  let firebase: Promise<PushSender | null> | undefined
  /** Inner sender for a mode; the Firebase one is created once (firebase-admin is heavy). */
  const senderFor = async (mode: PushMode): Promise<PushSender | null> => {
    if (options.sender !== undefined) return options.sender
    if (mode === 'off') return null
    if (mode === 'relay') return relay
    firebase ??= createFirebaseSender(paths.firebaseServiceAccount(), ctx.logger)
    return (await firebase) ?? relay
  }
  const modeFor = (setting: PushSetting): PushMode =>
    options.sender === null
      ? 'off'
      : resolvePushMode({ setting, hasServiceAccount: existsSync(paths.firebaseServiceAccount()) })
  const initial = modeFor(ctx.config.push)
  const sender = new SwitchablePushSender(await senderFor(initial), initial)
  ctx.logger.info({ mode: sender.mode }, 'push mode')

  const service = new PushService(sender, devices, ctx.logger, {
    profiles: ctx.profiles,
    hasForegroundClient: () => ctx.hub.hasForegroundClient(),
    isMuted: options.isMuted,
    messages: messagesFor(effectiveLocale(ctx.config)).push,
    mode: () => sender.mode,
    host: displayHostName(ctx.config),
    ...(ctx.daemonId ? { daemonId: ctx.daemonId } : {}),
    ...(options.turnInfo ? { turnInfo: options.turnInfo } : {}),
  })

  ctx.router.register('device.register', async (msg, connection) => {
    await devices.register(msg.fcmToken, msg.platform, msg.relay, connection.deviceId, {
      turnActions: msg.turnActions,
      widgets: msg.widgets,
    })
    return undefined
  })
  // The phone turned push off: it is no longer counted or targeted.
  ctx.router.register('device.unregister', async (msg) => {
    await devices.remove([msg.fcmToken])
    return undefined
  })
  ctx.router.register('app.visibility', (msg, connection) => {
    connection.foreground = msg.foreground
    return undefined
  })
  ctx.router.register('push.test', async (msg) => {
    const { result } = await service.sendTest(msg.fcmToken)
    return { type: 'push.testResult', result }
  })
  /** Applies the config file's `push` setting to the running daemon. */
  const reloadMode = async () => {
    const config = await loadConfig(ctx.logger)
    const mode = modeFor(config.push)
    sender.set(await senderFor(mode), mode)
    ctx.logger.info({ mode: sender.mode }, 'push mode changed')
    return { mode: sender.mode }
  }
  // `remote-harness push on|off` rewrites the config, then asks the running daemon to apply it.
  ctx.hooks.post('/admin/push-mode', reloadMode)
  ctx.hooks.post('/admin/push-test', async () => {
    const { result, sent } = await service.sendTest()
    return { mode: sender.mode, result, sent }
  })
  ctx.bus.on('hook', (hook) => {
    if (options.isEnded?.(hook.payload.session_id)) return
    void service.notify(service.messageForHook(hook))
  })
  ctx.bus.on('permission.requested', (info) => void service.notify(service.messageForPermission(info)))
  ctx.bus.on('permission.reminder', (info) => void service.notify(service.messageForReminder(info)))
  return { service, devices, sender, mode: () => sender.mode, reloadMode }
}
