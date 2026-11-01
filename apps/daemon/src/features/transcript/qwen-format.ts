/**
 * The ONLY module that knows the Qwen Code transcript (.jsonl) format. Like the other agents', the
 * format is internal to the CLI and changes between versions (read from qwen-code 0.26), so
 * everything here is defensive: unknown records are skipped and nothing throws.
 *
 * Records are appended once: `{uuid, parentUuid, sessionId, timestamp, type, cwd, …}` with `type`
 * `user`, `assistant`, `tool_result` or `system`. Messages hold Gemini-style parts (`text`,
 * `thought`, `functionCall`, `functionResponse`): Qwen Code is a fork of Gemini CLI and keeps its
 * tools, so their names are mapped the same way.
 */
import type { TranscriptEntry } from '@remote-harness/protocol'
import type { TranscriptFormat, TranscriptMetaUpdate } from './format.ts'
import { geminiTool } from './gemini-format.ts'
import { MAX_TOOL_RESULT_CHARS } from './parser.ts'

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

function parts(record: Json): Json[] {
  const message = isObject(record.message) ? record.message : {}
  return Array.isArray(message.parts) ? message.parts.filter(isObject) : []
}

/** Qwen's names for the tools it shares with Gemini CLI. */
const GEMINI_NAMES: Record<string, string> = { edit: 'replace', web_search: 'google_web_search' }

/** Qwen's tool calls under the names and input fields the app renders. */
export function qwenTool(name: string, args: Json): { name: string; input: Json } {
  return geminiTool(GEMINI_NAMES[name] ?? name, args)
}

function truncate(text: string): { text: string; truncated: boolean } {
  return text.length > MAX_TOOL_RESULT_CHARS
    ? { text: text.slice(0, MAX_TOOL_RESULT_CHARS), truncated: true }
    : { text, truncated: false }
}

/** A prompt the user typed; other `user` records carry injected context (`provenance`). */
function isTyped(record: Json): boolean {
  return record.provenance === undefined || record.provenance === 'real_user'
}

const FAILED_STATUSES = new Set(['error', 'cancelled'])

function drafts(record: Json): Draft[] {
  switch (record.type) {
    case 'user': {
      if (!isTyped(record)) return []
      const text = parts(record)
        .flatMap((part) => (typeof part.text === 'string' && part.thought !== true ? [part.text] : []))
        .join('\n')
      return text.trim() ? [{ kind: 'user', text, images: [] }] : []
    }
    case 'assistant':
      return parts(record).flatMap((part): Draft[] => {
        if (isObject(part.functionCall)) {
          const call = part.functionCall
          const toolUseId = str(call.id)
          if (!toolUseId) return []
          const { name, input } = qwenTool(str(call.name) ?? 'tool', isObject(call.args) ? call.args : {})
          return [{ kind: 'tool_use', toolUseId, name, input }]
        }
        const text = str(part.text) ?? ''
        if (!text.trim()) return []
        return [part.thought === true ? { kind: 'thinking', text } : { kind: 'assistant_text', text }]
      })
    case 'tool_result': {
      const result = isObject(record.toolCallResult) ? record.toolCallResult : {}
      return parts(record).flatMap((part): Draft[] => {
        const fn = isObject(part.functionResponse) ? part.functionResponse : null
        const toolUseId = fn ? (str(fn.id) ?? str(result.callId)) : null
        if (!fn || !toolUseId) return []
        const response = isObject(fn.response) ? fn.response : {}
        const error = str(response.error)
        const output = error ?? str(response.output) ?? str(result.resultDisplay) ?? ''
        const { text: content, truncated } = truncate(output)
        const isError = error !== null || FAILED_STATUSES.has(str(result.status) ?? '')
        return [{ kind: 'tool_result', toolUseId, content, isError, truncated, images: [] }]
      })
    }
    case 'system':
      return record.subtype === 'chat_compression'
        ? [{ kind: 'system', subtype: 'compact_boundary', text: 'Conversation compacted' }]
        : []
    default:
      return []
  }
}

/** Converts one transcript record into zero or more normalized entries. Never throws. */
export function parseQwenLine(raw: string, cursor: number): TranscriptEntry[] {
  const record = parseJson(raw)
  if (!record) return []
  const uuid = str(record.uuid) ?? `line-${cursor}`
  const base: Base = { cursor, uuid, timestamp: str(record.timestamp), isSidechain: false }
  return drafts(record).map(
    (draft, index) => ({ ...draft, ...base, index, key: `${uuid}:${index}` }) as TranscriptEntry,
  )
}

/** The title a `custom_title` record sets (`/rename` or the automatic title). */
function customTitle(record: Json | null): string | null {
  if (record?.type !== 'system' || record.subtype !== 'custom_title') return null
  const payload = isObject(record.systemPayload) ? record.systemPayload : {}
  const title = str(payload.customTitle)?.trim()
  return title || null
}

export function parseQwenMeta(raw: string): TranscriptMetaUpdate | null {
  const title = customTitle(parseJson(raw))
  return title ? { customTitle: title } : null
}

export const qwenTranscript: TranscriptFormat = {
  parseLine: parseQwenLine,
  parseMeta: parseQwenMeta,
  findImage: () => null,
}

export type QwenMeta = { cwd: string | null; firstPrompt: string | null; title: string | null }

/** Folder and first typed prompt from the head; the latest title from head and tail. */
export function extractQwenMeta(headLines: readonly string[], tailLines: readonly string[]): QwenMeta {
  let cwd: string | null = null
  let firstPrompt: string | null = null
  let title: string | null = null
  for (const raw of headLines) {
    const record = parseJson(raw)
    if (!record) continue
    cwd ??= str(record.cwd)
    title = customTitle(record) ?? title
    if (!firstPrompt && record.type === 'user' && isTyped(record)) {
      const user = drafts(record)[0]
      if (user?.kind === 'user') firstPrompt = user.text.trim() || null
    }
  }
  for (const raw of tailLines) title = customTitle(parseJson(raw)) ?? title
  return { cwd, firstPrompt, title }
}

const SESSION_FILE = /^([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})\.jsonl$/i

/** The session id of a transcript file name (`<uuid>.jsonl`), or null for other files. */
export function qwenSessionId(name: string): string | null {
  return SESSION_FILE.exec(name)?.[1] ?? null
}
