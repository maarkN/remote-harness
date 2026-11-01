import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Config } from '../../core/config.ts'
import { paths } from '../../core/paths.ts'
import type { Executor } from '../../infra/exec.ts'
import { readTextFile, writeFileAtomic } from '../../infra/fs.ts'
import type { TmuxServer } from '../../infra/tmux.ts'

type TmuxConfig = Pick<Config, 'tmuxSocket' | 'tmuxConfig'>

/** The server `config.json` names, with its generated config file; `null` = the user's default server. */
export function tmuxServerOf(config: Pick<Config, 'tmuxSocket'>, conf = paths.tmuxConf()): TmuxServer | null {
  return config.tmuxSocket ? { socket: config.tmuxSocket, conf } : null
}

/** The user's own tmux config files, the classic one then the XDG one; sourced in `user` mode when they exist. */
export function userTmuxConfs(home = homedir()): string[] {
  return [join(home, '.tmux.conf'), join(home, '.config', 'tmux', 'tmux.conf')]
}

/** A tmux double-quoted string: only the backslash and the quote itself are escaped. */
function tmuxQuote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/**
 * The config the Remote Harness tmux server starts with (`tmux -f`), in place of the user's tmux.conf:
 * a few settings for a TUI agent and, in `user` mode, the user's own files on top, so theirs win.
 */
export function renderTmuxConf(mode: Config['tmuxConfig'], home = homedir()): string {
  const lines = [
    '# Remote Harness tmux server (`remote-harness tmux`, or `tmux -L <tmuxSocket>`): the sessions the launchers',
    '# open live here, apart from your own tmux server and its tmux.conf. Generated from config.json by',
    '# `remote-harness install`; do not edit. Set "tmuxConfig": "user" in config.json to load your own tmux.conf',
    '# on top of these settings.',
    '',
    '# Esc reaches the agent at once (tmux waits 500 ms for an escape sequence by default).',
    'set -s escape-time 10',
    '# The agent learns when its terminal gains or loses focus.',
    'set -s focus-events on',
    'set -g history-limit 50000',
  ]
  if (mode === 'user') {
    lines.push('', '# Your own settings, which win over the ones above.')
    for (const file of userTmuxConfs(home)) lines.push(`source-file -q ${tmuxQuote(file)}`)
  }
  return `${lines.join('\n')}\n`
}

/**
 * Writes the server's config from `config.json` when it is missing or differs: by install, setup and
 * update, and by the daemon at start, so a daemon started by hand finds it too. Nothing to write for
 * the default server, which keeps the user's tmux.conf.
 */
export async function ensureTmuxConf(
  config: TmuxConfig,
  home = homedir(),
): Promise<{ path: string; changed: boolean } | null> {
  const server = tmuxServerOf(config)
  if (!server) return null
  const rendered = renderTmuxConf(config.tmuxConfig, home)
  const changed = (await readTextFile(server.conf)) !== rendered
  if (changed) await writeFileAtomic(server.conf, rendered)
  return { path: server.conf, changed }
}

/**
 * Whether the launchers' session exists on the user's default server: sessions started before the
 * dedicated server, which the daemon no longer sees. Asked by `install` to tell the user.
 */
export async function legacySessionsExist(
  exec: Executor,
  tmuxBin: string,
  session: string,
): Promise<boolean> {
  const result = await exec(tmuxBin, ['has-session', '-t', `=${session}`])
  return result.exitCode === 0
}
