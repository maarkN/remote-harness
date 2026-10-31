import type { HookEventName } from './payloads.ts'
import { type HookInstallOptions, isOurHook, postCommand } from './settings-hooks.ts'

/**
 * Kimi CLI's hook events and the daemon events they are posted as. `StopFailure` ends a turn that
 * failed, which leaves the session just as ready for the next prompt as `Stop`.
 */
export const KIMI_HOOK_EVENTS: Readonly<Record<string, HookEventName>> = {
  SessionStart: 'SessionStart',
  UserPromptSubmit: 'UserPromptSubmit',
  Stop: 'Stop',
  StopFailure: 'Stop',
  SessionEnd: 'SessionEnd',
}

/** A top-level table header line (`[name]` or `[[name]]`), optionally followed by a comment. */
const HEADER = /^\s*(\[\[?)\s*([^\]]+?)\s*\]\]?\s*(#.*)?$/
const ROOT_HOOKS_KEY = /^\s*hooks\s*=/
const COMMAND_KEY = /^\s*command\s*=\s*(.+)$/
const EVENT_KEY = /^\s*event\s*=\s*(.+)$/

type Segment = { header: string | null; lines: string[] }

/** The file cut at its table headers; the first segment holds the root keys (header null). */
function segments(text: string): Segment[] {
  const result: Segment[] = [{ header: null, lines: [] }]
  for (const line of text.split('\n')) {
    const match = HEADER.exec(line)
    if (match) result.push({ header: `${match[1]}${match[2]}`, lines: [line] })
    else result.at(-1)?.lines.push(line)
  }
  return result
}

const ESCAPES: Record<string, string> = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' }

/** The value of a single-line TOML string (basic or literal); null for anything else. */
export function tomlString(raw: string): string | null {
  const value = raw.trim()
  if (value.startsWith("'") && !value.startsWith("'''")) {
    const end = value.indexOf("'", 1)
    return end > 0 ? value.slice(1, end) : null
  }
  if (!value.startsWith('"') || value.startsWith('"""')) return null
  let out = ''
  for (let i = 1; i < value.length; i++) {
    const char = value[i]
    if (char === '"') return out
    if (char !== '\\') {
      out += char
      continue
    }
    const next = value[++i] ?? ''
    if (next === 'u' || next === 'U') {
      const size = next === 'u' ? 4 : 8
      const code = Number.parseInt(value.slice(i + 1, i + 1 + size), 16)
      if (Number.isNaN(code)) return null
      out += String.fromCodePoint(code)
      i += size
    } else if (ESCAPES[next] !== undefined) {
      out += ESCAPES[next]
    } else {
      return null
    }
  }
  return null
}

/** A TOML basic string holding `value`. */
function basicString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

function keyValue(segment: Segment, key: RegExp): string | null {
  for (const line of segment.lines) {
    const match = key.exec(line)
    if (match?.[1]) return tomlString(match[1])
  }
  return null
}

function isOurTable(segment: Segment): boolean {
  if (segment.header !== '[[hooks') return false
  const command = keyValue(segment, COMMAND_KEY)
  return command !== null && isOurHook({ type: 'command', command })
}

/** `hooks` set as a root key (an inline array): tables cannot be added next to it. */
export function hasInlineHooks(text: string): boolean {
  return segments(text)[0]?.lines.some((line) => ROOT_HOOKS_KEY.test(line)) ?? false
}

function join(kept: readonly Segment[]): string {
  const text = kept
    .flatMap((segment) => segment.lines)
    .join('\n')
    .replace(/\s+$/, '')
  return text ? `${text}\n` : ''
}

/** Removes the daemon's `[[hooks]]` tables (found by their command); every other line is kept. */
export function removeKimiHooks(text: string): string {
  const all = segments(text)
  if (!all.some(isOurTable)) return text
  return join(all.filter((segment) => !isOurTable(segment)))
}

/**
 * The file with one daemon `[[hooks]]` table per Kimi event at the end, after removing older ones;
 * idempotent. Null when the file sets `hooks` as a key, which tables would contradict.
 */
export function mergeKimiHooks(text: string, options: HookInstallOptions): string | null {
  if (hasInlineHooks(text)) return null
  const base = join(segments(removeKimiHooks(text)))
  const tables = Object.entries(KIMI_HOOK_EVENTS).map(([kimiEvent, event]) =>
    [
      '[[hooks]]',
      `event = ${basicString(kimiEvent)}`,
      `command = ${basicString(postCommand(event, options))}`,
      `timeout = ${event === 'SessionEnd' ? 3 : 10}`,
    ].join('\n'),
  )
  return `${base}${base ? '\n' : ''}${tables.join('\n\n')}\n`
}

/** Kimi events that have a daemon `[[hooks]]` table (doctor). */
export function installedKimiEvents(text: string): Set<string> {
  return new Set(
    segments(text)
      .filter(isOurTable)
      .flatMap((segment) => keyValue(segment, EVENT_KEY) ?? []),
  )
}
