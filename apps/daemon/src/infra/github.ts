import type { Executor } from './exec.ts'

/** Opening a pull request talks to GitHub. */
const GH_TIMEOUT_MS = 60_000

export class GitHubCliError extends Error {
  override name = 'GitHubCliError'
}

/** The pull request URL in `gh pr create`'s output: its last `https://` line. */
export function prUrlOf(stdout: string): string | null {
  const lines = stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^https:\/\/\S+$/.test(l))
  return lines.at(-1) ?? null
}

/** The `gh` calls the daemon makes; every one goes through the executor. */
export class GitHubCli {
  constructor(
    private readonly exec: Executor,
    private readonly bin = 'gh',
  ) {}

  /** Whether `gh` is on the daemon's PATH. */
  async available(): Promise<boolean> {
    try {
      return (await this.exec('which', [this.bin], { timeoutMs: 5_000 })).exitCode === 0
    } catch {
      return false
    }
  }

  /** Opens a pull request for `head` (already pushed) against `base` (gh's default when null). */
  async createPr(
    root: string,
    pr: { title: string; body: string; head: string; base: string | null },
  ): Promise<string> {
    const args = ['pr', 'create', '--title', pr.title, '--body', pr.body, '--head', pr.head]
    if (pr.base) args.push('--base', pr.base)
    const result = await this.exec(this.bin, args, { cwd: root, timeoutMs: GH_TIMEOUT_MS })
    const url = result.exitCode === 0 && !result.timedOut ? prUrlOf(result.stdout) : null
    if (url) return url
    throw new GitHubCliError(
      result.stderr.trim() ||
        (result.timedOut ? 'gh pr create timed out' : `gh exited with code ${result.exitCode}`),
    )
  }
}
