/**
 * The ONLY module that knows the Kimi CLI session file (`wire.jsonl`) format. Like the other agents',
 * the format is internal to the CLI and changes between versions (read from kimi-cli 1.52), so
 * everything here is defensive: unknown lines are skipped and nothing throws.
 *
 * The first line is `{"type":"metadata","protocol_version":…}`; then `{timestamp, message: {type,
 * payload}}` records, appended once each (streamed parts are merged before they are written):
 * `TurnBegin`, `ContentPart`, `ToolCall`, `ToolResult`, `StepInterrupted`, `TurnEnd`… Lines have no
 * id, so keys are `line-<cursor>:<index>`.
 */
import type { ImageRef, TranscriptEntry } from '@remote-harness/protocol'
import type { ImageData, TranscriptFormat } from './format.ts'
import { base64Bytes, MAX_TOOL_RESULT_CHARS } from './parser.ts'

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function parseJson(raw: string): Json | null {
  try {
    const line: unknown = JSON.parse(raw)
    return isObject(line) ? line : null
  } catch {
    return null
  }
}

type Base = Pick<TranscriptEntry, 'cursor' | 'uuid' | 'timestamp' | 'isSidechain'>
type Draft = TranscriptEntry extends infer E
  ? E extends TranscriptEntry
    ? Omit<E, keyof Base | 'key' | 'index'>
    : never
  : never

/** The `{type, payload}` of a record, or null for the metadata line and anything else. */
function messageOf(line: Json | null): { type: string; payload: Json } | null {
  const message = line && isObject(line.message) ? line.message : null
  const type = message ? str(message.type) : null
  return message && type ? { type, payload: isObject(message.payload) ? message.payload : {} } : null
}

/** Text of a user input or tool output: a string, or the `text` of its parts, one per line. */
function partsText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value
    .flatMap((part) =>
      isObject(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : [],
    )
    .join('\n')
}

const DATA_URL = /^data:([^;,]+);base64,(.*)$/s

/** Data-URL images of a user input, in order; ids are `<cursor>.<n>` over this list. */
function inputImages(value: unknown): ImageData[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((part) => {
    const image =
      isObject(part) && part.type === 'image_url' && isObject(part.image_url) ? part.image_url : null
    const match = image && typeof image.url === 'string' ? DATA_URL.exec(image.url) : null
    if (!match?.[1] || match[2] === undefined) return []
    return [{ mediaType: match[1], data: match[2], bytes: base64Bytes(match[2]) }]
  })
}

function parseArguments(raw: unknown): Json {
  if (isObject(raw)) return raw
  if (typeof raw !== 'string') return {}
  try {
    const value: unknown = JSON.parse(raw)
    return isObject(value) ? value : { arguments: raw }
  } catch {
    return { arguments: raw }
  }
}

function pick(args: Json, names: Record<string, string>): Json {
  const input: Json = {}
  for (const [from, to] of Object.entries(names)) if (args[from] !== undefined) input[to] = args[from]
  return input
}

/**
 * Kimi's tool calls under the names and input fields the app already renders (`exec` like Codex's,
 * the file, search and web tools like Claude Code's); other tools keep their own.
 */
export function kimiTool(name: string, args: Json): { name: string; input: Json } {
  switch (name) {
    case 'Shell':
      return { name: 'exec', input: { command: str(args.command) ?? '' } }
    case 'ReadFile':
      return { name: 'Read', input: pick(args, { path: 'file_path' }) }
    case 'WriteFile':
      return { name: 'Write', input: pick(args, { path: 'file_path', content: 'content' }) }
    case 'StrReplaceFile': {
      // One edit or a list; the app shows the first.
      const edit = Array.isArray(args.edit) ? args.edit[0] : args.edit
      const first = isObject(edit) ? edit : {}
      return {
        name: 'Edit',
        input: {
          ...pick(args, { path: 'file_path' }),
          ...pick(first, { old: 'old_string', new: 'new_string' }),
        },
      }
    }
    case 'Grep':
      return { name: 'Grep', input: pick(args, { pattern: 'pattern', path: 'path' }) }
    case 'Glob':
      return { name: 'Glob', input: pick(args, { pattern: 'pattern', directory: 'path' }) }
    case 'SearchWeb':
      return { name: 'WebSearch', input: pick(args, { query: 'query' }) }
    case 'FetchURL':
      return { name: 'WebFetch', input: pick(args, { url: 'url' }) }
    default:
      return { name, input: args }
  }
}

