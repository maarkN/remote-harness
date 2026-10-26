import * as nodeFs from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize } from 'node:path'
import type { ChangeStatus, Checkout, WorktreeInfo } from '@remote-harness/protocol'
import type { Executor } from './exec.ts'

const GIT_TIMEOUT_MS = 5_000
/** Pushes talk to the network. */
const PUSH_TIMEOUT_MS = 60_000
/** Diffs of a whole working tree can take a while on a big repository. */
const DIFF_TIMEOUT_MS = 15_000
/** git's empty tree: the base of a repository without commits. */
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
/** `git worktree remove` deletes the whole folder (node_modules included): only the cross-device fallback uses it. */
const REMOVE_TIMEOUT_MS = 10 * 60_000
/** Inside the repository's git dir: never shown by `git status`, and on the worktree's file system in the usual layout. */
export const TRASH_DIR = 'remote-harness-trash'

/** The worktree's lock is held by a process that is still running (the agent has not left yet). */
export class WorktreeLockedError extends Error {
  constructor(
    readonly pid: number,
    reason: string,
  ) {
    super(`the worktree is locked by a running process (pid ${pid}): ${reason}`)
  }
}

export class GitError extends Error {
  override name = 'GitError'
}

/** File system calls of the worktree removal, injected so tests can fake them. */
export type GitFs = Pick<typeof nodeFs, 'rename' | 'mkdir' | 'rm' | 'readdir' | 'realpath'>

export type GitClientOptions = {
  bin?: string
  fs?: GitFs
  /** Whether a process id is running (stale lock detection). */
  isAlive?: (pid: number) => boolean
  /** Reports a failed background delete of a removed worktree's folder. */
  onPurgeError?: (path: string, error: unknown) => void
}

export type WorktreeEntry = { path: string; branch: string | null; locked: string | null }

/** Entries of `git worktree list --porcelain`; `locked` is the reason (`''` when locked without one). */
export function parseWorktreeList(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = []
  for (const block of output.split(/\n\s*\n/)) {
    let entry: WorktreeEntry | null = null
    for (const line of block.split('\n')) {
      if (line.startsWith('worktree ')) entry = { path: line.slice(9), branch: null, locked: null }
      else if (!entry) continue
      else if (line.startsWith('branch ')) entry.branch = line.slice(7).replace(/^refs\/heads\//, '')
      else if (line === 'locked') entry.locked = ''
      else if (line.startsWith('locked ')) entry.locked = line.slice(7)
    }
    if (entry) entries.push(entry)
  }
  return entries
}

/** The process id a lock reason names (`… (pid 4242 start …)`, as Claude Code writes it), if any. */
export function lockPid(reason: string): number | null {
  const match = /\bpid (\d+)\b/.exec(reason)
  const pid = match ? Number(match[1]) : Number.NaN
  return Number.isInteger(pid) && pid > 0 ? pid : null
}

function defaultIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: it exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** A path of `git diff --name-status`: its status and, for a rename, where it came from. */
export type NameStatus = { path: string; oldPath: string | null; status: ChangeStatus }
/** Line counts of `git diff --numstat`; `null` counts for a binary file. */
export type NumStat = { added: number | null; deleted: number | null; binary: boolean }

/**
 * `git diff --name-status -z`: `M\0path\0`, `R100\0old\0new\0`. Copies count as additions, type
 * changes and unmerged paths as modifications.
 */
export function parseNameStatus(output: string): NameStatus[] {
  const fields = output.split('\0')
  const entries: NameStatus[] = []
  for (let i = 0; i < fields.length; ) {
    const code = fields[i++] ?? ''
    if (!code) continue
    const letter = code[0]
    if (letter === 'R' || letter === 'C') {
      const from = fields[i++] ?? ''
      const to = fields[i++] ?? ''
      if (to)
        entries.push({
          path: to,
          oldPath: letter === 'R' ? from : null,
          status: letter === 'R' ? 'renamed' : 'added',
        })
      continue
    }
    const path = fields[i++] ?? ''
    if (!path) continue
    entries.push({
      path,
      oldPath: null,
      status: letter === 'A' ? 'added' : letter === 'D' ? 'deleted' : 'modified',
    })
  }
  return entries
}

/** `git diff --numstat -z`: `3\t1\tpath\0`, a rename as `0\t0\t\0old\0new\0`, `-\t-\t` for binary. Keyed by the new path. */
export function parseNumstat(output: string): Map<string, NumStat> {
  const fields = output.split('\0')
  const stats = new Map<string, NumStat>()
  for (let i = 0; i < fields.length; ) {
    const head = fields[i++] ?? ''
    const match = /^(-|\d+)\t(-|\d+)\t(.*)$/s.exec(head)
    if (!match) continue
    // An empty path after the counts means a rename: the old and the new path follow.
    let path = match[3] ?? ''
    if (!path) {
      i++
      path = fields[i++] ?? ''
    }
    if (!path) continue
    const binary = match[1] === '-' && match[2] === '-'
    stats.set(path, {
      added: binary ? null : Number(match[1]),
      deleted: binary ? null : Number(match[2]),
      binary,
    })
  }
  return stats
}

const LOCKFILES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  'uv.lock',
  'Pipfile.lock',
  'composer.lock',
  'go.sum',
  'Podfile.lock',
  'flake.lock',
])
const GENERATED_DIRS = new Set(['dist', 'build'])

