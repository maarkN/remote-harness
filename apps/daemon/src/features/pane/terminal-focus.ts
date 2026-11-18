import type { TerminalChoice } from '../../core/config.ts'
import type { ExecStep } from '../../infra/desktop.ts'
import type { Platform } from '../../infra/platform.ts'
import type { TmuxServer } from '../../infra/tmux.ts'

export type TerminalAppId = 'iterm2' | 'ghostty' | 'wezterm' | 'kitty' | 'alacritty' | 'terminal'

type TerminalApp = {
  id: TerminalAppId
  /** As shown to the user (the fallback notification). */
  name: string
  /** The app bundle: a name looked up in `/Applications` and `~/Applications`, or an absolute path. */
  bundle: string
  /** Name(s) as listed by `tell application "System Events" to get name of every process`. */
  processNames: readonly string[]
  activate(): ExecStep
  /** Opens a new window running `shellCommand` as its initial program. */
  openRunning(shellCommand: string): ExecStep
}

/**
 * AppleScript addresses apps by bundle id: by name, `"iTerm2"` can resolve to a terminfo entry
 * LaunchServices registered as `iTerm2.app` when iTerm2 is not running, and the script fails to
 * compile ("A class name can't go after this identifier") (#612).
 */
const ITERM2 = 'application id "com.googlecode.iterm2"'
const TERMINAL = 'application id "com.apple.Terminal"'

function appleScriptString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/**
 * Shell command that attaches to `paneId`'s session, window and pane (a pane id resolves all three)
 * on `server`: the Remote Harness tmux server, or the default one when null. `tmuxBin` is tmux's
 * absolute path: the terminal app runs this with its own PATH, which may lack Homebrew (#612).
 */
export function attachCommand(paneId: string, tmuxBin: string, server: TmuxServer | null = null): string {
  const q = shellQuote(paneId)
  const bin = shellQuote(tmuxBin)
  const tmux = server ? `${bin} -L ${shellQuote(server.socket)} -f ${shellQuote(server.conf)}` : bin
  return `${tmux} attach -t ${q} \\; select-window -t ${q} \\; select-pane -t ${q}`
}

/** Every terminal runs the attach command through this shell, never one looked up on its PATH. */
const SH = '/bin/sh'

/** `cmd` as one argument of `/bin/sh -c`, for apps that take a single command line (iTerm2, Terminal.app). */
function shCommandLine(cmd: string): string {
  return `${SH} -c ${shellQuote(cmd)}`
}

/** Darwin terminal apps, in the order they are preferred when more than one is running. */
export const DARWIN_TERMINAL_APPS: readonly TerminalApp[] = [
  {
    id: 'iterm2',
    name: 'iTerm2',
    bundle: 'iTerm.app',
    processNames: ['iTerm2'],
    activate: () => ({ file: 'osascript', args: ['-e', `tell ${ITERM2} to activate`] }),
    openRunning: (cmd) => ({
      file: 'osascript',
      args: [
        '-e',
        // iTerm2 runs the command with execvp: through /bin/sh, `\;` and the quotes work as elsewhere.
        `tell ${ITERM2} to create window with default profile command ${appleScriptString(shCommandLine(cmd))}`,
      ],
    }),
  },
  {
    id: 'ghostty',
    name: 'Ghostty',
    bundle: 'Ghostty.app',
    processNames: ['Ghostty'],
    activate: () => ({ file: 'open', args: ['-a', 'Ghostty'] }),
    openRunning: (cmd) => ({ file: 'open', args: ['-na', 'Ghostty', '--args', '-e', SH, '-c', cmd] }),
  },
  {
    id: 'wezterm',
    name: 'WezTerm',
    bundle: 'WezTerm.app',
    processNames: ['wezterm-gui', 'WezTerm'],
    activate: () => ({ file: 'open', args: ['-a', 'WezTerm'] }),
    openRunning: (cmd) => ({ file: 'wezterm', args: ['start', '--', SH, '-c', cmd] }),
  },
  {
    id: 'kitty',
    name: 'kitty',
    bundle: 'kitty.app',
    processNames: ['kitty'],
    activate: () => ({ file: 'open', args: ['-a', 'kitty'] }),
    openRunning: (cmd) => ({ file: 'open', args: ['-na', 'kitty', '--args', SH, '-c', cmd] }),
  },
  {
    id: 'alacritty',
    name: 'Alacritty',
    bundle: 'Alacritty.app',
    processNames: ['Alacritty'],
    activate: () => ({ file: 'open', args: ['-a', 'Alacritty'] }),
    openRunning: (cmd) => ({ file: 'open', args: ['-na', 'Alacritty', '--args', '-e', SH, '-c', cmd] }),
  },
  {
    id: 'terminal',
    name: 'Terminal',
    bundle: '/System/Applications/Utilities/Terminal.app',
    processNames: ['Terminal'],
    activate: () => ({ file: 'osascript', args: ['-e', `tell ${TERMINAL} to activate`] }),
    openRunning: (cmd) => ({
      file: 'osascript',
      args: [
        '-e',
        `tell ${TERMINAL} to do script ${appleScriptString(shCommandLine(cmd))}`,
        '-e',
        `tell ${TERMINAL} to activate`,
      ],
    }),
  },
]

