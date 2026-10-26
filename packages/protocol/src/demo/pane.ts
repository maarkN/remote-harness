/** The terminal a demo session's pane shows, close to the agent's own (ANSI colors). */
import type { DemoEntry, DemoSession } from './fixtures.ts'

const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const AMBER = '\x1b[38;5;215m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'

function firstLine(text: string): string {
  return text.split('\n')[0] ?? ''
}

function toolLabel(entry: Extract<DemoEntry, { kind: 'tool' }>): string {
  const input = entry.input
  if (entry.name === 'Bash') return `Bash(${String(input.command)})`
  if (entry.name === 'Edit') return `Update(${String(input.file_path)})`
  if (entry.name === 'Grep')
    return `Search(pattern: "${String(input.pattern)}", path: "${String(input.path)}")`
  return entry.name
}

/** What the session's tmux pane shows: a terminal close to the agent's own, ending in its prompt box. */
export function paneText(session: DemoSession, width = 60): string {
  const out: string[] = ['']
  for (const entry of session.entries) {
    if (entry.kind === 'user') out.push(`${DIM}>${RESET} ${entry.text}`, '')
    if (entry.kind === 'text') out.push(`${BOLD}●${RESET} ${firstLine(entry.text).replaceAll('**', '')}`, '')
    if (entry.kind === 'tool') {
      out.push(`${AMBER}●${RESET} ${BOLD}${toolLabel(entry)}${RESET}`)
      if (entry.result !== undefined) {
        out.push(`  ${DIM}⎿${RESET}  ${entry.error ? RED : ''}${firstLine(entry.result).trim()}${RESET}`)
      }
      if (entry.name === 'Edit') {
        const before = String(entry.input.old_string).split('\n')
        const after = String(entry.input.new_string).split('\n')
        for (const line of before.filter((l) => !after.includes(l)))
          out.push(`     ${RED}- ${line.trim()}${RESET}`)
        for (const line of after.filter((l) => !before.includes(l)))
          out.push(`     ${GREEN}+ ${line.trim()}${RESET}`)
      }
      out.push('')
    }
  }
  if (session.state === 'running')
    out.push(`${AMBER}✶${RESET} Thinking… ${DIM}(12s · esc to interrupt)${RESET}`, '')
  if (session.permission) {
    out.push(
      `${AMBER}Do you want to proceed?${RESET}`,
      `${BOLD}❯ 1. Yes${RESET}`,
      "  2. Yes, and don't ask again for this command",
      '  3. No, and tell the agent what to do differently',
      '',
    )
  }
  const rule = '─'.repeat(width - 2)
  out.push(`╭${rule}╮`, `│ >${' '.repeat(width - 4)}│`, `╰${rule}╯`)
  const mode =
    session.permissionMode === 'acceptEdits'
      ? '⏵⏵ accept edits on (shift+tab to cycle)'
      : session.permissionMode === 'plan'
        ? '⏸ plan mode on (shift+tab to cycle)'
        : session.permissionMode === 'auto'
          ? '⏵⏵ auto mode on (shift+tab to cycle)'
          : '? for shortcuts'
  out.push(`  ${DIM}${mode}${RESET}`)
  return `${out.join('\n')}\n`
}
