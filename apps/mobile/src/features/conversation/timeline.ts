import type { ImageRef, TranscriptEntry } from '@remote-harness/protocol'
import type { TFunction } from '../../core/i18n/create'

type Of<K extends TranscriptEntry['kind']> = Extract<TranscriptEntry, { kind: K }>

export type TimelineItem =
  | { type: 'user'; key: string; text: string; images: ImageRef[] }
  | { type: 'assistant'; key: string; text: string }
  | { type: 'thinking'; key: string; text: string }
  | { type: 'tool'; key: string; use: Of<'tool_use'> | null; result: Of<'tool_result'> | null }
  | {
      type: 'system'
      key: string
      subtype: string
      text: string
      durationMs?: number
      status?: string
      note?: string
      tag?: string
      trigger?: string
    }
  | { type: 'unknown'; key: string; raw: string }

/** Pairs each tool_use with its tool_result and maps the rest to display items, in order. */
export function buildTimeline(entries: readonly TranscriptEntry[]): TimelineItem[] {
  const results = new Map<string, Of<'tool_result'>>()
  const uses = new Set<string>()
  for (const entry of entries) {
    if (entry.kind === 'tool_result') results.set(entry.toolUseId, entry)
    if (entry.kind === 'tool_use') uses.add(entry.toolUseId)
  }
  const items: TimelineItem[] = []
  for (const entry of entries) {
    switch (entry.kind) {
      case 'user':
        items.push({ type: 'user', key: entry.key, text: entry.text, images: entry.images })
        break
      case 'assistant_text':
        items.push({ type: 'assistant', key: entry.key, text: entry.text })
        break
      case 'thinking':
        items.push({ type: 'thinking', key: entry.key, text: entry.text })
        break
      case 'tool_use':
        items.push({ type: 'tool', key: entry.key, use: entry, result: results.get(entry.toolUseId) ?? null })
        break
      case 'tool_result':
        // Results of calls outside the loaded window are still shown, on their own.
        if (!uses.has(entry.toolUseId)) items.push({ type: 'tool', key: entry.key, use: null, result: entry })
        break
      case 'system':
        items.push({
          type: 'system',
          key: entry.key,
          subtype: entry.subtype,
          text: entry.text,
          durationMs: entry.durationMs,
          status: entry.status,
          note: entry.note,
          tag: entry.tag,
          trigger: entry.trigger,
        })
        break
      case 'unknown':
        items.push({ type: 'unknown', key: entry.key, raw: entry.raw })
        break
    }
  }
  return items
}

/** A timeline with what it was built from, so entries appended later only add their own items. */
export type Timeline = {
  entries: readonly TranscriptEntry[]
  items: TimelineItem[]
  /** Item index of each tool call, to attach a result that arrives later. */
  toolItems: ReadonlyMap<string, number>
  /** Results already placed, on their own or with their call. */
  results: ReadonlySet<string>
}

export const EMPTY_TIMELINE: Timeline = { entries: [], items: [], toolItems: new Map(), results: new Set() }

function indexTimeline(entries: readonly TranscriptEntry[]): Timeline {
  const items = buildTimeline(entries)
  const toolItems = new Map<string, number>()
  const results = new Set<string>()
  items.forEach((item, index) => {
    if (item.type !== 'tool') return
    if (item.use) toolItems.set(item.use.toolUseId, index)
    if (item.result) results.add(item.result.toolUseId)
  })
  return { entries, items, toolItems, results }
}

/** `entries` starts with exactly the entries `previous` was built from (same objects, same order). */
function extendsEntries(previous: readonly TranscriptEntry[], entries: readonly TranscriptEntry[]): boolean {
  if (previous.length === 0 || entries.length < previous.length) return false
  for (let i = 0; i < previous.length; i++) if (entries[i] !== previous[i]) return false
  return true
}

/**
 * The timeline of `entries`, equal to `buildTimeline(entries)`. When `entries` only appends to the
 * entries of `previous`, only the new entries are mapped (and a tool call whose result arrives gets
 * a new item); every other item keeps its object, so memoized rows do not re-render. Anything else
 * (older pages, replaced entries) builds it again.
 */
