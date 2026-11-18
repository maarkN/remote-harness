import { homedir } from 'node:os'
import type { TerminalChoice } from '../../core/config.ts'
import type { Desktop } from '../../infra/desktop.ts'
import type { Executor } from '../../infra/exec.ts'
import { isDirectory } from '../../infra/fs.ts'
import type { Platform } from '../../infra/platform.ts'
import type { TmuxClient } from '../../infra/tmux.ts'
import {
  installedTerminalApps,
  planShowInTerminal,
  type TerminalAppId,
  terminalFallback,
} from './terminal-focus.ts'

/** The terminal apps installed on this computer (`installedTerminalApps` with the real checks). */
export function installedTerminalAppsHere(
  exec: Executor,
  platform: Platform,
  wsl: boolean,
): Promise<TerminalAppId[]> {
  return installedTerminalApps({
    platform,
    wsl,
    home: homedir(),
    exists: isDirectory,
    which: async (bin) => (await exec('which', [bin]).catch(() => null))?.exitCode === 0,
  })
}

/**
 * "Open in terminal (tmux)": switches any already-attached client to this pane and raises its
 * terminal app, or opens a new terminal window attached to it when none is attached, in the app the
 * `terminal` setting names (#615). Returns the chosen app and the one used when it was not installed,
 * for the caller to say so; null otherwise.
 */
export async function showInTerminal(
  tmux: TmuxClient,
  desktop: Desktop,
  platform: Platform,
  wsl: boolean,
  paneId: string,
  o: { choice?: TerminalChoice; installed?: () => Promise<TerminalAppId[]> } = {},
): Promise<{ missing: string; used: string } | null> {
  const clients = await tmux.listClients(paneId)
  for (const client of clients) await tmux.switchClient(client.tty, paneId)
  await tmux.focusPane(paneId)
  const runningProcessNames = platform === 'darwin' ? await desktop.listRunningApps() : []
  const names = o.choice && o.choice !== 'auto' && o.choice !== 'window'
  const plan = {
    platform,
    wsl,
    hasAttachedClient: clients.length > 0,
    runningProcessNames,
    terminalEnv: process.env.TERMINAL ?? null,
    choice: o.choice,
    // Only looked up when the setting names an app.
    installed: names && o.installed ? await o.installed() : [],
  }
  const steps = planShowInTerminal({
    ...plan,
    paneId,
    tmuxBin: await tmux.absoluteBin(),
    tmuxServer: tmux.server,
  })
  await desktop.runSteps(steps)
  return terminalFallback(plan)
}
