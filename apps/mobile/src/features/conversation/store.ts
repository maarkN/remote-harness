import type { ServerMessageOf, TranscriptEntry } from '@remote-harness/protocol'
import { create } from 'zustand'
import type { DaemonClient } from '@/core/connection/daemon-client'
import type { HistoryEvent } from '@/core/storage/history/history-db'
import type { HistoryTarget } from '@/features/history/active'
import { createBatcher } from './batch'
import { streamsToEvict, touchRecent, trimEntries } from './retention'
import { EMPTY_TIMELINE, extendTimeline, mergeEntries, type Timeline } from './timeline'

export type StreamState = {
  entries: TranscriptEntry[]
  /** Display items of `entries`, extended in place as entries arrive (see `extendTimeline`). */
  timeline: Timeline
  /** Highest line cursor received; used to resume after reconnecting. */
  lastCursor: number | null
  hasMore: boolean
  loadingOlder: boolean
  /** Last subscription failure (rendered with `errorMessage`), null when fine. */
  error: unknown
}

const EMPTY: StreamState = {
  entries: [],
  timeline: EMPTY_TIMELINE,
  lastCursor: null,
  hasMore: false,
  loadingOlder: false,
  error: null,
}

type TranscriptStore = {
  streams: Record<string, StreamState>
  /** Stream keys, oldest opened first (memory keeps only the most recent closed ones). */
  recent: string[]
  /** Subscriptions per open stream (a stream can be shown by two screens at once). */
  open: Record<string, number>
  update(key: string, fn: (s: StreamState) => Partial<StreamState>): void
}

export const useTranscriptStore = create<TranscriptStore>((set) => ({
  streams: {},
  recent: [],
  open: {},
  update: (key, fn) =>
    set((state) => {
      const current = state.streams[key] ?? EMPTY
      return { streams: { ...state.streams, [key]: { ...current, ...fn(current) } } }
    }),
}))

function opened(key: string): void {
  useTranscriptStore.setState((state) => ({
    recent: touchRecent(state.recent, key),
    open: { ...state.open, [key]: (state.open[key] ?? 0) + 1 },
  }))
}

/**
 * The last subscription of a stream ended: it keeps only its last entries (older ones page back on
 * scroll), and closed streams beyond the most recent few leave memory altogether.
 */
function closed(key: string): void {
  useTranscriptStore.setState((state) => {
    const count = (state.open[key] ?? 1) - 1
    const { [key]: _closed, ...others } = state.open
    const open = count > 0 ? { ...others, [key]: count } : others
    if (count > 0) return { open }
    const streams = { ...state.streams }
    const current = streams[key]
    if (current) {
      const { entries, trimmed } = trimEntries(current.entries)
      if (trimmed)
        streams[key] = {
          ...current,
          entries,
          timeline: extendTimeline(EMPTY_TIMELINE, entries),
          hasMore: true,
        }
    }
    const evicted = streamsToEvict(state.recent, new Set(Object.keys(open)))
    for (const evictedKey of evicted) delete streams[evictedKey]
    const gone = new Set(evicted)
    return { open, streams, recent: state.recent.filter((k) => !gone.has(k)) }
  })
}

/** Where conversations are cached on the device (ADR 0004); none until the app sets it, and in tests. */
let historyTarget: () => Promise<HistoryTarget | null> = async () => null

export function setTranscriptHistory(provider: () => Promise<HistoryTarget | null>): void {
  historyTarget = provider
}

/** Least time between a cache write and the eviction pass it schedules. */
const EVICTION_DELAY_MS = 5_000
let evictionTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Writes what arrived for a stream to the history cache (best effort: the daemon keeps the
 * transcript), then schedules an eviction pass that spares the streams on screen.
 */
function persist(target: HistoryTarget | null, key: string, event: HistoryEvent): void {
  if (!target) return
  void target.db.apply(target.computer, key, event).catch(() => undefined)
  if (evictionTimer) return
  evictionTimer = setTimeout(() => {
    evictionTimer = undefined
    const { open } = useTranscriptStore.getState()
    void target.db
      .evict((computer, stream) => computer === target.computer && (open[stream] ?? 0) > 0)
      .catch(() => undefined)
  }, EVICTION_DELAY_MS)
}

/**
 * A stream not in memory starts from its cached copy (the latest page), so it renders before the
 * daemon answers and the subscription resumes from the cached cursor.
 */
async function hydrate(key: string, target: HistoryTarget | null): Promise<void> {
  const known = (s: StreamState | undefined) => !!s && (s.entries.length > 0 || s.lastCursor !== null)
  if (!target || known(useTranscriptStore.getState().streams[key])) return
  const page = await target.db.latest(target.computer, key).catch(() => null)
  if (!page || known(useTranscriptStore.getState().streams[key])) return
  useTranscriptStore.getState().update(key, () => ({
    entries: page.entries,
    timeline: extendTimeline(EMPTY_TIMELINE, page.entries),
    lastCursor: page.lastCursor,
    hasMore: page.hasMore,
  }))
}

export function streamKey(sessionId: string, agentId?: string): string {
  return agentId ? `${sessionId}#${agentId}` : sessionId
}

