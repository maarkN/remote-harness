import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { PROVIDER_NAMES, type Profile, type Provider } from '@remote-harness/protocol'
import { paths } from '../../core/paths.ts'
import { providerKeyAccount, SECRET_SERVICE } from '../../core/secrets.ts'
import type { TmuxServer } from '../../infra/tmux.ts'
import { agentFor } from '../agents/index.ts'
import { providerEnv } from '../providers/openrouter.ts'

const PATH_BLOCK_START = '# >>> remote-harness >>>'
const PATH_BLOCK_END = '# <<< remote-harness <<<'
/** Markers written before the rename; such a block is replaced by the new one (#85). */
const LEGACY_PATH_BLOCK = ['# >>> claude-remote >>>', '# <<< claude-remote <<<'] as const

function zshQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

/**
 * Claude Code keeps its global state in \`~/.claude.json\` only when CLAUDE_CONFIG_DIR is unset; setting
 * it, even to \`~/.claude\`, switches to \`$CLAUDE_CONFIG_DIR/.claude.json\` and looks like a fresh install
 * (onboarding, no login). The default profile must therefore run with the variable unset.
 */
export function isDefaultConfigDir(configDir: string, home = homedir(), defaultDir = '~/.claude'): boolean {
  return resolve(configDir) === join(home, defaultDir.replace(/^~\/?/, ''))
}

export type LauncherOptions = {
  tmuxSession: string
  tmuxBin: string
  /** The Remote Harness tmux server; absent or null = the user's default server (and their tmux.conf). */
  tmuxServer?: TmuxServer | null
  home?: string
  /** Printed when a profile with a provider has no stored key; the installer passes the translated text. */
  missingKey?: (profileId: string, provider: string) => string
}

const defaultMissingKey = (profileId: string, provider: string): string =>
  `No ${provider} key stored for profile ${profileId}: run \`remote-harness provider key ${profileId}\`.`

/**
 * The provider part of a launcher: the gateway variables, and `read_provider_key`, which tries the
 * `0600` file, the macOS Keychain and the Secret Service. With `REMOTE_HARNESS_EXEC` set (inside the
 * tmux window) the script exports the key and `exec`s `claude`; before creating a window it only
 * checks that a key is readable.
 */
function providerSection(
  profileId: string,
  provider: Provider,
  unsetInPane: string,
  options: LauncherOptions,
): string {
  const exports = Object.entries(providerEnv(provider))
    .map(([name, value]) => `export ${name}=${zshQuote(value)}`)
    .join('\n')
  const keyFile = zshQuote(paths.providerKey(profileId))
  const service = zshQuote(SECRET_SERVICE)
  const account = zshQuote(providerKeyAccount(profileId))
  const name = PROVIDER_NAMES[provider.kind]
  const message = zshQuote((options.missingKey ?? defaultMissingKey)(profileId, name))
  return `${exports}
unset ANTHROPIC_API_KEY

# The ${name} key stays in the OS secret store and is read only inside the window, never on a command line.
read_provider_key() {
  if [[ -r ${keyFile} ]]; then
    cat ${keyFile}
  elif (( $+commands[security] )); then
    security find-generic-password -s ${service} -a ${account} -w 2>/dev/null
  elif (( $+commands[secret-tool] )); then
    secret-tool lookup service ${service} account ${account} 2>/dev/null
  fi
}
if [[ -n "$REMOTE_HARNESS_EXEC" ]]; then
  ANTHROPIC_AUTH_TOKEN="$(read_provider_key)"
  export ANTHROPIC_AUTH_TOKEN
  exec ${unsetInPane}"$CLAUDE_BIN" "$@"
fi
if [[ -z "$(read_provider_key)" ]]; then
  print -u2 -r -- ${message}
  exit 1
fi
`
}

