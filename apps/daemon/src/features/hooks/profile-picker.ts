import { homedir } from 'node:os'
import { AGENT_LABELS, type Profile } from '@remote-harness/protocol'
import type { Messages } from '../../core/i18n/index.ts'
import { shortenHome } from '../../core/paths.ts'
import { profileAgentId } from '../agents/index.ts'
import { zshQuote } from './launcher.ts'

/** The command the profile picker is installed as, next to the launchers (#617). */
export const PROFILE_PICKER = 'rhnss'

export type ProfilePickerOptions = {
  /** Folders under it show as `~/…`. */
  home?: string
  labels: Messages['install']['profilePicker']
}

/** Characters as the terminal shows them: a composed accent is one, as in `Configurações`. */
function width(text: string): number {
  return [...text.normalize('NFC')].length
}

function padEnd(text: string, size: number): string {
  return `${text}${' '.repeat(Math.max(0, size - width(text)))}`
}

/** One line per profile: agent, name and config folder, in columns aligned across the list. */
export function profilePickerRows(profiles: readonly Profile[], home = homedir()): string[] {
  const cells = profiles.map(
    (p) => [AGENT_LABELS[profileAgentId(p)], p.name, shortenHome(p.configDir, home)] as const,
  )
  const agentWidth = Math.max(...cells.map(([agent]) => width(agent)))
  const nameWidth = Math.max(...cells.map(([, name]) => width(name)))
  return cells.map(
    ([agent, name, folder]) => `${padEnd(agent, agentWidth)} | ${padEnd(name, nameWidth)} | ${folder}`,
  )
}

/**
 * Generates `rhnss`: it lists the profiles, asks which one to start and `exec`s that profile's
 * launcher (in the same folder) with every argument it got. `rhnss <alias> …` and a single profile
 * skip the question; an empty answer or end of input starts nothing. The list and the texts are
 * baked in, so the script is rewritten with the launchers whenever the profiles change.
 */
export function renderProfilePicker(profiles: readonly Profile[], options: ProfilePickerOptions): string {
  const { labels } = options
  const count = profiles.length
  const ids = profiles.map((p) => zshQuote(p.id)).join(' ')
  const rows = profilePickerRows(profiles, options.home)
    .map((row) => zshQuote(row))
    .join(' ')
  return `#!/usr/bin/env zsh
# Remote Harness profile picker (${PROFILE_PICKER}): asks which profile to start and runs its launcher.
# Generated with the launchers from config.json ("profilePicker": true); do not edit.
bin=\${0:A:h}
ids=(${ids})
rows=(${rows})
pick=
if (( $# > 0 )) && (( \${ids[(Ie)$1]} )); then
  pick=$1
  shift
elif (( \${#ids} == 1 )); then
  pick=\${ids[1]}
else
  # The list and the question go to stderr, like a shell's \`select\`.
  print -u2 -r -- ${zshQuote(labels.question)}
  for i in {1..\${#ids}}; do print -u2 -r -- "  $i) \${rows[i]}"; done
  while [[ -z $pick ]]; do
    print -u2 -n -r -- ${zshQuote(labels.answer(count))}
    read -r answer || { print -u2; exit 1 }
    [[ -z $answer ]] && exit 1
    if [[ $answer == <-> ]] && (( answer >= 1 && answer <= \${#ids} )); then
      pick=\${ids[answer]}
    elif (( \${ids[(Ie)$answer]} )); then
      pick=$answer
    else
      print -u2 -r -- ${zshQuote(labels.invalid(count))}
    fi
  done
fi
exec "$bin/$pick" "$@"
`
}
