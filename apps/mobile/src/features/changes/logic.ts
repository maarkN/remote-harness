import type { ChangedFile, ChangeStatus } from '@remote-harness/protocol'
import type { DiffLine } from '@/features/conversation/diff'

/** A diff bigger than this starts collapsed, with only its counts. */
export const LARGE_DIFF_LINES = 400

/** Header lines of `git diff` that the counts and the file row already say. */
const HEADER =
  /^(diff --git |index |--- |\+\+\+ |new file mode |deleted file mode |old mode |new mode |similarity index |dissimilarity index |rename from |rename to |copy from |copy to |Binary files )/

/** Unified diff lines → colored lines: headers dropped, each hunk after the first behind a `⋯`. */
export function unifiedDiffLines(lines: readonly string[]): DiffLine[] {
  const out: DiffLine[] = []
  let hunks = 0
  for (const line of lines) {
    if (HEADER.test(line) || line.startsWith('\\ No newline')) continue
    if (line.startsWith('@@')) {
      if (hunks++ > 0) out.push({ kind: 'context', text: '⋯' })
      continue
    }
    if (line.startsWith('+')) out.push({ kind: 'add', text: line.slice(1) })
    else if (line.startsWith('-')) out.push({ kind: 'remove', text: line.slice(1) })
    else out.push({ kind: 'context', text: line.startsWith(' ') ? line.slice(1) : line })
  }
  return out
}

/** Generated files, binary files, unknown counts and large diffs start collapsed. */
export function startsCollapsed(file: ChangedFile): boolean {
  if (file.generated || file.binary || file.added === null || file.deleted === null) return true
  return file.added + file.deleted > LARGE_DIFF_LINES
}

/** One letter per status, as `git status` shows it. */
export const STATUS_LETTER: Record<ChangeStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
}

/** Totals of the list for the header (unknown counts left out). */
export function changeTotals(files: readonly ChangedFile[]): {
  files: number
  added: number
  deleted: number
} {
  return {
    files: files.length,
    added: files.reduce((n, f) => n + (f.added ?? 0), 0),
    deleted: files.reduce((n, f) => n + (f.deleted ?? 0), 0),
  }
}

/** Whether a refresh may run now: at most one per `intervalMs`. */
export function refreshDue(lastAt: number | null, now: number, intervalMs: number): boolean {
  return lastAt === null || now - lastAt >= intervalMs
}
