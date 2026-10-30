/**
 * Fictional data for the screenshot demo (`pnpm --filter @remote-harness/daemon demo`): the sandbox
 * layout, the config and the Claude Code transcripts and status lines of the sessions. The sessions
 * themselves are shared with the app's offline demo (`@remote-harness/protocol/demo`). Pure: the
 * script in `demo.mts` writes it to disk and drives the real daemon with it.
 */
import { join } from 'node:path'
import { DEMO_PROFILES, type DemoEntry, type DemoSession } from '@remote-harness/protocol/demo'

export * from '@remote-harness/protocol/demo'

export const DEMO_WS_PORT = 7437
export const DEMO_HOOK_PORT = 7438
export const DEMO_TMUX_SESSION = 'claude-remote'

/** Folders the demo creates directly under its root; nothing else is written outside them. */
export function demoLayout(root: string) {
  const home = join(root, '.remote-harness-demo')
  return {
    root,
    home,
    tmuxDir: join(home, 'tmux'),
    panesDir: join(home, 'panes'),
    code: join(root, 'code'),
    configDirs: {
      personal: join(root, '.claude'),
      work: join(root, '.claude-work'),
      openrouter: join(root, '.claude-openrouter'),
      codex: join(root, '.codex'),
    },
    /** Top-level paths the manifest lists and `--clean` removes. */
    owned: [
      home,
      join(root, 'code'),
      join(root, '.claude'),
      join(root, '.claude-work'),
      join(root, '.claude-openrouter'),
      join(root, '.codex'),
    ],
  }
}

export type DemoLayout = ReturnType<typeof demoLayout>

/** Paths the demo would create that already exist and are not its own (from an earlier run). */
export function conflictingPaths(
  owned: readonly string[],
  manifest: readonly string[],
  exists: (path: string) => boolean,
): string[] {
  const mine = new Set(manifest)
  return owned.filter((path) => exists(path) && !mine.has(path))
}

export function demoConfig() {
  return {
    profiles: DEMO_PROFILES,
    wsPort: DEMO_WS_PORT,
    hookPort: DEMO_HOOK_PORT,
    tmuxSession: DEMO_TMUX_SESSION,
    // Long enough to take every screenshot of the pending request.
    permissionTimeoutSec: 3000,
    push: 'off',
    tray: false,
    keepAwake: 'off',
    language: 'en-US',
  }
}

/** Where a session works: the repository, or its worktree. */
export function sessionCwd(code: string, session: Pick<DemoSession, 'repo' | 'worktree'>): string {
  const repo = join(code, session.repo)
  return session.worktree ? join(repo, '.claude', 'worktrees', session.worktree) : repo
}

/** Claude Code's folder name for a project: every character other than a letter or digit becomes `-`. */
export function projectDirName(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

/** The session's transcript, as Claude Code writes it (one JSON object per line), oldest first. */
export function transcriptLines(session: DemoSession, cwd: string, now: number): string[] {
  const end = now - session.minutesAgo * 60_000
  // Entries 20 s apart, ending at the last activity.
  const at = (i: number) => new Date(end - (session.entries.length - 1 - i) * 20_000).toISOString()
  const head = [
    { type: 'custom-title', customTitle: session.title, sessionId: session.id },
    { type: 'permission-mode', permissionMode: session.permissionMode, sessionId: session.id },
  ]
  const { lines } = entryLines(session, cwd, session.entries, { startIndex: 0, parent: null, at })
  return [...head.map((line) => JSON.stringify(line)), ...lines]
}

/**
 * Transcript lines of `entries`, numbered from `startIndex` and chained to `parent`, with the
 * timestamp of each entry from `at`. Returns the lines and the uuid the next entry chains to, so a
 * running demo session can keep appending to its transcript.
 */
export function entryLines(
  session: Pick<DemoSession, 'id' | 'branch'>,
  cwd: string,
  entries: readonly DemoEntry[],
  options: { startIndex: number; parent: string | null; at: (index: number) => string },
): { lines: string[]; parent: string | null } {
  const { at } = options
  const base = { isSidechain: false, cwd, sessionId: session.id, gitBranch: session.branch }
  const lines: object[] = []
  let parent = options.parent
  entries.forEach((entry, offset) => {
    const i = options.startIndex + offset
    const uuid = `${session.id.slice(0, 8)}-e${i}`
    const common = { ...base, parentUuid: parent, uuid, timestamp: at(i) }
    const message = `msg-${session.id.slice(0, 8)}-${i}`
    switch (entry.kind) {
      case 'user':
        lines.push({ ...common, type: 'user', message: { role: 'user', content: entry.text } })
        break
      case 'thinking':
        lines.push({
          ...common,
          type: 'assistant',
          message: { id: message, role: 'assistant', content: [{ type: 'thinking', thinking: entry.text }] },
        })
        break
      case 'text':
        lines.push({
          ...common,
          type: 'assistant',
          message: { id: message, role: 'assistant', content: [{ type: 'text', text: entry.text }] },
        })
        break
      case 'tool': {
        const toolId = `toolu_${session.id.slice(0, 8)}_${i}`
        const input = entry.input.file_path
          ? { ...entry.input, file_path: join(cwd, String(entry.input.file_path)) }
          : entry.input
        lines.push({
          ...common,
          type: 'assistant',
          message: {
            id: message,
            role: 'assistant',
            content: [{ type: 'tool_use', id: toolId, name: entry.name, input }],
          },
        })
        if (entry.result !== undefined) {
          const resultUuid = `${uuid}-r`
          lines.push({
            ...base,
            parentUuid: uuid,
            uuid: resultUuid,
            timestamp: at(i),
            type: 'user',
            message: {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolId,
                  content: entry.result,
                  is_error: entry.error ?? false,
                },
              ],
            },
          })
          parent = resultUuid
          return
        }
        break
      }
    }
    parent = uuid
  })
  return { lines: lines.map((line) => JSON.stringify(line)), parent }
}

/** The `/statusline` body the wrapper would post for the session. */
export function statusLineBody(session: DemoSession, transcriptPath: string, now: number) {
  const status = session.status
  if (!status) return null
  const resets = (hours: number) => Math.round(now / 1000 + hours * 3600)
  return {
    session_id: session.id,
    transcript_path: transcriptPath,
    model: status.model,
    effort: { level: status.effort },
    context_window: {
      context_window_size: status.contextSize,
      total_input_tokens: Math.round((status.contextSize * status.contextUsed) / 100),
      used_percentage: status.contextUsed,
    },
    rate_limits: {
      five_hour: { used_percentage: status.fiveHour, resets_at: resets(3.2) },
      seven_day: { used_percentage: status.sevenDay, resets_at: resets(80) },
    },
  }
}
