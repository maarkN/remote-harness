import type { ExecStep } from '../../infra/desktop.ts'
import type { Platform } from '../../infra/platform.ts'
import type { TmuxServer } from '../../infra/tmux.ts'

export type TerminalAppId = 'iterm2' | 'ghostty' | 'wezterm' | 'kitty' | 'alacritty' | 'terminal'

type TerminalApp = {
  id: TerminalAppId
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
    processNames: ['Ghostty'],
    activate: () => ({ file: 'open', args: ['-a', 'Ghostty'] }),
    openRunning: (cmd) => ({ file: 'open', args: ['-na', 'Ghostty', '--args', '-e', SH, '-c', cmd] }),
  },
  {
    id: 'wezterm',
    processNames: ['wezterm-gui', 'WezTerm'],
    activate: () => ({ file: 'open', args: ['-a', 'WezTerm'] }),
    openRunning: (cmd) => ({ file: 'wezterm', args: ['start', '--', SH, '-c', cmd] }),
  },
  {
    id: 'kitty',
    processNames: ['kitty'],
    activate: () => ({ file: 'open', args: ['-a', 'kitty'] }),
    openRunning: (cmd) => ({ file: 'open', args: ['-na', 'kitty', '--args', SH, '-c', cmd] }),
  },
  {
    id: 'alacritty',
    processNames: ['Alacritty'],
    activate: () => ({ file: 'open', args: ['-a', 'Alacritty'] }),
    openRunning: (cmd) => ({ file: 'open', args: ['-na', 'Alacritty', '--args', '-e', SH, '-c', cmd] }),
  },
  {
    id: 'terminal',
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

/** The first app (in preference order) currently running, or Terminal.app (always installed on macOS). */
export function pickTerminalApp(runningProcessNames: readonly string[]): TerminalApp {
  const running = DARWIN_TERMINAL_APPS.find((app) =>
    app.processNames.some((name) => runningProcessNames.includes(name)),
  )
  return running ?? DARWIN_TERMINAL_APPS[DARWIN_TERMINAL_APPS.length - 1]!
}

/**
 * What to run so a session's tmux pane shows on screen. `hasAttachedClient` means some terminal
 * is already attached to the session's tmux server (possibly to a different session) and only
 * needs switching and raising; otherwise a new terminal window is opened running `tmux attach`.
 */
export function planShowInTerminal(input: {
  platform: Platform
  wsl: boolean
  hasAttachedClient: boolean
  /** macOS only; ignored elsewhere. */
  runningProcessNames: readonly string[]
  /** `$TERMINAL` on Linux, when set. */
  terminalEnv: string | null
  paneId: string
  /** tmux's absolute path (`TmuxClient.absoluteBin()`). */
  tmuxBin: string
  /** The server the pane lives on; absent or null = the default server. */
  tmuxServer?: TmuxServer | null
}): ExecStep[] {
  const { platform, wsl, hasAttachedClient, runningProcessNames, terminalEnv, paneId } = input
  const cmd = attachCommand(paneId, input.tmuxBin, input.tmuxServer ?? null)
  if (platform === 'darwin') {
    const app = pickTerminalApp(runningProcessNames)
    return [hasAttachedClient ? app.activate() : app.openRunning(cmd)]
  }
  if (wsl) {
    // No portable way to raise a specific window from inside WSL; switch-client already ran.
    return hasAttachedClient ? [] : [{ file: 'wt.exe', args: ['wsl.exe', SH, '-c', cmd] }]
  }
  if (hasAttachedClient) return []
  const terminal = terminalEnv || 'x-terminal-emulator'
  return [{ file: terminal, args: ['-e', SH, '-c', `${cmd}; exec "$SHELL"`] }]
}