type LinuxTerminalApp = {
  name: string
  bin: string
  /** Its arguments to run `line` (the attach command, then the user's shell). */
  args(line: string): string[]
}

/** Terminal apps the `terminal` setting can name on Linux, in place of `$TERMINAL` (#615). */
export const LINUX_TERMINAL_APPS: Partial<Record<TerminalAppId, LinuxTerminalApp>> = {
  ghostty: { name: 'Ghostty', bin: 'ghostty', args: (line) => ['-e', SH, '-c', line] },
  wezterm: { name: 'WezTerm', bin: 'wezterm', args: (line) => ['start', '--', SH, '-c', line] },
  kitty: { name: 'kitty', bin: 'kitty', args: (line) => [SH, '-c', line] },
  alacritty: { name: 'Alacritty', bin: 'alacritty', args: (line) => ['-e', SH, '-c', line] },
}

function isRunning(app: TerminalApp, runningProcessNames: readonly string[]): boolean {
  return app.processNames.some((name) => runningProcessNames.includes(name))
}

/** The first app (in preference order) currently running, or Terminal.app (always installed on macOS). */
export function pickTerminalApp(runningProcessNames: readonly string[]): TerminalApp {
  const running = DARWIN_TERMINAL_APPS.find((app) => isRunning(app, runningProcessNames))
  return running ?? DARWIN_TERMINAL_APPS[DARWIN_TERMINAL_APPS.length - 1]!
}

/** The app the setting names; null for `auto`, `window` (an external terminal is `auto` then) or none. */
function chosenApp(choice: TerminalChoice | undefined): TerminalAppId | null {
  return choice && choice !== 'auto' && choice !== 'window' ? choice : null
}

/**
 * The terminal apps installed here, as the `terminal` setting names them: macOS bundles in
 * `/Applications` or `~/Applications` (Terminal.app at its system path), Linux binaries on PATH;
 * none under WSL, which always opens Windows Terminal.
 */
export async function installedTerminalApps(o: {
  platform: Platform
  wsl: boolean
  home: string
  exists: (path: string) => Promise<boolean>
  which: (bin: string) => Promise<boolean>
}): Promise<TerminalAppId[]> {
  if (o.platform === 'darwin') {
    const found = await Promise.all(
      DARWIN_TERMINAL_APPS.map(async (app) => {
        const places = app.bundle.startsWith('/')
          ? [app.bundle]
          : [`/Applications/${app.bundle}`, `${o.home}/Applications/${app.bundle}`]
        for (const place of places) if (await o.exists(place)) return app.id
        return null
      }),
    )
    return found.filter((id): id is TerminalAppId => id !== null)
  }
  if (o.wsl) return []
  const entries = Object.entries(LINUX_TERMINAL_APPS) as [TerminalAppId, LinuxTerminalApp][]
  const found = await Promise.all(entries.map(async ([id, app]) => ((await o.which(app.bin)) ? id : null)))
  return found.filter((id): id is TerminalAppId => id !== null)
}