/**
 * Generates the zsh launcher for a profile. It opens `claude` (with all args) in a new window of
 * the shared tmux session, on the Remote Harness tmux server (its own socket and config, so the
 * user's tmux.conf never applies), and attaches through a grouped session, so several terminals can
 * each look at a different window. Inside tmux already, a client of our server switches to the
 * window; a client of another server (the user's own tmux) gets the session nested in its pane and
 * is never switched. zsh is found through PATH (/bin/zsh on macOS, /usr/bin/zsh on Linux). With a
 * provider, the window runs this launcher again (`REMOTE_HARNESS_EXEC=1`) so the key is read from
 * the OS secret store inside the window and never crosses a command line.
 */
export function renderLauncher(profile: Profile, options: LauncherOptions): string {
  // Claude Code (CLAUDE_CONFIG_DIR, `claude`), Codex (CODEX_HOME, `codex`) or Gemini CLI
  // (GEMINI_CLI_HOME, the parent of the `.gemini` folder, `gemini`).
  const agent = agentFor(profile)
  const dirEnv = agent.configDirEnv ?? 'CLAUDE_CONFIG_DIR'
  const binEnv = agent.id === 'claude' ? 'CLAUDE_BIN' : `${agent.id.toUpperCase()}_BIN`
  const isDefault = isDefaultConfigDir(profile.configDir, options.home, agent.defaultConfigDir)
  const dirValue = agent.configDirEnvValue?.(profile.configDir) ?? profile.configDir
  // The tmux server may have inherited another profile's config dir variable, so `env -u` clears it.
  const configDir = isDefault ? `unset ${dirEnv}` : `export ${dirEnv}=${zshQuote(dirValue)}`
  const unsetInPane = isDefault ? `env -u ${dirEnv} ` : ''
  const configEnv = isDefault ? '' : `-e "${dirEnv}=$${dirEnv}" `
  const provider = agent.providers ? profile.provider : undefined
  const providerBlock = provider ? providerSection(profile.id, provider, unsetInPane, options) : ''
  const command = provider ? `"\${0:A}" "$@"` : `${unsetInPane}"$${binEnv}" "$@"`
  const execEnv = provider ? '-e "REMOTE_HARNESS_EXEC=1" ' : ''
  const server = options.tmuxServer
  const tmuxCmd = server
    ? `("$TMUX_BIN" -L ${zshQuote(server.socket)} -f ${zshQuote(server.conf)})`
    : '("$TMUX_BIN")'
  // A first prompt (REMOTE_HARNESS_PROMPT, set by the daemon) reaches the CLI through the window's
  // environment, expanded by the window's shell: the tmux command line is shell-quoted (a line break
  // becomes zsh-only `$'\n'`) and capped at 16 KB, and a tmux server this launcher starts must not
  // inherit the variable.
  const promptBlock = agent.promptArgs
    ? `prompt="\${REMOTE_HARNESS_PROMPT:-$CLAUDE_REMOTE_PROMPT}"
unset REMOTE_HARNESS_PROMPT CLAUDE_REMOTE_PROMPT
if [[ -n "$prompt" ]]; then
  envs+=(-e "REMOTE_HARNESS_PROMPT=$prompt")
  command_line+=${zshQuote(` ${agent.promptArgs.join(' ')} "$REMOTE_HARNESS_PROMPT"`)}
fi
`
    : ''
  return `#!/usr/bin/env zsh
# Remote Harness launcher for profile "${profile.id}" (${profile.name}). Generated; do not edit.
${configDir}
export REMOTE_HARNESS_PROFILE=${zshQuote(profile.id)}
# Hooks installed before the rename read the old name; both stay set until those sessions end.
export CLAUDE_REMOTE_PROFILE="$REMOTE_HARNESS_PROFILE"
TMUX_BIN=\${REMOTE_HARNESS_TMUX:-\${CLAUDE_REMOTE_TMUX:-${zshQuote(options.tmuxBin)}}}
SESSION=${zshQuote(options.tmuxSession)}
# The tmux server the sessions live on: Remote Harness's own (its socket and config, apart from your
# tmux.conf), or your default server when tmuxSocket is null in config.json.
TMUX_CMD=${tmuxCmd}
${binEnv}=\${REMOTE_HARNESS_${binEnv}:-\${CLAUDE_REMOTE_${binEnv}:-${agent.command}}}
${providerBlock}
name="${profile.id}:\${PWD:t}"
cmd=(${command})
command_line="\${(j: :)\${(q)cmd[@]}}"
envs=(${configEnv}${execEnv}-e "REMOTE_HARNESS_PROFILE=$REMOTE_HARNESS_PROFILE" -e "CLAUDE_REMOTE_PROFILE=$REMOTE_HARNESS_PROFILE")
${promptBlock}
if "\${TMUX_CMD[@]}" has-session -t "=$SESSION" 2>/dev/null; then
  ids=$("\${TMUX_CMD[@]}" new-window -d -P -F '#{pane_id} #{window_id}' -t "=$SESSION:" -n "$name" -c "$PWD" "\${envs[@]}" "$command_line") || exit 1
else
  ids=$("\${TMUX_CMD[@]}" new-session -d -P -F '#{pane_id} #{window_id}' -s "$SESSION" -n "$name" -c "$PWD" "\${envs[@]}" "$command_line") || exit 1
fi
pane=\${ids%% *}
window=\${ids##* }

if [[ -n "$REMOTE_HARNESS_NO_ATTACH$CLAUDE_REMOTE_NO_ATTACH" ]]; then
  print -r -- "$pane"
  exit 0
fi

# A grouped session shares the windows but keeps its own current window. The client that creates the
# view attaches to it (or switches to it) in the same command: with destroy-unattached on, tmux
# destroys an unattached view the moment the client that created it disconnects.
view="$SESSION-view-$$"
view_cmd=(-t "=$SESSION" -s "$view" \\; set-option -t "$view" destroy-unattached on \\; select-window -t "=$view:$window")
if [[ -n "$TMUX" ]]; then
  # Already inside tmux. A client of this same server switches to the view. A client of another
  # server (your own tmux) is never switched: the view shows nested in the current pane, with its
  # status line off, and your sessions, windows and client stay as they are.
  if [[ "\${TMUX%%,*}" == "$("\${TMUX_CMD[@]}" display-message -p -t "=$SESSION" '#{socket_path}')" ]]; then
    exec "\${TMUX_CMD[@]}" new-session -d "\${view_cmd[@]}" \\; switch-client -t "=$view"
  fi
  exec env -u TMUX "\${TMUX_CMD[@]}" new-session "\${view_cmd[@]}" \\; set-option -t "$view" status off
fi
# tmux refuses to attach to a terminal this computer has no terminfo entry for ("missing or
# unsuitable terminal"), e.g. Ghostty or kitty over SSH: fall back to an entry every system has.
if (( $+commands[infocmp] )) && ! infocmp -- "$TERM" >/dev/null 2>&1; then
  export TERM=xterm-256color
fi
exec "\${TMUX_CMD[@]}" new-session "\${view_cmd[@]}"
`
}

/** Same block (and markers) in ~/.zshrc and ~/.bashrc: the syntax is valid in both shells. */
export function pathBlock(binDir: string): string {
  return `${PATH_BLOCK_START}\nexport PATH=${zshQuote(binDir)}:"$PATH"\n${PATH_BLOCK_END}`
}

/** Removes the PATH block, with the current or the legacy markers. */
export function removePathBlock(content: string): string {
  let result = content
  for (const [startMarker, endMarker] of [[PATH_BLOCK_START, PATH_BLOCK_END], LEGACY_PATH_BLOCK]) {
    const start = result.indexOf(startMarker)
    if (start === -1) continue
    const end = result.indexOf(endMarker, start)
    if (end === -1) continue
    const before = result.slice(0, start).replace(/\n+$/, '\n')
    const after = result.slice(end + endMarker.length).replace(/^\n+/, '')
    const joined = `${before}${after}`
    result = joined === '\n' ? '' : joined
  }
  return result
}

export function upsertPathBlock(content: string, binDir: string): string {
  const base = removePathBlock(content)
  const separator = base.length === 0 || base.endsWith('\n') ? '' : '\n'
  return `${base}${separator}${base.length > 0 ? '\n' : ''}${pathBlock(binDir)}\n`
}
