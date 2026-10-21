import { StringDecoder } from 'node:string_decoder'
import type { CommandStream } from '@remote-harness/protocol'

// CSI (`ESC [ … final`), OSC (`ESC ] … BEL|ST`) and two-byte escapes.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching escape sequences is the point.
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g

/** Terminal escape sequences (colors, cursor moves, titles) removed: the app shows plain text. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI, '')
}

export type OutputChunk = { stream: CommandStream; text: string }

/**
 * Output of one run: decodes each stream as UTF-8 (sequences split across chunks stay whole), counts
 * bytes against the cap and batches text until `take`, merging neighbors of the same stream.
 */
export class OutputCollector {
  private readonly decoders: Record<CommandStream, StringDecoder> = {
    stdout: new StringDecoder('utf8'),
    stderr: new StringDecoder('utf8'),
  }
  private pending: OutputChunk[] = []
  private pendingChars = 0
  /** Bytes accepted so far (never more than the cap). */
  bytes = 0
  /** Output past the cap was dropped. */
  truncated = false

  constructor(private readonly maxBytes: number) {}

  /** Adds a chunk; `false` once the cap is reached (the run must stop). */
  push(stream: CommandStream, chunk: Buffer): boolean {
    if (this.truncated) return false
    const room = this.maxBytes - this.bytes
    const accepted = chunk.length > room ? chunk.subarray(0, room) : chunk
    this.bytes += accepted.length
    this.append(stream, this.decoders[stream].write(accepted))
    if (chunk.length > room) {
      this.truncated = true
      return false
    }
    return true
  }

  /** Characters waiting for the next `take`. */
  get pendingSize(): number {
    return this.pendingChars
  }

  /** What was collected since the last call, ANSI stripped; `end` also flushes partial sequences. */
  take(end = false): OutputChunk[] {
    if (end) {
      for (const stream of ['stdout', 'stderr'] as const) this.append(stream, this.decoders[stream].end())
    }
    const chunks = this.pending
      .map((chunk) => ({ stream: chunk.stream, text: stripAnsi(chunk.text) }))
      .filter((chunk) => chunk.text.length > 0)
    this.pending = []
    this.pendingChars = 0
    return chunks
  }

  private append(stream: CommandStream, text: string): void {
    if (!text) return
    const last = this.pending[this.pending.length - 1]
    if (last?.stream === stream) last.text += text
    else this.pending.push({ stream, text })
    this.pendingChars += text.length
  }
}
