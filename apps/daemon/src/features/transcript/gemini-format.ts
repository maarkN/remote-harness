/**
 * The ONLY module that knows the Gemini CLI session file (.jsonl) format. Like the other agents',
 * the format is internal to the CLI and changes between versions (read from gemini-cli 0.66), so
 * everything here is defensive: unknown lines are skipped and nothing throws.
 *
 * The first line is a header (`{sessionId, projectHash, startTime, …}`); then messages
 * `{id, timestamp, type, content}` (`user`, `gemini`, `info`, `warning`, `error`) and `$set`,
 * `$rewindTo`, `$patch` records. A message is appended again, whole and with the same id, when it
 * gains tool calls (written once they complete) or token counts, so entry keys are built from the
 * message id and the format is marked `upserts`: only the first line holding a key shows it.
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
/** A draft with the part of the message it comes from (`text`, `tool:<id>`…), for its key. */
type Part = { part: string; draft: Draft }

/** Text of a content value: a string, or the `text` of its parts, one per line. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (isObject(content) && typeof content.text === 'string') return content.text
  if (!Array.isArray(content)) return ''
  return content
    .flatMap((part) => (isObject(part) && typeof part.text === 'string' ? [part.text] : []))
    .join('\n')
}

/** Base64 images of a prompt (`inlineData` parts), in order; ids are `<cursor>.<n>` over this list. */
function inlineImages(content: unknown): ImageData[] {
  if (!Array.isArray(content)) return []
  return content.flatMap((part) => {
    const inline = isObject(part) && isObject(part.inlineData) ? part.inlineData : null
    const mediaType = inline ? str(inline.mimeType) : null
    const data = inline ? str(inline.data) : null
    return mediaType?.startsWith('image/') && data ? [{ mediaType, data, bytes: base64Bytes(data) }] : []
  })
}

function truncate(text: string): { text: string; truncated: boolean } {
  return text.length > MAX_TOOL_RESULT_CHARS
    ? { text: text.slice(0, MAX_TOOL_RESULT_CHARS), truncated: true }
    : { text, truncated: false }
}

function pick(args: Json, names: Record<string, string>): Json {
  const input: Json = {}
  for (const [from, to] of Object.entries(names)) if (args[from] !== undefined) input[to] = args[from]
  return input
}

/**
 * Gemini's tool calls under the names and input fields the app already renders (`exec` like Codex's,
 * the file and search tools like Claude Code's); other tools keep their own.
 */
export function geminiTool(name: string, args: Json): { name: string; input: Json } {
  switch (name) {
    case 'run_shell_command': {
      const workdir = str(args.dir_path) ?? str(args.directory)
      return { name: 'exec', input: { command: str(args.command) ?? '', ...(workdir ? { workdir } : {}) } }
    }
    case 'read_file':
      return { name: 'Read', input: pick(args, { file_path: 'file_path', absolute_path: 'file_path' }) }
    case 'write_file':
      return { name: 'Write', input: pick(args, { file_path: 'file_path', content: 'content' }) }
    case 'replace':
      return {
        name: 'Edit',
        input: pick(args, { file_path: 'file_path', old_string: 'old_string', new_string: 'new_string' }),
      }
    case 'grep_search':
    case 'search_file_content':
      return { name: 'Grep', input: pick(args, { pattern: 'pattern', dir_path: 'path', path: 'path' }) }
    case 'glob':
      return { name: 'Glob', input: pick(args, { pattern: 'pattern', dir_path: 'path', path: 'path' }) }
    case 'google_web_search':
      return { name: 'WebSearch', input: pick(args, { query: 'query' }) }
    default:
      return { name, input: args }
  }
}

/** The text of a `functionResponse` result: its `output`, else its `error`, else the display text. */
function resultText(call: Json): { text: string; error: boolean } {
  const parts = Array.isArray(call.result) ? call.result : []
  for (const part of parts) {
    const response = isObject(part) && isObject(part.functionResponse) ? part.functionResponse.response : null
    if (!isObject(response)) continue
    if (typeof response.error === 'string') return { text: response.error, error: true }
    if (typeof response.output === 'string') return { text: response.output, error: false }
  }
  return { text: str(call.resultDisplay) ?? '', error: false }
}

const FAILED_STATUSES = new Set(['error', 'cancelled'])

