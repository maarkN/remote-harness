import type { KeyedMutex } from '../../core/keyed-mutex.ts'
import type { DaemonContext } from '../../main.ts'
import type { SessionStore } from '../sessions/store.ts'
import { ModeService } from './service.ts'

export function registerModeFeature(
  ctx: DaemonContext,
  store: SessionStore,
  lock: KeyedMutex,
  hasPendingPermission: (sessionId: string) => boolean,
  /** Submits text in a session's pane, like a prompt from the app. */
  submit: (sessionId: string, text: string) => Promise<void>,
) {
  const service = new ModeService(ctx.tmux, store, lock, hasPendingPermission, { submit })

  // Every confirmed mode change is also announced as session.state.
  store.onChange((session, previous) => {
    if (previous && previous.permissionMode === session.permissionMode && previous.state === session.state)
      return
    ctx.hub.broadcast({
      type: 'session.state',
      sessionId: session.id,
      state: session.state,
      permissionMode: session.permissionMode,
    })
  })

  ctx.router.register('session.setMode', async (msg) => {
    return { type: 'ack', data: await service.change(msg.sessionId, msg.mode) }
  })
  return { service }
}
