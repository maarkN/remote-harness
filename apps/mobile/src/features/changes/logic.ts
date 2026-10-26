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

/** Branches a push to gets an extra warning. */
export function isProtectedBranch(branch: string | null): boolean {
  return branch === 'main' || branch === 'master'
}

/**
 * The session is on the repository's default branch (`origin/HEAD`, or `main`/`master` when the
 * remote never said): the commit confirmation offers a new branch first.
 */
export function onDefaultBranch(branch: string | null, defaultBranch: string | null): boolean {
  if (!branch) return false
  return defaultBranch ? branch === defaultBranch : isProtectedBranch(branch)
}

const BRANCH_MAX = 40

/** A branch name from a commit message's first line: `fix(mobile): Keep it` → `fix-mobile-keep-it`. */
export function branchNameFrom(message: string): string {
  const words = (message.split('\n')[0] ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  let name = ''
  for (const word of words) {
    const next = name ? `${name}-${word}` : word
    if (next.length > BRANCH_MAX) break
    name = next
  }
  return name || (words[0] ?? '').slice(0, BRANCH_MAX) || 'changes'
}

/** Commit, push and PR wait for the agent unless the user chose "Do it anyway". */
export function actionBlocked(state: string | undefined, forced: boolean): boolean {
  return state === 'running' && !forced
}

/** The paths to commit: every listed file the user did not leave out. */
export function selectedPaths(files: readonly ChangedFile[], excluded: ReadonlySet<string>): string[] {
  return files.filter((f) => !excluded.has(f.path)).map((f) => f.path)
}