/** Lockfiles and generated output, which a review starts collapsed. */
export function isGeneratedPath(path: string): boolean {
  const parts = path.split('/')
  const name = parts.at(-1) ?? ''
  if (LOCKFILES.has(name)) return true
  if (/\.generated\.[^.]+$/.test(name) || /\.min\.(js|css)$/.test(name) || name.endsWith('.map')) return true
  return parts.slice(0, -1).some((dir) => GENERATED_DIRS.has(dir))
}

/** A changed path with its counts, before the feature counts untracked files. */
export type GitChange = NameStatus & NumStat & { untracked: boolean }

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** The git calls the daemon needs: where a session works, and its worktree's state and cleanup. Every call goes through the executor. */
export class GitClient {
  private readonly bin: string
  private readonly fs: GitFs
  private readonly isAlive: (pid: number) => boolean
  private readonly onPurgeError: (path: string, error: unknown) => void

  constructor(
    private readonly exec: Executor,
    options: GitClientOptions = {},
  ) {
    this.bin = options.bin ?? 'git'
    this.fs = options.fs ?? nodeFs
    this.isAlive = options.isAlive ?? defaultIsAlive
    this.onPurgeError = options.onPurgeError ?? (() => {})
  }

  private run(dir: string, args: string[], timeoutMs = GIT_TIMEOUT_MS) {
    return this.exec(this.bin, ['-C', dir, ...args], { timeoutMs })
  }

  /**
   * Runs git and throws `GitError` when it fails: git's message, else the timeout (a killed git
   * prints nothing), else the exit code.
   */
  private async must(dir: string, args: string[], timeoutMs = GIT_TIMEOUT_MS): Promise<string> {
    const result = await this.run(dir, args, timeoutMs)
    if (result.exitCode === 0 && !result.timedOut) return result.stdout
    const command = `git ${args.slice(0, 2).join(' ')}`
    const message =
      result.stderr.trim() ||
      (result.timedOut
        ? `${command} timed out after ${Math.round(timeoutMs / 1000)} s`
        : `${command} exited with code ${result.exitCode}`)
    throw new GitError(message)
  }

  /**
   * Root of the worktree that contains `dir` and its branch (`null` when detached), or `null` when
   * `dir` is not inside a git checkout (or git fails for any reason).
   */
  async checkout(dir: string): Promise<Checkout | null> {
    try {
      const top = await this.run(dir, ['rev-parse', '--show-toplevel'])
      const root = top.stdout.trim()
      if (top.exitCode !== 0 || !root) return null
      // symbolic-ref also works in a repository without commits; it fails when HEAD is detached.
      const head = await this.run(dir, ['symbolic-ref', '--short', '-q', 'HEAD'])
      return { root, branch: (head.exitCode === 0 && head.stdout.trim()) || null }
    } catch {
      return null
    }
  }

