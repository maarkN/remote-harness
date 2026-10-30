import type { PermissionRequestInfo } from '@remote-harness/protocol'
import type { DaemonContext } from '../../main.ts'
import type { DeviceRegistry } from '../push/devices.ts'
import type { PushSender } from '../push/sender.ts'
import type { SessionStore } from '../sessions/store.ts'
import { WIDGET_REFRESH_EVENT, WidgetRefresher, widgetSignature } from './refresh.ts'

/**
 * Widget refresh push: a data-only push (`event: "widgets"` and the daemon ID, nothing else) to the
 * phones whose app has widgets, when what they show changes. The phone then fetches the sessions
 * and the pending requests itself, over its encrypted connection.
 */
export function registerWidgetsFeature(
  ctx: DaemonContext,
  options: {
    store: SessionStore
    pending: () => readonly PermissionRequestInfo[]
    devices: DeviceRegistry
    sender: PushSender
    pushOn: () => boolean
  },
): { refresher: WidgetRefresher } {
  const { store, pending, devices, sender, pushOn } = options
  const refresher = new WidgetRefresher({
    signature: () => widgetSignature(store.all(), pending()),
    canSend: () => pushOn() && !ctx.hub.hasForegroundClient(),
    send: async () => {
      const targets = devices.devices().filter((d) => d.widgets === true)
      if (targets.length === 0) return
      const data: Record<string, string> = { event: WIDGET_REFRESH_EVENT }
      if (ctx.daemonId) data.daemonId = ctx.daemonId
      try {
        const { invalidTokens } = await sender.send(targets, {
          title: '',
          body: '',
          data,
          silent: true,
          collapseKey: WIDGET_REFRESH_EVENT,
        })
        await devices.remove(invalidTokens)
      } catch (error) {
        ctx.logger.warn({ err: error }, 'widget refresh push failed')
      }
    },
  })
  const changed = () => refresher.changed()
  const offs = [
    store.onChange(changed),
    ctx.bus.on('permission.requested', changed),
    ctx.bus.on('permission.resolved', changed),
  ]
  ctx.onStop(() => {
    refresher.stop()
    for (const off of offs) off()
  })
  return { refresher }
}