function truncate(text: string): { text: string; truncated: boolean } {
  return text.length > MAX_TOOL_RESULT_CHARS
    ? { text: text.slice(0, MAX_TOOL_RESULT_CHARS), truncated: true }
    : { text, truncated: false }
}

function userDrafts(input: unknown, cursor: number): Draft[] {
  const text = partsText(input)
  const images: ImageRef[] = inputImages(input).map((image, n) => ({
    id: `${cursor}.${n}`,
    mediaType: image.mediaType,
    bytes: image.bytes,
  }))
  return text.trim() || images.length > 0 ? [{ kind: 'user', text, images }] : []
}

function drafts(type: string, payload: Json, cursor: number): Draft[] {
  switch (type) {
    case 'TurnBegin':
    case 'SteerInput':
      return userDrafts(payload.user_input, cursor)
    case 'ContentPart': {
      if (payload.type === 'think') {
        const text = str(payload.think) ?? ''
        return text.trim() ? [{ kind: 'thinking', text }] : []
      }
      const text = payload.type === 'text' ? (str(payload.text) ?? '') : ''
      return text.trim() ? [{ kind: 'assistant_text', text }] : []
    }
    case 'ToolCall': {
      const fn = isObject(payload.function) ? payload.function : {}
      const toolUseId = str(payload.id)
      if (!toolUseId) return []
      const { name, input } = kimiTool(str(fn.name) ?? 'tool', parseArguments(fn.arguments))
      return [{ kind: 'tool_use', toolUseId, name, input }]
    }
    case 'ToolResult': {
      const toolUseId = str(payload.tool_call_id)
      if (!toolUseId) return []
      const value = isObject(payload.return_value) ? payload.return_value : {}
      const output = partsText(value.output)
      const { text: content, truncated } = truncate(output || (str(value.message) ?? ''))
      return [
        { kind: 'tool_result', toolUseId, content, isError: value.is_error === true, truncated, images: [] },
      ]
    }
    case 'StepInterrupted':
      return [{ kind: 'system', subtype: 'turn_aborted', text: 'Interrupted' }]
    case 'CompactionEnd':
      return [{ kind: 'system', subtype: 'compact_boundary', text: 'Conversation compacted' }]
    default:
      return []
  }
}

/** Converts one `wire.jsonl` line into zero or more normalized entries. Never throws. */
export function parseKimiLine(raw: string, cursor: number): TranscriptEntry[] {
  const line = parseJson(raw)
  const message = messageOf(line)
  if (!line || !message) return []
  const seconds = typeof line.timestamp === 'number' ? line.timestamp : null
  const timestamp = seconds === null ? null : new Date(seconds * 1000).toISOString()
  const uuid = `line-${cursor}`
  const base: Base = { cursor, uuid, timestamp, isSidechain: false }
  return drafts(message.type, message.payload, cursor).map(
    (draft, index) => ({ ...draft, ...base, index, key: `${uuid}:${index}` }) as TranscriptEntry,
  )
}

/** The `index`-th image of a prompt line. */
export function findKimiImage(raw: string, index: number): ImageData | null {
  const message = messageOf(parseJson(raw))
  if (message?.type !== 'TurnBegin' && message?.type !== 'SteerInput') return null
  return inputImages(message.payload.user_input)[index] ?? null
}

export const kimiTranscript: TranscriptFormat = {
  parseLine: parseKimiLine,
  parseMeta: () => null,
  findImage: findKimiImage,
}

/** The first prompt typed in a session file's head. */
export function kimiFirstPrompt(headLines: readonly string[]): string | null {
  for (const raw of headLines) {
    const message = messageOf(parseJson(raw))
    if (message?.type !== 'TurnBegin') continue
    const text = partsText(message.payload.user_input).trim()
    if (text) return text
  }
  return null
}