  /** Whether the repository of `dir` has the local branch `branch` (false when git fails). */
  async hasBranch(dir: string, branch: string): Promise<boolean> {
    try {
      const result = await this.run(dir, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])
      return result.exitCode === 0 && !result.timedOut
    } catch {
      return false
    }
  }

  /**
   * The linked worktree that contains `dir` with its state, or `null` for the repository's main
   * checkout (its git dir is the common dir) and for anything outside git.
   */
  async worktreeInfo(dir: string): Promise<WorktreeInfo | null> {
    try {
      const ids = await this.run(dir, ['rev-parse', '--show-toplevel', '--git-dir', '--git-common-dir'])
      if (ids.exitCode !== 0) return null
      const [top = '', gitDir = '', commonDir = ''] = ids.stdout.split('\n').map((line) => line.trim())
      if (!top || !gitDir || !commonDir) return null
      // git prints the dirs relative to the cwd it ran in (`dir`) when they are inside it.
      const absolute = (p: string) => normalize(isAbsolute(p) ? p : join(dir, p))
      const gitDirAbs = absolute(gitDir)
      const commonAbs = absolute(commonDir)
      if (gitDirAbs === commonAbs) return null
      const head = await this.run(top, ['symbolic-ref', '--short', '-q', 'HEAD'])
      const status = await this.must(top, ['status', '--porcelain'])
      const dirty = status.split('\n').filter((line) => line.trim()).length
      // Commits reachable from HEAD and from no remote ref: covers "ahead of upstream" and "no upstream".
      const unpushedOut = await this.run(top, ['rev-list', '--count', 'HEAD', '--not', '--remotes'])
      const unpushed = unpushedOut.exitCode === 0 ? Number(unpushedOut.stdout.trim()) || 0 : 0
      return {
        path: top,
        branch: (head.exitCode === 0 && head.stdout.trim()) || null,
        mainRoot: dirname(commonAbs),
        dirty,
        unpushed,
      }
    } catch {
      return null
    }
  }

  /**
   * The working tree of the checkout that contains `dir` against `HEAD` (the empty tree before the
   * first commit): tracked changes with their counts, then untracked files (counts unknown here).
   * `null` outside git.
   */
  async changes(
    dir: string,
  ): Promise<{ root: string; branch: string | null; base: string; files: GitChange[] } | null> {
    const checkout = await this.checkout(dir)
    if (!checkout) return null
    const { root } = checkout
    const base = await this.diffBase(root)
    const diff = ['diff', base, '-M', '--no-color', '--no-ext-diff', '-z']
    const names = parseNameStatus(await this.must(root, [...diff, '--name-status'], DIFF_TIMEOUT_MS))
    const counts = parseNumstat(await this.must(root, [...diff, '--numstat'], DIFF_TIMEOUT_MS))
    const others = await this.must(
      root,
      ['ls-files', '--others', '--exclude-standard', '-z'],
      DIFF_TIMEOUT_MS,
    )
    const tracked: GitChange[] = names.map((entry) => ({
      ...entry,
      ...(counts.get(entry.path) ?? { added: null, deleted: null, binary: false }),
      untracked: false,
    }))
    const untracked: GitChange[] = others
      .split('\0')
      .filter(Boolean)
      .map((path) => ({
        path,
        oldPath: null,
        status: 'added',
        added: null,
        deleted: null,
        binary: false,
        untracked: true,
      }))
    return { root, branch: checkout.branch, base, files: [...tracked, ...untracked] }
  }

  /** `HEAD`, or git's empty tree when the repository has no commit yet. */
  private async diffBase(root: string): Promise<string> {
    const head = await this.run(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])
    return head.exitCode === 0 && !head.timedOut ? 'HEAD' : EMPTY_TREE
  }

  /** The unified diff of one changed file; an untracked file is diffed against nothing. */
  async fileDiff(
    root: string,
    base: string,
    file: Pick<GitChange, 'path' | 'oldPath' | 'untracked'>,
  ): Promise<string> {
    const options = ['--no-color', '--no-ext-diff']
    if (file.untracked) {
      // `--no-index` exits 1 when the files differ, which they always do here.
      const result = await this.run(
        root,
        ['diff', '--no-index', ...options, '--', '/dev/null', file.path],
        DIFF_TIMEOUT_MS,
      )
      if (result.exitCode > 1 || result.timedOut)
        throw new GitError(result.stderr.trim() || 'git diff failed')
      return result.stdout
    }
    const paths = file.oldPath ? [file.oldPath, file.path] : [file.path]
    return this.must(root, ['diff', base, '-M', ...options, '--', ...paths], DIFF_TIMEOUT_MS)
  }

  /** Stages everything and commits it (hooks skipped: this is a save, not a review); no-op when clean. */
  async commitAll(dir: string, message: string): Promise<void> {
    await this.must(dir, ['add', '-A'])
    const status = await this.must(dir, ['status', '--porcelain'])
    if (!status.trim()) return
    await this.must(dir, ['commit', '--no-verify', '-m', message])
  }

  /** Pushes HEAD to `origin`, creating the upstream when the branch has none. */
  async push(dir: string): Promise<void> {
    await this.must(dir, ['push', '-u', 'origin', 'HEAD'], PUSH_TIMEOUT_MS)
  }

  /**
   * Removes a linked worktree from its main checkout and deletes its branch: safely (`-d`, only when
   * merged) by default, forced (`-D`) when discarding. The main checkout itself is never touched.
   * It completes or leaves the worktree untouched: a stale lock is removed, the folder is moved out
   * of place in one rename, the entry is pruned, and the moved folder is deleted in the background
   * (`purged`). The caller checks for changes first: `git worktree remove`'s own check does not run.
   */
  async removeWorktree(
    info: Pick<WorktreeInfo, 'path' | 'branch' | 'mainRoot'>,
    options: { force?: boolean } = {},
  ): Promise<{ purged: Promise<void> }> {
    const { mainRoot, path } = info
    // The agent may already have removed it (Claude Code removes a clean worktree when it exits):
    // only git's records and the branch are left.
    if ((await this.fs.realpath(path).catch(() => null)) === null) {
      await this.must(mainRoot, ['worktree', 'prune'])
      if (info.branch) await this.run(mainRoot, ['branch', options.force ? '-D' : '-d', info.branch])
      return { purged: Promise.resolve() }
    }
    await this.releaseLock(mainRoot, path)
    const common = (
      await this.must(mainRoot, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
    ).trim()
    const trash = join(common, TRASH_DIR)
    let moved = true
    try {
      await this.fs.mkdir(trash, { recursive: true })
      await this.fs.rename(path, join(trash, `${basename(path)}-${Date.now()}`))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
        throw new GitError(`could not move the worktree folder: ${errorText(error)}`)
      }
      // Another file system: git deletes it in place, with time to finish.
      moved = false
      const force = options.force ? ['--force'] : []
      await this.must(mainRoot, ['worktree', 'remove', ...force, path], REMOVE_TIMEOUT_MS)
    }
    await this.must(mainRoot, ['worktree', 'prune'])
    if (info.branch) await this.run(mainRoot, ['branch', options.force ? '-D' : '-d', info.branch])
    return { purged: moved ? this.purge(trash) : Promise.resolve() }
  }

  /**
   * The worktree's lock: its reason, the process it names and whether that process still runs;
   * null when it is not locked (or git does not list it).
   */
  async worktreeLock(
    mainRoot: string,
    path: string,
  ): Promise<{ reason: string; pid: number | null; alive: boolean } | null> {
    const list = parseWorktreeList(await this.must(mainRoot, ['worktree', 'list', '--porcelain']))
    const real = await this.fs.realpath(path).catch(() => path)
    let entry: WorktreeEntry | undefined
    for (const item of list) {
      if (item.path === path || (await this.fs.realpath(item.path).catch(() => item.path)) === real) {
        entry = item
        break
      }
    }
    if (!entry || entry.locked === null) return null
    const pid = lockPid(entry.locked)
    return { reason: entry.locked, pid, alive: pid !== null && this.isAlive(pid) }
  }

  /** Removes a lock left by a process that is gone; a lock held by a running process stops the removal. */
  private async releaseLock(mainRoot: string, path: string): Promise<void> {
    const lock = await this.worktreeLock(mainRoot, path)
    if (!lock) return
    if (lock.alive && lock.pid !== null) throw new WorktreeLockedError(lock.pid, lock.reason)
    await this.must(mainRoot, ['worktree', 'unlock', path])
  }

  /** Deletes everything in the trash folder: this removal and leftovers of interrupted ones. Never throws. */
  private async purge(trash: string): Promise<void> {
    const names = await this.fs.readdir(trash).catch(() => [] as string[])
    for (const name of names) {
      const path = join(trash, String(name))
      await this.fs
        .rm(path, { recursive: true, force: true, maxRetries: 3 })
        .catch((error: unknown) => this.onPurgeError(path, error))
    }
  }
}
