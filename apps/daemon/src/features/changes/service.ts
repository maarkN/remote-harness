import { open } from 'node:fs/promises'
import { join } from 'node:path'
import { CHANGES_DIFF_PAGE, type ChangedFile } from '@remote-harness/protocol'
import { DaemonError } from '../../core/errors.ts'
import { type GitChange, type GitClient, isGeneratedPath } from '../../infra/git.ts'
import type { SessionRecord } from '../sessions/types.ts'

/** Untracked files bigger than this are listed without counts. */
export const COUNT_MAX_BYTES = 1024 * 1024
/** git's own heuristic: a NUL byte in the first 8 KiB means binary. */
const BINARY_PROBE_BYTES = 8000

/** Lines of a text (a last line without `\n` counts) and whether it looks binary. */
export function textStats(bytes: Uint8Array): { lines: number; binary: boolean } {
  if (bytes.subarray(0, BINARY_PROBE_BYTES).includes(0)) return { lines: 0, binary: true }
  let lines = 0
  for (const byte of bytes) if (byte === 10) lines++
  if (bytes.length > 0 && bytes[bytes.length - 1] !== 10) lines++
  return { lines, binary: false }
}

/** Reads at most `max` bytes of a file and whether it was all of it; null when unreadable. */
export type ReadHead = (path: string, max: number) => Promise<{ bytes: Uint8Array; whole: boolean } | null>

export const readHead: ReadHead = async (path, max) => {
  try {
    const handle = await open(path, 'r')
    try {
      const { size } = await handle.stat()
      const buffer = Buffer.alloc(Math.min(size, max))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      return { bytes: buffer.subarray(0, bytesRead), whole: size <= max }
    } finally {
      await handle.close()
    }
  } catch {
    return null
  }
}

/** The wire form of a change: the generated flag from the fixed table. */
export function changedFile(change: GitChange): ChangedFile {
  return {
    path: change.path,
    oldPath: change.oldPath,
    status: change.status,
    added: change.added,
    deleted: change.deleted,
    binary: change.binary,
    generated: isGeneratedPath(change.path),
    untracked: change.untracked,
  }
}

type Sessions = { get(id: string): SessionRecord | undefined }

/** A session's working-tree changes against `HEAD` and the diff of each changed file. */
export class ChangesService {
  constructor(
    private readonly git: Pick<GitClient, 'changes' | 'fileDiff'>,
    private readonly sessions: Sessions,
    private readonly read: ReadHead = readHead,
  ) {}

  async list(
    sessionId: string,
  ): Promise<{ root: string | null; branch: string | null; files: ChangedFile[] }> {
    const changes = await this.changes(sessionId)
    if (!changes) return { root: null, branch: null, files: [] }
    return { root: changes.root, branch: changes.branch, files: changes.files.map(changedFile) }
  }

  /** A page of the diff of a listed file; any other path is `not_found`, so nothing else is ever read. */
  async diff(
    sessionId: string,
    path: string,
    offset = 0,
  ): Promise<{ path: string; offset: number; total: number; lines: string[]; binary: boolean }> {
    const changes = await this.changes(sessionId)
    const file = changes?.files.find((f) => f.path === path)
    if (!changes || !file) throw new DaemonError('not_found', 'not a changed file of this session')
    if (file.binary) return { path, offset: 0, total: 0, lines: [], binary: true }
    const text = await this.git.fileDiff(changes.root, changes.base, file)
    const lines = text.replace(/\n$/, '').split('\n')
    const all = text ? lines : []
    return {
      path,
      offset,
      total: all.length,
      lines: all.slice(offset, offset + CHANGES_DIFF_PAGE),
      binary: false,
    }
  }

  private async changes(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) throw new DaemonError('not_found', `session ${sessionId} not found`)
    const changes = await this.git.changes(session.cwd)
    if (!changes) return null
    const files = await Promise.all(
      changes.files.map((file) => (file.untracked ? this.countUntracked(changes.root, file) : file)),
    )
    return { ...changes, files }
  }

  private async countUntracked(root: string, file: GitChange): Promise<GitChange> {
    const head = await this.read(join(root, file.path), COUNT_MAX_BYTES)
    if (!head) return file
    const stats = textStats(head.bytes)
    if (stats.binary) return { ...file, binary: true, added: null, deleted: null }
    return head.whole ? { ...file, added: stats.lines, deleted: 0 } : file
  }
}
