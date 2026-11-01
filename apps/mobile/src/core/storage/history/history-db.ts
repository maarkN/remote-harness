import {
  type Session,
  SessionSchema,
  type TranscriptEntry,
  TranscriptEntrySchema,
} from '@remote-harness/protocol'
import { HISTORY_CAP_BYTES, planEviction, type StreamUsage } from './eviction'
import { searchText } from './search-text'
import type { SqlDatabase, SqlValue } from './sql'
import { type CachedRun, planSync, type SyncEvent } from './sync'

/** Entries a reopened conversation renders from the cache before the daemon answers. */
export const HYDRATE_ENTRIES = 200
const NO_LIMIT = Number.MAX_SAFE_INTEGER

/** A stream's cached entries, oldest first, and whether older ones exist (cached or on the computer). */
export type CachedPage = { entries: TranscriptEntry[]; hasMore: boolean }

/** A `SyncEvent` carrying the entries themselves. */
export type HistoryEvent = SyncEvent & { entries: readonly TranscriptEntry[] }

type RunRow = { floor: number; last_cursor: number; complete: number }
type EntryRow = { json: string }

function parseEntries(rows: readonly EntryRow[]): TranscriptEntry[] {
  const entries: TranscriptEntry[] = []
  for (const row of rows) {
    try {
      const parsed = TranscriptEntrySchema.safeParse(JSON.parse(row.json))
      if (parsed.success) entries.push(parsed.data)
    } catch {
      // A row written by a broken build: skipped, the daemon still has it.
    }
  }
  return entries
}

/** Each word as an FTS5 phrase, so user text never reads as query syntax. */
export function ftsQuery(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replaceAll('"', '""')}"`)
    .join(' ')
}

/**
 * The history cache's queries (ADR 0004): one database for every computer, rows keyed by daemon ID.
 * Calls run one at a time, so a sync plan is always made against the run it is written over.
 */