type TerminalPlanInput = {
  platform: Platform
  wsl: boolean
  hasAttachedClient: boolean
  /** macOS only; ignored elsewhere. */
  runningProcessNames: readonly string[]
  /** `$TERMINAL` on Linux, when set. */
  terminalEnv: string | null
  /** The `terminal` setting as it applies here (`effectiveTerminal`); absent = `auto`. */
  choice?: TerminalChoice
  /** The terminal apps installed (`installedTerminalApps`). */
  installed?: readonly TerminalAppId[]
}

/**
 * The chosen app was not installed and a new window opened elsewhere: its name and the one used, for
 * the notification that says so; null otherwise.
 */
export function terminalFallback(input: TerminalPlanInput): { missing: string; used: string } | null {
  const chosen = chosenApp(input.choice)
  if (!chosen || input.hasAttachedClient || input.wsl || (input.installed ?? []).includes(chosen)) return null
  if (input.platform === 'darwin') {
    const app = DARWIN_TERMINAL_APPS.find((candidate) => candidate.id === chosen)
    return app ? { missing: app.name, used: pickTerminalApp(input.runningProcessNames).name } : null
  }
  const app = LINUX_TERMINAL_APPS[chosen]
  return app ? { missing: app.name, used: input.terminalEnv || 'x-terminal-emulator' } : null
}

/**
 * What to run so a session's tmux pane shows on screen. `hasAttachedClient` means some terminal
 * is already attached to the session's tmux server (possibly to a different session) and only
 * needs switching and raising; otherwise a new terminal window is opened running `tmux attach`, in
 * the chosen app when it is installed, else in the first running one (`auto`).
 */
export function planShowInTerminal(
  input: TerminalPlanInput & {
    paneId: string
    /** tmux's absolute path (`TmuxClient.absoluteBin()`). */
    tmuxBin: string
    /** The server the pane lives on; absent or null = the default server. */
    tmuxServer?: TmuxServer | null
  },
): ExecStep[] {
  const { platform, wsl, hasAttachedClient, runningProcessNames, terminalEnv, paneId } = input
  const cmd = attachCommand(paneId, input.tmuxBin, input.tmuxServer ?? null)
  const chosen = chosenApp(input.choice)
  const installed = input.installed ?? []
  if (platform === 'darwin') {
    const app = DARWIN_TERMINAL_APPS.find((candidate) => candidate.id === chosen)
    // An attached client lives in a running app: the chosen one if it runs, else the first running.
    if (hasAttachedClient)
      return [
        (app && isRunning(app, runningProcessNames) ? app : pickTerminalApp(runningProcessNames)).activate(),
      ]
    return [(app && installed.includes(app.id) ? app : pickTerminalApp(runningProcessNames)).openRunning(cmd)]
  }
  if (wsl) {
    // No portable way to raise a specific window from inside WSL; switch-client already ran.
    return hasAttachedClient ? [] : [{ file: 'wt.exe', args: ['wsl.exe', SH, '-c', cmd] }]
  }
  if (hasAttachedClient) return []
  const line = `${cmd}; exec "$SHELL"`
  const app = chosen && installed.includes(chosen) ? LINUX_TERMINAL_APPS[chosen] : undefined
  if (app) return [{ file: app.bin, args: app.args(line) }]
  const terminal = terminalEnv || 'x-terminal-emulator'
  return [{ file: terminal, args: ['-e', SH, '-c', line] }]
}