export function selectStream(key: string) {
  return (s: TranscriptStore) => s.streams[key] ?? EMPTY
}

function maxCursor(entries: readonly TranscriptEntry[], fallback: number | null): number | null {
  return entries.reduce<number | null>(
    (max, e) => (max === null || e.cursor > max ? e.cursor : max),
    fallback,
  )
}

function applyEntries(key: string, entries: TranscriptEntry[], patch: Partial<StreamState> = {}) {
  useTranscriptStore.getState().update(key, (s) => {
    const merged = mergeEntries(s.entries, entries)
    return {
      entries: merged,
      timeline: extendTimeline(s.timeline, merged),
      lastCursor: maxCursor(entries, s.lastCursor),
      error: null,
      ...patch,
    }
  })
}

/**
 * Subscribes to a session transcript and keeps it live across reconnects (resuming from the last
 * cursor). Returns an unsubscribe function.
 */
export function subscribeTranscript(client: DaemonClient, sessionId: string, agentId?: string): () => void {
  const key = streamKey(sessionId, agentId)
  // The computer is the one active now: a switch tears this subscription down.
  const target = historyTarget().catch(() => null)
  const hydrated = target.then((t) => hydrate(key, t))
  let cache: HistoryTarget | null = null
  void target.then((t) => {
    cache = t
  })

  // A burst of entries (a tool-heavy turn) becomes one store update per frame.
  const batch = createBatcher<TranscriptEntry>((entries) => {
    const previous = (useTranscriptStore.getState().streams[key] ?? EMPTY).lastCursor
    applyEntries(key, entries)
    persist(cache, key, { kind: 'live', previous, entries })
  })

  const subscribe = async () => {
    await hydrated
    // Entries still waiting for their frame count for the cursor to resume from.
    batch.flushNow()
    const { lastCursor } = useTranscriptStore.getState().streams[key] ?? EMPTY
    try {
      const reply = await client.request({
        type: 'session.subscribe',
        sessionId,
        agentId,
        ...(lastCursor !== null ? { sinceCursor: lastCursor } : {}),
      })
      if (reply.type !== 'transcript.page') return
      // A resume that could not send everything since the cursor (too much was written meanwhile)
      // says `hasMore`: what we had would leave a gap, so the reply replaces it.
      if (lastCursor !== null && reply.hasMore) {
        const entries = mergeEntries([], reply.entries)
        useTranscriptStore.getState().update(key, () => ({
          entries,
          timeline: extendTimeline(EMPTY_TIMELINE, entries),
          lastCursor: maxCursor(entries, lastCursor),
          hasMore: true,
          error: null,
        }))
        persist(await target, key, {
          kind: 'resume',
          since: lastCursor,
          entries: reply.entries,
          hasMore: true,
        })
        return
      }
      applyEntries(key, reply.entries, lastCursor === null ? { hasMore: reply.hasMore } : {})
      persist(
        await target,
        key,
        lastCursor === null
          ? { kind: 'initial', entries: reply.entries, hasMore: reply.hasMore }
          : { kind: 'resume', since: lastCursor, entries: reply.entries, hasMore: false },
      )
    } catch (error) {
      useTranscriptStore.getState().update(key, () => ({ error: error ?? null }))
    }
  }

  const onEntries = (message: ServerMessageOf<'transcript.entries'>) => {
    if (message.sessionId !== sessionId || message.agentId !== agentId) return
    for (const entry of message.entries) batch.push(entry)
  }

  opened(key)
  const offEntry = client.on('transcript.entries', onEntries)
  const offReady = client.onReady(() => void subscribe())
  if (client.status === 'open') void subscribe()

  return () => {
    offEntry()
    offReady()
    batch.flushNow()
    client.send({ type: 'session.unsubscribe', sessionId, agentId })
    closed(key)
  }
}

/** Loads the page before the oldest loaded entry: from the history cache when it has it, else the daemon. */
export async function loadOlder(client: DaemonClient, sessionId: string, agentId?: string): Promise<void> {
  const key = streamKey(sessionId, agentId)
  const state = useTranscriptStore.getState().streams[key] ?? EMPTY
  if (state.loadingOlder || !state.hasMore) return
  const oldest = state.entries[0]?.cursor
  if (oldest === undefined) return
  useTranscriptStore.getState().update(key, () => ({ loadingOlder: true }))
  try {
    const target = await historyTarget().catch(() => null)
    const cached = target ? await target.db.older(target.computer, key, oldest, 50).catch(() => null) : null
    if (cached) {
      applyEntries(key, cached.entries, { hasMore: cached.hasMore })
      return
    }
    const reply = await client.request({
      type: 'session.history',
      sessionId,
      agentId,
      before: oldest,
      limit: 50,
    })
    if (reply.type !== 'transcript.page') return
    applyEntries(key, reply.entries, { hasMore: reply.hasMore })
    persist(target, key, { kind: 'older', before: oldest, entries: reply.entries, hasMore: reply.hasMore })
  } finally {
    useTranscriptStore.getState().update(key, () => ({ loadingOlder: false }))
  }
}
