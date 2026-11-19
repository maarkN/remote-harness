import { effectiveLocale, effectiveTerminal, loadConfig } from '../../core/config.ts'
import { messagesFor } from '../../core/i18n/index.ts'
import { createDesktop } from '../../infra/desktop.ts'
import { currentWsl, resolvePlatform } from '../../infra/platform.ts'
import type { DaemonContext } from '../../main.ts'
import { requireControllable } from '../input/service.ts'
import type { SessionStore } from '../sessions/store.ts'
import { installedTerminalAppsHere, showInTerminal } from './show-in-terminal.ts'
import { PaneStreamer } from './streamer.ts'

export function registerPaneFeature(ctx: DaemonContext, store: SessionStore) {
  const streamer = new PaneStreamer(ctx.tmux, ctx.logger)
  const platform = resolvePlatform()
  const wsl = currentWsl(platform) !== null
  const desktop = createDesktop(ctx.exec, platform, { wsl })
  ctx.router.register('pane.subscribe', (msg, connection) => {
    const { paneId } = requireControllable(store, msg.sessionId)
    streamer.subscribe(msg.sessionId, paneId, connection)
    return undefined
  })
  ctx.router.register('pane.unsubscribe', (msg, connection) => {
    streamer.unsubscribe(msg.sessionId, connection)
    return undefined
  })
  // "Open in terminal (tmux)": the session's pane shows in a terminal on the computer's screen, in the
  // app the `terminal` setting names (read again each time, #615).
  ctx.router.register('pane.focus', async (msg) => {
    const { paneId } = requireControllable(store, msg.sessionId)
    const config = await loadConfig(ctx.logger).catch(() => ctx.config)
    const fallback = await showInTerminal(ctx.tmux, desktop, platform, wsl, paneId, {
      choice: effectiveTerminal(config.terminal, platform),
      installed: () => installedTerminalAppsHere(ctx.exec, platform, wsl),
    })
    if (fallback) {
      const t = messagesFor(effectiveLocale(config)).terminals
      await desktop.notify(t.missingTitle(fallback.missing), t.missingBody(fallback.used))
    }
    return undefined
  })
  ctx.onStop(() => streamer.dispose())
  return { streamer }
}
