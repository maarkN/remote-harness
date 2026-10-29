import { tmpdir } from 'node:os'
import type { Profile } from '@remote-harness/protocol'
import { DaemonError } from '../../core/errors.ts'
import type { Executor } from '../../infra/exec.ts'
import type { GitClient } from '../../infra/git.ts'
import { agentFor } from '../agents/index.ts'
import { oneShotEnv } from '../agents/one-shot.ts'
import type { ChangesService } from './service.ts'

/** How much of the diff (or the log) the agent CLI reads. */
export const GENERATE_INPUT_MAX = 60_000
const GENERATE_TIMEOUT_MS = 45_000

const COMMIT_PROMPT = 'Write the git commit message for the changes on standard input.'
const COMMIT_SYSTEM = [
  'You write git commit messages.',
  'Reply with the message only: a summary line in the imperative mood of at most 72 characters,',
  'then optionally a blank line and a short body that explains why.',
  'Follow the style of the recent commit subjects you are given. No code fences, no quotes.',
].join(' ')
const PR_PROMPT = 'Write the pull request title and body for the commits on standard input.'
const PR_SYSTEM = [
  'You write GitHub pull request descriptions.',
  'Reply with only: a title of at most 72 characters on the first line, a blank line,',
  'then a Markdown body with a one-sentence summary and a bullet list of the changes.',
  'No code fences around the reply.',
].join(' ')

/** The material cut at `max` characters, on a line boundary when there is one. */
export function clipInput(text: string, max = GENERATE_INPUT_MAX): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const line = cut.lastIndexOf('\n')
  return `${line > 0 ? cut.slice(0, line) : cut}\n[…]\n`
}

/** The agent's reply as a title (first non-empty line, without heading marks or quotes) and a body. */
export function splitMessage(reply: string): { title: string; body: string } {
  const lines = reply.trim().split('\n')
  const first = lines.findIndex((l) => l.trim() !== '')
  const title = (lines[first] ?? '')
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/^(?:title:\s*)/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim()
  const body = lines
    .slice(first + 1)
    .join('\n')
    .trim()
  return { title, body }
}

type Git = Pick<GitClient, 'fileDiff' | 'recentSubjects' | 'defaultBranch' | 'branchSummary'>

/** Commit messages and PR descriptions written by the session profile's agent CLI (one-shot call). */
export class MessageWriter {
  constructor(
    private readonly changes: ChangesService,
    private readonly git: Git,
    private readonly exec: Executor,
    private readonly profiles: readonly Profile[],
  ) {}

  async generate(sessionId: string, kind: 'commit' | 'pr', paths?: readonly string[]) {
    const session = this.changes.session(sessionId)
    const profile = this.profiles.find((p) => p.id === session.profileId)
    const adapter = profile ? agentFor(profile) : null
    if (!profile || !adapter?.polish || profile.provider)
      throw new DaemonError('not_found', "this session's agent cannot write messages")
    const current = await this.changes.current(sessionId)
    if (!current) throw new DaemonError('bad_request', 'the session is not in a git checkout')
    const input =
      kind === 'commit' ? await this.commitInput(current, paths) : await this.prInput(current.root)
    const result = await this.exec(
      adapter.command,
      adapter.polish.args(
        kind === 'commit' ? COMMIT_PROMPT : PR_PROMPT,
        kind === 'commit' ? COMMIT_SYSTEM : PR_SYSTEM,
      ),
      {
        cwd: tmpdir(),
        env: oneShotEnv(profile, adapter),
        input: clipInput(input),
        timeoutMs: GENERATE_TIMEOUT_MS,
      },
    )
    const reply = result.exitCode === 0 && !result.timedOut ? adapter.polish.parse(result.stdout) : null
    const message = reply ? splitMessage(reply) : null
    if (!message?.title) throw new DaemonError('internal', 'the agent did not write a message')
    return message
  }

  private async commitInput(
    current: NonNullable<Awaited<ReturnType<ChangesService['current']>>>,
    paths: readonly string[] | undefined,
  ): Promise<string> {
    const selected = paths ? current.files.filter((f) => paths.includes(f.path)) : current.files
    if (selected.length === 0) throw new DaemonError('bad_request', 'no file selected')
    const subjects = await this.git.recentSubjects(current.root)
    const parts = [`Recent commit subjects:\n${subjects.join('\n')}\n\nDiff:\n`]
    let size = parts[0]?.length ?? 0
    for (const file of selected) {
      if (size > GENERATE_INPUT_MAX) break
      const diff = file.binary
        ? `Binary file ${file.path} changed\n`
        : await this.git.fileDiff(current.root, current.base, file)
      parts.push(diff)
      size += diff.length
    }
    return parts.join('')
  }

  private async prInput(root: string): Promise<string> {
    const base = await this.git.defaultBranch(root)
    const { log, stat } = await this.git.branchSummary(root, base)
    return `Commits:\n${log}\n\nFiles changed:\n${stat}`
  }
}