export function extendTimeline(previous: Timeline, entries: readonly TranscriptEntry[]): Timeline {
  if (entries === previous.entries) return previous
  if (!extendsEntries(previous.entries, entries)) return indexTimeline(entries)
  const added = entries.slice(previous.entries.length)
  // A call whose result was already placed on its own would have to move: rare, rebuild.
  if (added.some((entry) => entry.kind === 'tool_use' && previous.results.has(entry.toolUseId)))
    return indexTimeline(entries)
  const items = previous.items.slice()
  const toolItems = new Map(previous.toolItems)
  const results = new Set(previous.results)
  for (const entry of added) {
    if (entry.kind === 'tool_result') {
      const at = toolItems.get(entry.toolUseId)
      const item = at === undefined ? undefined : items[at]
      results.add(entry.toolUseId)
      if (at !== undefined && item?.type === 'tool') {
        items[at] = { ...item, result: entry }
        continue
      }
    }
    const [item] = buildTimeline([entry])
    if (!item) continue
    if (item.type === 'tool' && item.use) toolItems.set(item.use.toolUseId, items.length)
    items.push(item)
  }
  return { entries, items, toolItems, results }
}

/** Whether `a` comes strictly after `b` in transcript order (line cursor, then index). */
function isAfter(a: TranscriptEntry, b: TranscriptEntry): boolean {
  return a.cursor > b.cursor || (a.cursor === b.cursor && a.index > b.index)
}

/** `incoming` is in order and starts after the last of `existing`: nothing to sort or replace. */
function appendsInOrder(existing: readonly TranscriptEntry[], incoming: readonly TranscriptEntry[]): boolean {
  let previous = existing[existing.length - 1]
  for (const entry of incoming) {
    if (previous && !isAfter(entry, previous)) return false
    previous = entry
  }
  return true
}

/**
 * Sorted, de-duplicated merge of transcript entries (by line cursor, then index). New entries at the
 * end, the live case, are appended without sorting, keeping the existing array's entries as they are.
 */
export function mergeEntries(
  existing: readonly TranscriptEntry[],
  incoming: readonly TranscriptEntry[],
): TranscriptEntry[] {
  if (incoming.length === 0) return existing as TranscriptEntry[]
  if (appendsInOrder(existing, incoming)) return [...existing, ...incoming]
  const byKey = new Map<string, TranscriptEntry>()
  for (const e of existing) byKey.set(e.key, e)
  for (const e of incoming) byKey.set(e.key, e)
  return [...byKey.values()].sort((a, b) => a.cursor - b.cursor || a.index - b.index)
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

const COMPACT_TRIGGERS = ['manual', 'auto'] as const
type CompactTrigger = (typeof COMPACT_TRIGGERS)[number]

function isCompactTrigger(trigger: string): trigger is CompactTrigger {
  return (COMPACT_TRIGGERS as readonly string[]).includes(trigger)
}

/** System lines the daemon describes in English are written again in the app's language. */
export function systemText(
  item: { subtype: string; text: string; durationMs?: number; trigger?: string },
  t: TFunction,
): string {
  if (item.subtype === 'turn_duration' && item.durationMs !== undefined)
    return t('conversation.turnDuration', { duration: formatDuration(item.durationMs) })
  if (item.subtype === 'compact_boundary') {
    if (item.trigger && isCompactTrigger(item.trigger))
      return t('conversation.compactedWithTrigger', {
        trigger: t(`conversation.compactTrigger.${item.trigger}`),
      })
    return t('conversation.compacted')
  }
  if (item.subtype === 'turn_aborted' && item.text === 'Interrupted') return t('conversation.interrupted')
  return item.text
}

const TASK_STATUSES = ['completed', 'failed', 'stopped', 'killed'] as const
type TaskStatus = (typeof TASK_STATUSES)[number]

function isTaskStatus(status: string): status is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(status)
}

/** Look of a background task notification by status; unknown statuses get the neutral look. */
export function taskTone(status: string | undefined): 'done' | 'failed' | 'stopped' | 'other' {
  if (status === 'completed') return 'done'
  if (status === 'failed') return 'failed'
  if (status === 'stopped' || status === 'killed') return 'stopped'
  return 'other'
}

/** Translated status of a background task; statuses the app does not know are shown as sent. */
export function taskStatusText(status: string | undefined, t: TFunction): string {
  if (!status) return ''
  return isTaskStatus(status) ? t(`conversation.task.status.${status}`) : status
}