function toolCall(call: Json): Part[] {
  const toolUseId = str(call.id)
  if (!toolUseId) return []
  const { name, input } = geminiTool(str(call.name) ?? 'tool', isObject(call.args) ? call.args : {})
  const use: Part = { part: `tool:${toolUseId}`, draft: { kind: 'tool_use', toolUseId, name, input } }
  const result = resultText(call)
  const { text: content, truncated } = truncate(result.text)
  const isError = result.error || FAILED_STATUSES.has(str(call.status) ?? '')
  return [
    use,
    {
      part: `result:${toolUseId}`,
      draft: { kind: 'tool_result', toolUseId, content, isError, truncated, images: [] },
    },
  ]
}

/** "Subject" and its description, as Gemini shows a thought. */
function thoughtText(thought: unknown): string {
  if (!isObject(thought)) return ''
  const subject = str(thought.subject)?.trim() ?? ''
  const description = str(thought.description)?.trim() ?? ''
  return subject && description ? `${subject}\n\n${description}` : subject || description
}

function geminiParts(message: Json): Part[] {
  const parts: Part[] = []
  const thoughts = Array.isArray(message.thoughts) ? message.thoughts : []
  thoughts.forEach((thought, n) => {
    const text = thoughtText(thought)
    if (text) parts.push({ part: `thought:${n}`, draft: { kind: 'thinking', text } })
  })
  const text = contentText(message.content)
  if (text.trim()) parts.push({ part: 'text', draft: { kind: 'assistant_text', text } })
  const calls = Array.isArray(message.toolCalls) ? message.toolCalls : []
  for (const call of calls) if (isObject(call)) parts.push(...toolCall(call))
  return parts
}

function userParts(message: Json, cursor: number): Part[] {
  // `displayContent` is what was typed, before `@file` expansion.
  const text = contentText(message.displayContent ?? message.content)
  const images: ImageRef[] = inlineImages(message.content).map((image, n) => ({
    id: `${cursor}.${n}`,
    mediaType: image.mediaType,
    bytes: image.bytes,
  }))
  return text.trim() || images.length > 0 ? [{ part: 'text', draft: { kind: 'user', text, images } }] : []
}

/** `info`, `warning` and `error` lines; a cancelled request reads like the other agents' interruptions. */
function systemParts(message: Json, type: string): Part[] {
  const text = contentText(message.content).trim()
  if (!text) return []
  if (type === 'info' && text === 'Request cancelled.')
    return [{ part: 'system', draft: { kind: 'system', subtype: 'turn_aborted', text: 'Interrupted' } }]
  return [{ part: 'system', draft: { kind: 'system', subtype: type, text } }]
}

const SYSTEM_TYPES = new Set(['info', 'warning', 'error'])

/** Converts one session file line into zero or more normalized entries. Never throws. */
export function parseGeminiLine(raw: string, cursor: number): TranscriptEntry[] {
  const message = parseJson(raw)
  const id = message ? str(message.id) : null
  const type = message ? str(message.type) : null
  if (!message || !id || !type) return []
  let parts: Part[]
  if (type === 'user') parts = userParts(message, cursor)
  else if (type === 'gemini') parts = geminiParts(message)
  else if (SYSTEM_TYPES.has(type)) parts = systemParts(message, type)
  else parts = []
  const base: Base = { cursor, uuid: id, timestamp: str(message.timestamp), isSidechain: false }
  return parts.map(
    ({ part, draft }, index) => ({ ...draft, ...base, index, key: `${id}:${part}` }) as TranscriptEntry,
  )
}

/** The `index`-th image of a prompt line. */
export function findGeminiImage(raw: string, index: number): ImageData | null {
  const message = parseJson(raw)
  if (message?.type !== 'user') return null
  return inlineImages(message.content)[index] ?? null
}

export const geminiTranscript: TranscriptFormat = {
  upserts: true,
  parseLine: parseGeminiLine,
  parseMeta: () => null,
  findImage: findGeminiImage,
}

/** What the session list needs from the head of a session file. */
export type GeminiMeta = { id: string | null; firstPrompt: string | null }

/** Session id from the header line and the first prompt typed. */
export function extractGeminiMeta(headLines: readonly string[]): GeminiMeta {
  let id: string | null = null
  let firstPrompt: string | null = null
  for (const raw of headLines) {
    const line = parseJson(raw)
    if (!line) continue
    id ??= str(line.sessionId)
    if (!firstPrompt && line.type === 'user') {
      const text = contentText(line.displayContent ?? line.content).trim()
      if (text) firstPrompt = text
    }
    if (id && firstPrompt) break
  }
  return { id, firstPrompt }
}

const SESSION_FILE = /^session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-(?:\d+-)?[0-9a-z]{8}\.jsonl$/i

/** A Gemini session file name (`session-<date>T<hh-mm>-<first 8 of the id>.jsonl`). */
export function isGeminiSessionFile(name: string): boolean {
  return SESSION_FILE.test(name)
}
