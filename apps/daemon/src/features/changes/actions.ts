import type { SessionState } from '@remote-harness/protocol'
import { DaemonError } from '../../core/errors.ts'
import { type GitClient, githubCompareUrl } from '../../infra/git.ts'
import type { GitHubCli } from '../../infra/github.ts'
import type { ChangesService } from './service.ts'

/** Commit, push and PR wait for the agent: refused while it works, unless the user insists. */
export function actionAllowed(state: SessionState, force: boolean): boolean {
  return force || state !== 'running'
}

/** The selected paths of a commit plus the old paths of renames, each once. */
export function commitPathsOf(
  selected: readonly string[],
  files: readonly { path: string; oldPath: string | null }[],
): string[] | null {
  const paths = new Set<string>()
  for (const path of selected) {
    const file = files.find((f) => f.path === path)
    if (!file) return null
    paths.add(file.path)
    if (file.oldPath) paths.add(file.oldPath)
  }
  return [...paths]
}

type Git = Pick<
  GitClient,
  'checkout' | 'commitPaths' | 'canCreateBranch' | 'createBranch' | 'push' | 'remoteUrl' | 'defaultBranch'
>

/** Commit, push and PR from the app: fixed git and `gh` operations in the session's checkout. */
export class ChangeActions {
  constructor(
    private readonly changes: ChangesService,
    private readonly git: Git,
    private readonly gh: Pick<GitHubCli, 'available' | 'createPr'>,
  ) {}

  async commit(
    sessionId: string,
    request: { paths: readonly string[]; message: string; newBranch?: string; force?: boolean },
  ): Promise<{ commit: string; branch: string | null }> {
    this.gate(sessionId, request.force)
    const current = await this.changes.current(sessionId)
    if (!current) throw new DaemonError('bad_request', 'the session is not in a git checkout')
    const paths = commitPathsOf(request.paths, current.files)
    if (!paths) throw new DaemonError('bad_request', 'a path is not in the change list')
    const message = request.message.trim()
    if (!message) throw new DaemonError('bad_request', 'empty commit message')
    if (request.newBranch) {
      if (!(await this.git.canCreateBranch(current.root, request.newBranch)))
        throw new DaemonError('bad_request', 'invalid or existing branch name')
      await this.git.createBranch(current.root, request.newBranch)
    }
    const commit = await this.git.commitPaths(current.root, paths, message)
    return { commit, branch: request.newBranch ?? current.branch }
  }

  async push(sessionId: string, force?: boolean): Promise<{ branch: string; compareUrl: string | null }> {
    this.gate(sessionId, force)
    const { root, branch } = await this.branchOf(sessionId)
    await this.git.push(root)
    const remote = await this.git.remoteUrl(root)
    return { branch, compareUrl: remote ? githubCompareUrl(remote, branch) : null }
  }

  /** Pushes, then opens the PR with `gh` against `origin`'s default branch. */
  async pr(
    sessionId: string,
    request: { title: string; body: string; force?: boolean },
  ): Promise<{ url: string }> {
    this.gate(sessionId, request.force)
    if (!(await this.gh.available())) throw new DaemonError('not_found', 'gh is not installed')
    const { root, branch } = await this.branchOf(sessionId)
    await this.git.push(root)
    const base = await this.git.defaultBranch(root)
    const url = await this.gh.createPr(root, {
      title: request.title.trim(),
      body: request.body,
      head: branch,
      base,
    })
    return { url }
  }

  private gate(sessionId: string, force = false): void {
    if (!actionAllowed(this.changes.session(sessionId).state, force))
      throw new DaemonError('session_busy', 'the agent is working: wait for it or force')
  }

  private async branchOf(sessionId: string): Promise<{ root: string; branch: string }> {
    const checkout = await this.git.checkout(this.changes.session(sessionId).cwd)
    if (!checkout) throw new DaemonError('bad_request', 'the session is not in a git checkout')
    if (!checkout.branch) throw new DaemonError('bad_request', 'HEAD is detached: commit on a branch first')
    return { root: checkout.root, branch: checkout.branch }
  }
}
