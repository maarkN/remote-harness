/** A reusable prompt saved on this device (#431). */
export type PromptTemplate = {
  id: string
  /** One line, at most `MAX_TEMPLATE_TITLE` characters. */
  title: string
  /** The prompt, with `{placeholders}`; at most `MAX_TEMPLATE_CHARS` characters. */
  text: string
  /** Last edit, in ms. */
  updatedAt: number
}

export const MAX_TEMPLATE_TITLE = 60
/** The cap of a first prompt at start (#430), which a template often becomes. */
export const MAX_TEMPLATE_CHARS = 8_000
export const PREVIEW_CHARS = 80
export const TEMPLATE_INDEX_KEY = 'remote-harness.templates'

/** SecureStore keys only take `[A-Za-z0-9._-]`; ids are made of those. */
export function templateStorageKey(id: string): string {
  return `remote-harness.template.${id}`
}

/** `{name}`: a letter, then letters, digits, `_` or `-`; nothing else, so JSON and code stay as they are. */
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_-]*)\}/g

/** The placeholders of a text, each once, in order of first appearance. */
export function placeholdersOf(text: string): string[] {
  const names = [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? '').filter((name) => name !== '')
  return [...new Set(names)]
}

/** Placeholders the app fills in by itself. */
export const BUILTIN_PLACEHOLDERS = ['branch', 'folder', 'cwd', 'date'] as const

export type TemplateContext = {
  /** The session's branch, or the branch of the directory on the New session screen. */
  branch?: string | null
  /** The session's directory, or the one typed on the New session screen. */
  cwd?: string | null
  now?: Date
}

/** `branch`, `folder` (the directory's last segment) and `cwd` when known; `date` (`YYYY-MM-DD`, local) always. */
export function builtinValues(context: TemplateContext): Record<string, string> {
  const values: Record<string, string> = {}
  if (context.branch) values.branch = context.branch
  const cwd = (context.cwd ?? '').replace(/\/+$/, '')
  if (cwd) {
    values.cwd = cwd
    values.folder = cwd.split('/').pop() || cwd
  }
  values.date = localDate(context.now ?? new Date())
  return values
}

function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Replaces the placeholders that have a non-blank value; the others stay as typed, so they are seen. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (match: string, name: string) => {
    const value = values[name]
    return value !== undefined && value.trim() !== '' ? value : match
  })
}

/** The placeholders of a text that `values` does not fill: what the form asks for. */
export function missingPlaceholders(text: string, values: Record<string, string>): string[] {
  return placeholdersOf(text).filter((name) => !values[name]?.trim())
}

/** The title as saved: one line, whitespace collapsed, cut at the limit; empty when nothing usable. */
export function cleanTitle(input: string): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, MAX_TEMPLATE_TITLE).trim()
}

/** What the lists show under the title: the text on one line, cut with an ellipsis. */
export function templatePreview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_CHARS ? `${flat.slice(0, PREVIEW_CHARS).trimEnd()}…` : flat
}

/** By title, case-insensitively (ids break ties), for a stable picker. */
export function sortTemplates(list: readonly PromptTemplate[]): PromptTemplate[] {
  return [...list].sort(
    (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id),
  )
}

/** Replaces the template with the same id, or adds it; sorted. */
export function upsertTemplate(list: readonly PromptTemplate[], template: PromptTemplate): PromptTemplate[] {
  return sortTemplates([...list.filter((t) => t.id !== template.id), template])
}

export function serializeTemplate(template: PromptTemplate): string {
  return JSON.stringify(template)
}

/** A stored template, or null when the item is unreadable (it is then dropped). */
export function parseTemplate(raw: string | null): PromptTemplate | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    if (typeof record.id !== 'string' || record.id === '') return null
    if (typeof record.title !== 'string' || typeof record.text !== 'string') return null
    if (record.title.trim() === '' || record.text.trim() === '') return null
    return {
      id: record.id,
      title: record.title,
      text: record.text,
      updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
    }
  } catch {
    return null
  }
}

export function parseTemplateIndex(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id !== '') : []
  } catch {
    return []
  }
}

/** A local id in the characters SecureStore keys take: the time, then randomness. */
export function newTemplateId(now = Date.now(), random = Math.random()): string {
  return `${now.toString(36)}-${random.toString(36).slice(2, 10) || '0'}`
}