export class HistoryDb {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly db: SqlDatabase,
    private readonly now: () => number = Date.now,
  ) {}

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)
    this.queue = run.catch(() => undefined)
    return run
  }

  private async run(computer: string, stream: string): Promise<CachedRun | null> {
    const row = await this.db.getFirstAsync<RunRow>(
      'SELECT floor, last_cursor, complete FROM streams WHERE computer = ? AND stream = ?',
      [computer, stream],
    )
    return row ? { floor: row.floor, lastCursor: row.last_cursor, complete: row.complete === 1 } : null
  }

  /** Whole lines before `before`, at least `limit` entries when there are; `moreCached` when older remain. */
  private async page(
    computer: string,
    stream: string,
    before: number,
    limit: number,
  ): Promise<{ entries: TranscriptEntry[]; moreCached: boolean }> {
    const edge = await this.db.getFirstAsync<{ cursor: number }>(
      `SELECT cursor FROM entries WHERE computer = ? AND stream = ? AND cursor < ?
       ORDER BY cursor DESC, idx DESC LIMIT 1 OFFSET ?`,
      [computer, stream, before, Math.max(0, limit - 1)],
    )
    const low = edge?.cursor ?? -1
    const rows = await this.db.getAllAsync<EntryRow>(
      `SELECT json FROM entries WHERE computer = ? AND stream = ? AND cursor >= ? AND cursor < ?
       ORDER BY cursor, idx`,
      [computer, stream, low, before],
    )
    const older = edge
      ? await this.db.getFirstAsync<{ found: number }>(
          'SELECT 1 AS found FROM entries WHERE computer = ? AND stream = ? AND cursor < ? LIMIT 1',
          [computer, stream, low],
        )
      : null
    return { entries: parseEntries(rows), moreCached: older !== null }
  }

  /** The latest cached page of a stream, marking it opened now; null when it is not cached. */
  latest(
    computer: string,
    stream: string,
    limit = HYDRATE_ENTRIES,
  ): Promise<(CachedPage & { lastCursor: number }) | null> {
    return this.serial(async () => {
      const run = await this.run(computer, stream)
      if (!run) return null
      await this.db.runAsync('UPDATE streams SET used_at = ? WHERE computer = ? AND stream = ?', [
        this.now(),
        computer,
        stream,
      ])
      const { entries, moreCached } = await this.page(computer, stream, NO_LIMIT, limit)
      return { entries, lastCursor: run.lastCursor, hasMore: moreCached || !run.complete }
    })
  }

  /** Cached entries before `before`; null when the cache has none there (ask the daemon). */
  older(computer: string, stream: string, before: number, limit: number): Promise<CachedPage | null> {
    return this.serial(async () => {
      const run = await this.run(computer, stream)
      if (!run || before <= run.floor) return null
      const { entries, moreCached } = await this.page(computer, stream, before, limit)
      if (entries.length === 0) return null
      return { entries, hasMore: moreCached || !run.complete }
    })
  }

  /** Writes what arrived for a stream, keeping its cached run contiguous (`planSync`). */
  apply(computer: string, stream: string, event: HistoryEvent): Promise<void> {
    return this.serial(async () => {
      const plan = planSync(await this.run(computer, stream), event)
      if (plan.kind === 'skip') return
      await this.db.withTransactionAsync(async () => {
        if (plan.kind === 'replace')
          await this.db.runAsync('DELETE FROM entries WHERE computer = ? AND stream = ?', [computer, stream])
        for (const entry of event.entries) {
          await this.db.runAsync(
            `INSERT INTO entries (computer, stream, key, cursor, idx, json, text) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (computer, stream, key) DO UPDATE SET
               cursor = excluded.cursor, idx = excluded.idx, json = excluded.json, text = excluded.text`,
            [
              computer,
              stream,
              entry.key,
              entry.cursor,
              entry.index,
              JSON.stringify(entry),
              searchText(entry),
            ],
          )
        }
        const { floor, lastCursor, complete } = plan.run
        await this.db.runAsync(
          `INSERT INTO streams (computer, stream, floor, last_cursor, complete, used_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (computer, stream) DO UPDATE SET
             floor = excluded.floor, last_cursor = excluded.last_cursor, complete = excluded.complete,
             used_at = excluded.used_at`,
          [computer, stream, floor, lastCursor, complete ? 1 : 0, this.now()],
        )
        await this.measure(computer, stream)
      })
    })
  }

  private measure(computer: string, stream: string): Promise<unknown> {
    return this.db.runAsync(
      `UPDATE streams SET bytes =
         (SELECT COALESCE(SUM(length(json)), 0) FROM entries e
           WHERE e.computer = streams.computer AND e.stream = streams.stream) +
         (SELECT COALESCE(SUM(length(data)), 0) FROM images i
           WHERE i.computer = streams.computer AND i.stream = streams.stream)
       WHERE computer = ? AND stream = ?`,
      [computer, stream],
    )
  }

  image(
    computer: string,
    stream: string,
    imageId: string,
  ): Promise<{ mediaType: string; data: string } | null> {
    return this.serial(async () => {
      const row = await this.db.getFirstAsync<{ media_type: string; data: string }>(
        'SELECT media_type, data FROM images WHERE computer = ? AND stream = ? AND image_id = ?',
        [computer, stream, imageId],
      )
      return row ? { mediaType: row.media_type, data: row.data } : null
    })
  }

  /** Keeps a fetched image with its stream; ignored for a stream that is not cached. */
  saveImage(
    computer: string,
    stream: string,
    imageId: string,
    mediaType: string,
    data: string,
  ): Promise<void> {
    return this.serial(async () => {
      if (!(await this.run(computer, stream))) return
      await this.db.withTransactionAsync(async () => {
        await this.db.runAsync(
          `INSERT INTO images (computer, stream, image_id, media_type, data) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (computer, stream, image_id) DO UPDATE SET media_type = excluded.media_type, data = excluded.data`,
          [computer, stream, imageId, mediaType, data],
        )
        await this.measure(computer, stream)
      })
    })
  }

  /** The last session list cached for a computer (sessions that no longer parse are left out). */
  snapshot(computer: string): Promise<{ sessions: Session[]; fetchedAt: string } | null> {
    return this.serial(async () => {
      const row = await this.db.getFirstAsync<{ sessions: string; fetched_at: string }>(
        'SELECT sessions, fetched_at FROM snapshots WHERE computer = ?',
        [computer],
      )
      if (!row) return null
      let raw: unknown
      try {
        raw = JSON.parse(row.sessions)
      } catch {
        return null
      }
      const sessions = (Array.isArray(raw) ? raw : []).flatMap((value: unknown) => {
        const parsed = SessionSchema.safeParse(value)
        return parsed.success ? [parsed.data] : []
      })
      return { sessions, fetchedAt: row.fetched_at }
    })
  }

  saveSnapshot(computer: string, sessions: readonly Session[], fetchedAt: string): Promise<void> {
    return this.serial(async () => {
      await this.db.runAsync(
        `INSERT INTO snapshots (computer, sessions, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT (computer) DO UPDATE SET sessions = excluded.sessions, fetched_at = excluded.fetched_at`,
        [computer, JSON.stringify(sessions), fetchedAt],
      )
    })
  }

  /** Bytes of entries and images of every computer. */
  totalBytes(): Promise<number> {
    return this.serial(async () => {
      const row = await this.db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(bytes), 0) AS total FROM streams',
        [],
      )
      return row?.total ?? 0
    })
  }

  /** Over the cap, deletes the least recently opened streams not on screen; returns how many. */
  evict(isOpen: (computer: string, stream: string) => boolean, cap = HISTORY_CAP_BYTES): Promise<number> {
    return this.serial(async () => {
      const streams = (
        await this.db.getAllAsync<{ computer: string; stream: string; bytes: number; used_at: number }>(
          'SELECT computer, stream, bytes, used_at FROM streams',
          [],
        )
      ).map((row): StreamUsage => ({ ...row, usedAt: row.used_at }))
      const total = streams.reduce((sum, s) => sum + s.bytes, 0)
      const chosen = planEviction(streams, total, (s) => isOpen(s.computer, s.stream), cap)
      if (chosen.length === 0) return 0
      await this.db.withTransactionAsync(async () => {
        for (const { computer, stream } of chosen) {
          const where: SqlValue[] = [computer, stream]
          await this.db.runAsync('DELETE FROM entries WHERE computer = ? AND stream = ?', where)
          await this.db.runAsync('DELETE FROM images WHERE computer = ? AND stream = ?', where)
          await this.db.runAsync('DELETE FROM streams WHERE computer = ? AND stream = ?', where)
        }
      })
      return chosen.length
    })
  }

  /** Deletes everything of a computer (forgotten, or the device revoked); freed pages are zeroed. */
  wipe(computer: string): Promise<void> {
    return this.serial(async () => {
      await this.db.withTransactionAsync(async () => {
        for (const table of ['entries', 'images', 'streams', 'snapshots'])
          await this.db.runAsync(`DELETE FROM ${table} WHERE computer = ?`, [computer])
      })
      await this.db.execAsync('PRAGMA wal_checkpoint(TRUNCATE)')
    })
  }

  /** Entries of a computer matching every word of `text`, best match first. */
  search(computer: string, text: string, limit = 50): Promise<{ stream: string; key: string }[]> {
    const query = ftsQuery(text)
    if (!query) return Promise.resolve([])
    return this.serial(() =>
      this.db.getAllAsync<{ stream: string; key: string }>(
        `SELECT e.stream AS stream, e.key AS key FROM entries_fts
         JOIN entries e ON e.rowid = entries_fts.rowid
         WHERE entries_fts MATCH ? AND e.computer = ? ORDER BY rank LIMIT ?`,
        [query, computer, limit],
      ),
    )
  }

  close(): Promise<void> {
    return this.serial(() => this.db.closeAsync())
  }
}
