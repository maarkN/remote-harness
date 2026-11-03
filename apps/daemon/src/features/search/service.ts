import { type FileHandle, open } from 'node:fs/promises'
import { searchText, TRANSCRIPT_SEARCH_LIMIT, type TranscriptSearchHit } from '@remote-harness/protocol'
import { DaemonError } from '../../core/errors.ts'
import type { SessionStore } from '../sessions/store.ts'
import type { SessionRecord } from '../sessions/types.ts'
import type { TranscriptFormat } from '../transcript/format.ts'
import { matchRanges, queryTerms, snippetAround } from './match.ts'

/** Transcripts read for one page at most, so a word no transcript has cannot keep a request busy. */
export const MAX_TRANSCRIPTS_PER_PAGE = 20
const DEFAULT_LIMIT = 20

export type SearchRequest = { query: string; sessionId?: string; limit?: number; cursor?: string }
export type SearchResult = { hits: TranscriptSearchHit[]; nextCursor: string | null; scanned: number }

/**
 * Where a page stopped: the session to continue in and, when it was already being read, the entry
 * (newest-first order) the next page starts at, inclusive; `from: null` reads it from its end.
 */
export type SearchCursor = { sessionId: string; from: { cursor: number; index: number } | null }

export function encodeCursor(cursor: SearchCursor): string {
  return `${cursor.sessionId}:${cursor.from ? `${cursor.from.cursor}.${cursor.from.index}` : ''}`
}

/** `null` for a cursor this daemon did not write (the search then starts over). */
export function decodeCursor(raw: string): SearchCursor | null {
  const at = raw.lastIndexOf(':')
  if (at <= 0) return null
  const sessionId = raw.slice(0, at)
  const tail = raw.slice(at + 1)
  if (tail === '') return { sessionId, from: null }
  const match = /^(\d+)\.(\d+)$/.exec(tail)
  if (!match) return null
  return { sessionId, from: { cursor: Number(match[1]), index: Number(match[2]) } }
}

/** The lines of a transcript, in order; a missing file reads as empty. Injected so tests can fake it. */
export type LineReader = (path: string) => AsyncIterable<string>

export async function* readFileLines(path: string): AsyncIterable<string> {
  let handle: FileHandle
  try {
    handle = await open(path, 'r')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  try {
    for await (const line of handle.readLines({ encoding: 'utf8' })) yield line
  } finally {
    await handle.close().catch(() => undefined)
  }
}

/**
 * Whole-word search over the transcripts of the sessions the daemon knows, newest session first and
 * newest entry first inside each, read through the session's agent format; see `match.ts` for what
 * counts as a match. Pages are bounded in hits and in transcripts read, and continue by cursor.
 */
export class TranscriptSearch {
  constructor(
    private readonly store: SessionStore,
    private readonly formatOf: (session: SessionRecord) => TranscriptFormat,
    private readonly lines: LineReader = readFileLines,
  ) {}

  async search(request: SearchRequest): Promise<SearchResult> {
    const limit = Math.min(request.limit ?? DEFAULT_LIMIT, TRANSCRIPT_SEARCH_LIMIT)
    const sessions = this.sessions(request.sessionId)
    const terms = queryTerms(request.query)
    if (terms.length === 0) return { hits: [], nextCursor: null, scanned: 0 }
    const cursor = request.cursor ? decodeCursor(request.cursor) : null
    let index = cursor ? sessions.findIndex((session) => session.id === cursor.sessionId) : 0
    // The session the last page stopped at is gone: the search starts over.
    let from = cursor && index !== -1 ? cursor.from : null
    if (index === -1) index = 0

    const hits: TranscriptSearchHit[] = []
    let scanned = 0
    for (; index < sessions.length; index++) {
      const session = sessions[index]!
      if (scanned === MAX_TRANSCRIPTS_PER_PAGE)
        return { hits, nextCursor: encodeCursor({ sessionId: session.id, from: null }), scanned }
      scanned++
      const found = await this.hitsOf(session, terms)
      const start = from
      from = null
      for (const hit of found) {
        if (start && (hit.cursor > start.cursor || (hit.cursor === start.cursor && hit.index > start.index)))
          continue
        if (hits.length === limit) {
          const next = { sessionId: session.id, from: { cursor: hit.cursor, index: hit.index } }
          return { hits, nextCursor: encodeCursor(next), scanned }
        }
        hits.push(hit)
      }
    }
    return { hits, nextCursor: null, scanned }
  }

  /** The sessions to read, newest first, or the one asked for. */
  private sessions(sessionId: string | undefined): SessionRecord[] {
    if (sessionId === undefined) return this.store.all().filter((session) => session.transcriptPath)
    const session = this.store.get(sessionId)
    if (!session) throw new DaemonError('not_found', `session ${sessionId} not found`)
    return session.transcriptPath ? [session] : []
  }

  /** Every hit of one transcript, newest first; a missing file has none. */
  private async hitsOf(session: SessionRecord, terms: readonly string[]): Promise<TranscriptSearchHit[]> {
    const path = session.transcriptPath
    if (!path) return []
    const format = this.formatOf(session)
    const seen = new Set<string>()
    const hits: TranscriptSearchHit[] = []
    let cursor = 0
    for await (const line of this.lines(path)) {
      const at = cursor++
      if (!line) continue
      for (const entry of format.parseLine(line, at)) {
        // A message the agent appended again (formats with `upserts`) counts once, at its first line.
        if (format.upserts) {
          if (seen.has(entry.key)) continue
          seen.add(entry.key)
        }
        const text = searchText(entry)
        const ranges = matchRanges(text, terms)
        if (ranges.length === 0) continue
        hits.push({
          sessionId: session.id,
          key: entry.key,
          cursor: entry.cursor,
          index: entry.index,
          kind: entry.kind,
          timestamp: entry.timestamp,
          ...snippetAround(text, ranges),
        })
      }
    }
    return hits.reverse()
  }
}
