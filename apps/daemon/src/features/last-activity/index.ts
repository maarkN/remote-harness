import type { DaemonContext } from '../../main.ts'
import type { SessionStore } from '../sessions/store.ts'
import { LastActivityTracker, type TailReader } from './tracker.ts'

/** Fills each session's `lastActivity` from its transcript tail as it shows activity. */
export function registerLastActivityFeature(ctx: DaemonContext, store: SessionStore, read: TailReader) {
  const tracker = new LastActivityTracker(store, read, ctx.logger)
  store.onChange((next, previous) => {
    if (LastActivityTracker.isActivity(next, previous)) tracker.request(next.id)
  })
  ctx.bus.on('hook', (hook) => tracker.request(hook.payload.session_id))
  ctx.onStop(() => tracker.dispose())
  return { tracker }
}
