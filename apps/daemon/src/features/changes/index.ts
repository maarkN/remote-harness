import { DaemonError } from '../../core/errors.ts'
import { GitClient, GitError } from '../../infra/git.ts'
import { GitHubCli, GitHubCliError } from '../../infra/github.ts'
import type { DaemonContext } from '../../main.ts'
import type { SessionStore } from '../sessions/store.ts'
import { ChangeActions } from './actions.ts'
import { MessageWriter } from './generate.ts'
import { ChangesService } from './service.ts'

/** git's and gh's own message reaches the app that asked (a hook, a timeout, a login), not the logs. */
async function toolErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof GitError || error instanceof GitHubCliError)
      throw new DaemonError('internal', error.message)
    throw error
  }
}

/**
 * Reviewing a session's working tree (`changes.list`, `changes.diff`, whatever the session does) and
 * committing, pushing and opening a PR from it (fixed operations, gated on the session's state).
 */
export function registerChangesFeature(ctx: DaemonContext, store: SessionStore) {
  const git = new GitClient(ctx.exec)
  const gh = new GitHubCli(ctx.exec)
  const service = new ChangesService(git, store, () => gh.available())
  const actions = new ChangeActions(service, git, gh)
  const writer = new MessageWriter(service, git, ctx.exec, ctx.profiles)

  ctx.router.register('changes.list', async (msg) => ({
    type: 'changes.result',
    ...(await toolErrors(() => service.list(msg.sessionId))),
  }))
  ctx.router.register('changes.diff', async (msg) => ({
    type: 'changes.diffResult',
    ...(await toolErrors(() => service.diff(msg.sessionId, msg.path, msg.offset))),
  }))
  // Only the session and the outcome are logged: never paths, messages or diffs.
  ctx.router.register('changes.commit', async (msg) => {
    const result = await toolErrors(() => actions.commit(msg.sessionId, msg))
    ctx.logger.info({ sessionId: msg.sessionId, files: msg.paths.length }, 'commit from the app')
    return { type: 'changes.committed', ...result }
  })
  ctx.router.register('changes.push', async (msg) => {
    const result = await toolErrors(() => actions.push(msg.sessionId, msg.force))
    ctx.logger.info({ sessionId: msg.sessionId }, 'push from the app')
    return { type: 'changes.pushed', ...result }
  })
  ctx.router.register('changes.pr', async (msg) => {
    const result = await toolErrors(() => actions.pr(msg.sessionId, msg))
    ctx.logger.info({ sessionId: msg.sessionId }, 'pull request from the app')
    return { type: 'changes.prOpened', ...result }
  })
  ctx.router.register('changes.generate', async (msg) => ({
    type: 'changes.generated',
    ...(await toolErrors(() => writer.generate(msg.sessionId, msg.kind, msg.paths))),
  }))
  return { service, actions, writer }
}
