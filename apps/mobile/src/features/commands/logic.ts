import type { CommandEndReason, CommandStream, ServerMessageOf } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'

/** Characters of output the sheet keeps (the oldest are dropped first). */
export const MAX_DISPLAY_CHARS = 200_000
/** Characters of output "Add to prompt" puts in the draft (the end of it). */
export const MAX_PROMPT_CHARS = 20_000

export type CommandExit = Omit<ServerMessageOf<'command.exit'>, 'type' | 'runId'>
export type OutputSegment = { stream: CommandStream; text: string }

export type CommandRun = {
  runId: string
  command: string
  cwd: string
  startedAt: number
  segments: OutputSegment[]
  /** The sheet dropped the start of the output to stay under `MAX_DISPLAY_CHARS`. */
  clipped: boolean
  exit: CommandExit | null
}

export function newRun(runId: string, command: string, cwd: string, startedAt: number): CommandRun {
  return { runId, command, cwd, startedAt, segments: [], clipped: false, exit: null }
}

/** Adds output, merging with the last segment of the same stream and dropping the oldest past the cap. */
export function appendOutput(run: CommandRun, stream: CommandStream, text: string): CommandRun {
  if (!text) return run
  const segments = [...run.segments]
  const last = segments[segments.length - 1]
  if (last?.stream === stream) segments[segments.length - 1] = { stream, text: last.text + text }
  else segments.push({ stream, text })
  let total = segments.reduce((sum, segment) => sum + segment.text.length, 0)
  let clipped = run.clipped
  while (total > MAX_DISPLAY_CHARS && segments[0]) {
    const over = total - MAX_DISPLAY_CHARS
    const first = segments[0]
    if (first.text.length <= over) {
      segments.shift()
      total -= first.text.length
    } else {
      segments[0] = { stream: first.stream, text: first.text.slice(over) }
      total -= over
    }
    clipped = true
  }
  return { ...run, segments, clipped }
}

export function outputText(run: CommandRun): string {
  return run.segments.map((segment) => segment.text).join('')
}

/** State line of a finished run, translated. */
export function exitLabel(exit: CommandExit, t: TFunction): string {
  switch (exit.reason) {
    case 'exited':
      return t('commands.exit.exited', { code: exit.exitCode ?? '?' })
    case 'cancelled':
      return t('commands.exit.cancelled')
    case 'timeout':
      return t('commands.exit.timeout')
    case 'output_limit':
      return t('commands.exit.outputLimit')
    case 'failed':
      return t('commands.exit.failed')
  }
}

/** Whether a finished run counts as a failure (red state line). */
export function exitFailed(exit: CommandExit): boolean {
  return exit.reason !== 'exited' || exit.exitCode !== 0
}

/** Tags the agent reads after the output; plain tokens, not UI text. */
const END_TAGS: Record<CommandEndReason, string> = {
  exited: 'exit',
  cancelled: 'cancelled',
  timeout: 'timed out',
  output_limit: 'output limit reached',
  failed: 'failed to start',
}

/** A fence longer than any backtick run in the text, so the output cannot close it. */
function fence(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length))
  return '`'.repeat(Math.max(3, longest + 1))
}

/**
 * The command and its output as a fenced block for the prompt, like Claude Code's `!`: `$ command`,
 * the end of the output (at most `MAX_PROMPT_CHARS`) and the exit status.
 */
export function promptBlock(run: CommandRun): string {
  const full = outputText(run)
  const omitted = run.clipped || full.length > MAX_PROMPT_CHARS
  const output = full.length > MAX_PROMPT_CHARS ? full.slice(full.length - MAX_PROMPT_CHARS) : full
  const exit = run.exit
  const status = exit
    ? exit.reason === 'exited'
      ? `[exit ${exit.exitCode ?? '?'}]`
      : `[${END_TAGS[exit.reason]}]`
    : '[running]'
  const text = output.replace(/\n+$/, '')
  const body = [`$ ${run.command}`, ...(omitted ? ['…'] : []), ...(text ? [text] : []), status].join('\n')
  const marks = fence(body)
  return `${marks}shell\n${body}\n${marks}`
}

/** Appends a block to a draft, separated by a blank line. */
export function appendToDraft(draft: string, block: string): string {
  const trimmed = draft.replace(/\s+$/, '')
  return trimmed ? `${trimmed}\n\n${block}` : block
}

/** `1:05`, `12s`: elapsed time of a running command. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
