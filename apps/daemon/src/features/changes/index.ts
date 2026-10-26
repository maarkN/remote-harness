import { DaemonError } from '../../core/errors.ts'
import { GitClient, GitError } from '../../infra/git.ts'
import type { DaemonContext } from '../../main.ts'
import type { SessionStore } from '../sessions/store.ts'
import { ChangesService } from './service.ts'

/** git's own message reaches the app that asked (a timeout, a broken repository), not the logs. */
async function gitErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof GitError) throw new DaemonError('internal', error.message)
    throw error
  }
}

/** `changes.list` and `changes.diff`: reviewing a session's working tree, whatever the session does. */
export function registerChangesFeature(ctx: DaemonContext, store: SessionStore) {
  const service = new ChangesService(new GitClient(ctx.exec), store)
  ctx.router.register('changes.list', async (msg) => ({
    type: 'changes.result',
    ...(await gitErrors(() => service.list(msg.sessionId))),
  }))
  ctx.router.register('changes.diff', async (msg) => ({
    type: 'changes.diffResult',
    ...(await gitErrors(() => service.diff(msg.sessionId, msg.path, msg.offset))),
  }))
  return { service }
}
