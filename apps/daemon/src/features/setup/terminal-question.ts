import { type TerminalChoice, terminalChoicesFor } from '../../core/config.ts'
import type { Platform } from '../../infra/platform.ts'
import type { TerminalAppId } from '../pane/terminal-focus.ts'

/** The terminal app running this process, from what it sets in the environment; null when unknown. */
export function terminalHere(env: NodeJS.ProcessEnv): TerminalAppId | null {
  const program = env.TERM_PROGRAM ?? ''
  const term = env.TERM ?? ''
  if (program === 'ghostty' || term === 'xterm-ghostty') return 'ghostty'
  if (program === 'iTerm.app') return 'iterm2'
  if (program === 'WezTerm') return 'wezterm'
  if (program === 'Apple_Terminal') return 'terminal'
  if (term === 'xterm-kitty') return 'kitty'
  if (term === 'alacritty') return 'alacritty'
  return null
}

/**
 * The setup's "where should a session open" question (#615): the terminal window (macOS), Automatic
 * and the installed apps (plus the current choice), the one running the setup marked; preselected:
 * the current setting, else the window on macOS, else the running terminal when installed, else
 * Automatic.
 */
export function terminalSetupOptions(o: {
  platform: Platform
  installed: readonly TerminalAppId[]
  env: NodeJS.ProcessEnv
  current: TerminalChoice | undefined
}): { choices: { value: TerminalChoice; here: boolean }[]; preselected: TerminalChoice } {
  const here = terminalHere(o.env)
  const installed = o.installed as readonly string[]
  const values = terminalChoicesFor(o.platform).filter(
    (choice) =>
      choice === 'window' || choice === 'auto' || installed.includes(choice) || choice === o.current,
  )
  const offered = (choice: TerminalChoice | null | undefined): choice is TerminalChoice =>
    Boolean(choice) && values.includes(choice as TerminalChoice)
  const preselected = offered(o.current)
    ? o.current
    : o.platform === 'darwin'
      ? 'window'
      : offered(here)
        ? here
        : 'auto'
  return { choices: values.map((value) => ({ value, here: value === here })), preselected }
}
