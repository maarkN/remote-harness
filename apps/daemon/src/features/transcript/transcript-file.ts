import { open } from 'node:fs/promises'
import type { TranscriptEntry } from '@remote-harness/protocol'
import type { TranscriptFormat } from './format.ts'
import { claudeTranscript } from './parser.ts'

export type RawLine = { cursor: number; text: string }

/**
 * Incremental reader for an append-only .jsonl file. Keeps the byte offset of every complete line
 * so pages can be read without re-reading the whole file, and buffers a trailing partial line until
 * its newline arrives.
 */
export class TranscriptFile {
  /** lineStarts[i] = byte offset of line i; lineStarts[lineCount] = end of the last complete line. */
  private readonly lineStarts: number[] = [0]
  private queue: Promise<unknown> = Promise.resolve()
  /** Formats with `upserts`: the line where each entry key first appeared. */
  private readonly firstLine = new Map<string, number>()

  constructor(
    readonly path: string,
    readonly format: TranscriptFormat = claudeTranscript,
  ) {}

  get lineCount(): number {
    return this.lineStarts.length - 1
  }

  private get completeBytes(): number {
    return this.lineStarts[this.lineStarts.length - 1] ?? 0
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Reads bytes appended since the last sync and returns the new complete lines. */
  sync(): Promise<RawLine[]> {
    return this.serialize(async () => {
      let handle: Awaited<ReturnType<typeof open>>
      try {
        handle = await open(this.path, 'r')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
      }
      try {
        const { size } = await handle.stat()
        const start = this.completeBytes
        if (size <= start) return []
        const buffer = Buffer.alloc(size - start)
        await handle.read(buffer, 0, buffer.length, start)
        const lines: RawLine[] = []
        let lineStart = 0
        for (let i = 0; i < buffer.length; i++) {
          if (buffer[i] !== 0x0a) continue
          const text = buffer.subarray(lineStart, i).toString('utf8')
          const cursor = this.lineCount
          if (this.format.upserts && text) {
            for (const entry of this.format.parseLine(text, cursor))
              if (!this.firstLine.has(entry.key)) this.firstLine.set(entry.key, cursor)
          }
          lines.push({ cursor, text })
          this.lineStarts.push(start + i + 1)
          lineStart = i + 1
        }
        return lines.filter((l) => l.text.length > 0)
      } finally {
        await handle.close()
      }
    })
  }

  /**
   * The entries of a line. For formats with `upserts`, entries whose key first appeared on an earlier
   * line are dropped, so a message the agent appended again shows once (only lines read by `sync`
   * are indexed).
   */
  entries(line: RawLine): TranscriptEntry[] {
    const entries = this.format.parseLine(line.text, line.cursor)
    if (!this.format.upserts) return entries
    return entries.filter((entry) => (this.firstLine.get(entry.key) ?? line.cursor) >= line.cursor)
  }

  /** Reads complete lines in [from, to). */
  readLines(from: number, to: number): Promise<RawLine[]> {
    return this.serialize(async () => {
      const first = Math.max(0, from)
      const last = Math.min(to, this.lineCount)
      if (last <= first) return []
      const startByte = this.lineStarts[first] ?? 0
      const endByte = this.lineStarts[last] ?? startByte
      const handle = await open(this.path, 'r')
      try {
        const buffer = Buffer.alloc(endByte - startByte)
        await handle.read(buffer, 0, buffer.length, startByte)
        const lines: RawLine[] = []
        for (let i = first; i < last; i++) {
          const a = (this.lineStarts[i] ?? 0) - startByte
          const b = (this.lineStarts[i + 1] ?? 0) - startByte - 1
          const text = buffer.subarray(a, Math.max(a, b)).toString('utf8')
          if (text) lines.push({ cursor: i, text })
        }
        return lines
      } finally {
        await handle.close()
      }
    })
  }

  /**
   * Walks backwards from `before` (exclusive) collecting whole lines until at least `limit` entries
   * are found or the start of the file is reached.
   */
  async page(before: number, limit: number): Promise<{ entries: TranscriptEntry[]; hasMore: boolean }> {
    let end = Math.min(before, this.lineCount)
    const chunks: TranscriptEntry[][] = []
    let count = 0
    while (end > 0 && count < limit) {
      const start = Math.max(0, end - 200)
      const lines = await this.readLines(start, end)
      for (let i = lines.length - 1; i >= 0 && count < limit; i--) {
        const line = lines[i]!
        const entries = this.entries(line)
        if (entries.length === 0) continue
        chunks.push(entries)
        count += entries.length
        end = line.cursor
      }
      if (count < limit) end = start
    }
    return { entries: chunks.reverse().flat(), hasMore: end > 0 }
  }

  /**
   * Entries from lines strictly after `cursor`, capped to the last `maxLines` lines; `gap` when the
   * cap left lines after `cursor` out (the client must then replace what it has instead of merging).
   */
  async since(cursor: number, maxLines = 2_000): Promise<{ entries: TranscriptEntry[]; gap: boolean }> {
    const from = Math.max(cursor + 1, this.lineCount - maxLines)
    const lines = await this.readLines(from, this.lineCount)
    return { entries: lines.flatMap((l) => this.entries(l)), gap: from > cursor + 1 }
  }
}

/** The first entry of each key, in order (a message appended again shows once). */
function firstOfEachKey(entries: readonly TranscriptEntry[]): TranscriptEntry[] {
  const seen = new Set<string>()
  return entries.filter((entry) => !seen.has(entry.key) && seen.add(entry.key))
}

/**
 * Entries of the last `bytes` of a transcript, without indexing it (the first, partial line of the
 * window is dropped). `complete` when the window held the whole file. A missing file reads as empty.
 */
export async function readTailEntries(
  path: string,
  format: TranscriptFormat = claudeTranscript,
  bytes = 64 * 1024,
): Promise<{ entries: TranscriptEntry[]; complete: boolean }> {
  let handle: Awaited<ReturnType<typeof open>>
  try {
    handle = await open(path, 'r')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { entries: [], complete: true }
    throw error
  }
  try {
    const { size } = await handle.stat()
    const length = Math.min(bytes, size)
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, size - length)
    const complete = length === size
    const lines = buffer.toString('utf8').split('\n')
    // The window's first line is cut unless it starts the file; the last one may still be written.
    if (!complete) lines.shift()
    const entries = lines.filter(Boolean).flatMap((text) => format.parseLine(text, 0))
    return { entries: format.upserts ? firstOfEachKey(entries) : entries, complete }
  } finally {
    await handle.close()
  }
}
