import { loadConfig } from '../../core/config.ts'
import { isDirectory } from '../../infra/fs.ts'
import { type ShellSpawner, spawnShell } from '../../infra/shell.ts'
import type { DaemonContext } from '../../main.ts'
import type { SessionStore } from '../sessions/store.ts'
import { ShellCommandService } from './service.ts'

/** Reloads the `shellCommands` config block; the CLI calls it after `remote-harness commands on|off`. */
export const COMMANDS_RELOAD_ROUTE = '/admin/commands-reload'

/** `command.run` / `command.cancel`: shell commands in a session's folder, behind the config opt-in. */
export function registerShellFeature(
  ctx: DaemonContext,
  store: SessionStore,
  spawn: ShellSpawner = spawnShell,
) {
  let settings = ctx.config.shellCommands
  const service = new ShellCommandService({
    store,
    spawn,
    settings: () => settings,
    isDirectory,
    logger: ctx.logger,
  })

  ctx.router.register('command.run', async (msg, connection) => ({
    type: 'command.started',
    ...(await service.run(msg.sessionId, msg.command, connection)),
  }))
  ctx.router.register('command.cancel', (msg, connection) => {
    service.cancel(msg.runId, connection)
    return { type: 'ack' }
  })
  ctx.hooks.post(COMMANDS_RELOAD_ROUTE, async () => {
    settings = (await loadConfig(ctx.logger)).shellCommands
    ctx.logger.info({ enabled: settings.enabled }, 'shell commands setting reloaded')
    return { enabled: settings.enabled }
  })
  ctx.onStop(() => service.dispose())

  return { service, enabled: () => service.enabled }
}
