import { open } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The daemon's log files for "Report a problem" → include the computer's logs (#557): the tail of
 * each, scrubbed here so nothing sensitive leaves the computer. The daemon never logs session
 * content or `command.run` input or output; the scrubbing covers what could still slip in.
 */

/** The files sent, in order, with how much of the end of each. */
export const LOG_TAILS = [
  { name: 'daemon.log', bytes: 256 * 1024 },
  { name: 'daemon.err.log', bytes: 32 * 1024 },
  { name: 'update.log', bytes: 32 * 1024 },
] as const

export type LogFile = { name: string; text: string; truncated: boolean }

const REDACTED = '[redacted]'

/** JSON keys whose values never leave the computer (matched on the key without separators). */
const SENSITIVE_KEY =
  /secret|token|passw|passphrase|authoriz|cookie|apikey|privatekey|pairing|prompt|^text$|input|output|command|content|^args$|^body$|^key$/i

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Patterns replaced in any text, in order. */
const PATTERNS: readonly [RegExp, string | ((match: string) => string)][] = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/\b(Bearer|Basic)\s+\S+/gi, `$1 ${REDACTED}`],
  [/\bsk-[A-Za-z0-9_-]{8,}/g, '[token]'],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]'],
  // Long token-like runs (keys, secrets); session ids stay, they are needed to follow a problem.
  [/[A-Za-z0-9+=_-]{32,}/g, (match) => (UUID.test(match) ? match : REDACTED)],
]

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function scrubText(text: string, home: string): string {
  let out =
    home && home !== '/' ? text.replace(new RegExp(`${escapeRegExp(home)}(?=/|\\b|$)`, 'g'), '~') : text
  for (const [pattern, replacement] of PATTERNS)
    out = out.replace(pattern, replacement as (match: string, ...rest: string[]) => string)
  return out
}

function scrubValue(value: unknown, home: string): unknown {
  if (typeof value === 'string') return scrubText(value, home)
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, home))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key.replace(/[-_]/g, '')) ? REDACTED : scrubValue(item, home)
    }
    return out
  }
  return value
}

function scrubLine(line: string, home: string): string {
  if (line.startsWith('{')) {
    try {
      return JSON.stringify(scrubValue(JSON.parse(line) as unknown, home))
    } catch {
      // Not JSON after all: scrubbed as text below.
    }
  }
  return scrubText(line, home)
}

/** Scrubs log text line by line: JSON lines by key and pattern, other lines by pattern. */
export function scrubLog(text: string, home: string): string {
  return text
    .split('\n')
    .map((line) => scrubLine(line, home))
    .join('\n')
}

/** The last `bytes` of a file, starting at a whole line when cut; null when it cannot be read. */
export async function readLogTail(
  path: string,
  bytes: number,
): Promise<{ text: string; truncated: boolean } | null> {
  let handle: Awaited<ReturnType<typeof open>>
  try {
    handle = await open(path, 'r')
  } catch {
    return null
  }
  try {
    const { size } = await handle.stat()
    const length = Math.min(size, bytes)
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, size - length)
    const text = buffer.toString('utf8')
    if (size <= bytes) return { text, truncated: false }
    const firstLine = text.indexOf('\n')
    return { text: firstLine < 0 ? '' : text.slice(firstLine + 1), truncated: true }
  } finally {
    await handle.close()
  }
}

/** The present log files of `dir`, each its scrubbed tail. */
export async function readComputerLogs(dir: string, home: string): Promise<LogFile[]> {
  const files: LogFile[] = []
  for (const { name, bytes } of LOG_TAILS) {
    const tail = await readLogTail(join(dir, name), bytes)
    if (tail) files.push({ name, text: scrubLog(tail.text, home), truncated: tail.truncated })
  }
  return files
}
