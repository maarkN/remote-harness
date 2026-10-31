import type { LastActivity, TranscriptEntry } from './domain.ts'

/** Longest `LastActivity.text`, ellipsis included. */
export const LAST_ACTIVITY_MAX_CHARS = 200

const ELLIPSIS = '…'

/** Input fields naming what a tool works on, in the order they are tried. */
const PATH_FIELDS = ['file_path', 'notebook_path', 'path'] as const
const TEXT_FIELDS = ['pattern', 'url', 'description', 'query'] as const

/**
 * One line of plain text for a preview: markdown markers and line breaks removed, whitespace
 * collapsed, cut to `max` characters with `…`.
 */
export function previewText(text: string, max: number = LAST_ACTIVITY_MAX_CHARS): string {
  const plain = text
    .replace(/```[^\n]*\n?/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,;:!?]|$)/gm, '$1$2')
    .replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  const chars = [...plain]
  if (chars.length <= max) return plain
  const kept = chars.slice(0, max - 1).join('')
  return `${kept.trimEnd()}${ELLIPSIS}`
}

/** Last segment of a path, ignoring a trailing separator. */
function baseName(path: string): string {
  const segments = path.replace(/[/\\]+$/, '').split(/[/\\]/)
  return segments.at(-1) || path
}

function stringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** What a tool call works on: a file's base name, a command's first line, a pattern, a URL… */
function toolTarget(input: Record<string, unknown>): string | null {
  for (const field of PATH_FIELDS) {
    const path = stringField(input, field)
    if (path) return baseName(path)
  }
  const command = stringField(input, 'command')
  if (command) return command.split('\n')[0]?.trim() ?? command
  for (const field of TEXT_FIELDS) {
    const text = stringField(input, field)
    if (text) return text
  }
  return null
}

function activityOf(entry: TranscriptEntry): Pick<LastActivity, 'kind' | 'text'> | null {
  if (entry.isSidechain) return null
  switch (entry.kind) {
    case 'user':
      return entry.text.trim() ? { kind: 'user', text: entry.text } : null
    case 'assistant_text':
      return { kind: 'assistant', text: entry.text }
    case 'tool_use': {
      const target = toolTarget(entry.input)
      return { kind: 'tool', text: target ? `${entry.name}(${previewText(target)})` : entry.name }
    }
    case 'system':
      return entry.subtype === 'command' && entry.text.trim() ? { kind: 'user', text: entry.text } : null
    default:
      return null
  }
}

/**
 * The session's last prompt (or slash command), reply or tool call among `entries` (in transcript
 * order), as the session list previews it; subagents, thinking, tool results and system lines are
 * skipped. `fallbackAt` dates an entry without a timestamp. Null when there is none.
 */
export function lastActivityOf(entries: readonly TranscriptEntry[], fallbackAt: string): LastActivity | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    const activity = entry ? activityOf(entry) : null
    if (!entry || !activity) continue
    const text = previewText(activity.text)
    if (!text) continue
    return { kind: activity.kind, text, at: entry.timestamp ?? fallbackAt }
  }
  return null
}
