import type {
  AccountLimits,
  ChangedFile,
  KeyPair,
  PermissionRequestInfo,
  Profile,
  Session,
  SubagentInfo,
  TranscriptEntry,
} from '@remote-harness/protocol'
import {
  DEMO_HOST_NAME,
  DEMO_PROFILES,
  DEMO_REPOS,
  DEMO_SESSIONS,
  type DemoEntry,
  type DemoSession,
  type DemoSubagent,
} from '@remote-harness/protocol/demo'
import type { Computer } from '@/core/storage/computer'
import type { SessionPrefs } from '@/features/sessions/filter'

/** The demo computer's fictional home folder and where its repositories live. */
export const DEMO_HOME = '/Users/demo'
export const DEMO_CODE = `${DEMO_HOME}/code`
/** Stand-in daemon ID of the demo computer (never saved). */
export const DEMO_DAEMON_ID = 'demo'
/** Lifetime of the demo's permission request, as the daemon demo uses (`permissionTimeoutSec`). */
export const DEMO_PERMISSION_MS = 50 * 60_000
/** Time between two fixture entries, ending at the session's last activity. */
const ENTRY_SPACING_MS = 20_000

export const DEMO_SESSION_IDS: readonly string[] = DEMO_SESSIONS.map((s) => s.id)

const iso = (ms: number) => new Date(ms).toISOString()

export function demoProfiles(): Profile[] {
  return DEMO_PROFILES.map((p) => ({ ...p }))
}

/** Where a session works: its repository under `~/code`, or that repository's worktree. */
export function demoCwd(session: Pick<DemoSession, 'repo' | 'worktree'>): string {
  const repo = `${DEMO_CODE}/${session.repo}`
  return session.worktree ? `${repo}/.claude/worktrees/${session.worktree}` : repo
}

/** A fixture `file_path` (relative to the session's folder) made absolute, as the agent writes it. */
function absoluteInput(input: Record<string, unknown>, cwd: string): Record<string, unknown> {
  return typeof input.file_path === 'string' ? { ...input, file_path: `${cwd}/${input.file_path}` } : input
}

/** The tool use ID of a fixture entry (shared by its result and a later permission answer). */
export function demoToolUseId(sessionId: string, index: number): string {
  return `toolu_${sessionId.slice(0, 8)}_${index}`
}

/**
 * Transcript entries of fixture `entries`, one transcript line each from `startCursor` (a tool call
 * and its result are two lines), as the daemon parses them. `at(i)` dates the `i`-th fixture entry.
 */
export function demoEntries(
  owner: { id: string; sidechain?: boolean },
  cwd: string,
  entries: readonly DemoEntry[],
  options: { startCursor: number; startIndex?: number; at: (index: number) => string },
): TranscriptEntry[] {
  const out: TranscriptEntry[] = []
  const isSidechain = owner.sidechain ?? false
  let cursor = options.startCursor
  const base = (uuid: string, timestamp: string) => {
    const line = cursor
    cursor += 1
    return { key: `${uuid}:0`, cursor: line, index: 0, uuid, timestamp, isSidechain }
  }
  entries.forEach((entry, offset) => {
    const i = (options.startIndex ?? 0) + offset
    const uuid = `${owner.id.slice(0, 8)}-e${i}`
    const timestamp = options.at(i)
    switch (entry.kind) {
      case 'user':
        out.push({ ...base(uuid, timestamp), kind: 'user', text: entry.text, images: [] })
        break
      case 'thinking':
        out.push({ ...base(uuid, timestamp), kind: 'thinking', text: entry.text })
        break
      case 'text':
        out.push({ ...base(uuid, timestamp), kind: 'assistant_text', text: entry.text })
        break
      case 'tool': {
        const toolUseId = demoToolUseId(owner.id, i)
        out.push({
          ...base(uuid, timestamp),
          kind: 'tool_use',
          toolUseId,
          name: entry.name,
          input: absoluteInput(entry.input, cwd),
        })
        if (entry.result !== undefined) {
          out.push({
            ...base(`${uuid}-r`, timestamp),
            kind: 'tool_result',
            toolUseId,
            content: entry.result,
            isError: entry.error ?? false,
            truncated: false,
            images: [],
          })
        }
        break
      }
    }
  })
  return out
}

/** Timestamps of a fixture's entries: `ENTRY_SPACING_MS` apart, the last one `minutesAgo` before `now`. */
export function entryClock(count: number, minutesAgo: number, now: number): (index: number) => string {
  const end = now - minutesAgo * 60_000
  return (index) => iso(end - (count - 1 - index) * ENTRY_SPACING_MS)
}

export function demoTranscript(session: DemoSession, now: number): TranscriptEntry[] {
  return demoEntries(session, demoCwd(session), session.entries, {
    startCursor: 0,
    at: entryClock(session.entries.length, session.minutesAgo, now),
  })
}

export function demoSubagentTranscript(
  session: DemoSession,
  subagent: DemoSubagent,
  now: number,
): TranscriptEntry[] {
  return demoEntries({ id: subagent.agentId, sidechain: true }, demoCwd(session), subagent.entries, {
    startCursor: 0,
    at: (index) => iso(now - subagent.minutesAgo * 60_000 + index * ENTRY_SPACING_MS),
  })
}

export function demoSubagentInfo(subagent: DemoSubagent, now: number): SubagentInfo {
  const startedAt = now - subagent.minutesAgo * 60_000
  const lastAt = startedAt + Math.max(0, subagent.entries.length - 1) * ENTRY_SPACING_MS
  return {
    agentId: subagent.agentId,
    agentType: subagent.agentType,
    description: subagent.description,
    state: subagent.state,
    updatedAt: iso(Math.min(now, lastAt)),
    startedAt: iso(startedAt),
    toolCount: subagent.entries.filter((e) => e.kind === 'tool').length,
  }
}

export function demoSession(session: DemoSession, index: number, now: number): Session {
  const profile = DEMO_PROFILES.find((p) => p.id === session.profileId)
  const live = session.state !== 'ended'
  const cwd = demoCwd(session)
  const status = session.status
  return {
    id: session.id,
    profileId: session.profileId,
    ...(profile?.agent ? { agent: profile.agent } : {}),
    cwd,
    title: session.title,
    state: session.state,
    permissionMode: session.permissionMode,
    approvalPolicy: null,
    permissionProfile: null,
    controllable: live,
    paneId: live ? `%${index + 1}` : null,
    updatedAt: iso(now - session.minutesAgo * 60_000),
    subagents: (session.subagents ?? []).map((s) => demoSubagentInfo(s, now)),
    backgroundTasks: 0,
    checkout: { root: cwd, branch: session.branch },
    status: status
      ? {
          model: status.model.display_name,
          effort: status.effort,
          context: {
            usedTokens: Math.round((status.contextSize * status.contextUsed) / 100),
            size: status.contextSize,
            percent: status.contextUsed,
          },
        }
      : null,
  }
}

/** The request a waiting session asks, as the daemon sends it (`permission.request`). */
export function demoPermission(session: DemoSession, now: number): PermissionRequestInfo | null {
  const permission = session.permission
  if (!permission) return null
  const command = typeof permission.input.command === 'string' ? permission.input.command : null
  return {
    requestId: `perm-${session.id.slice(0, 8)}`,
    sessionId: session.id,
    profileId: session.profileId,
    tool: permission.toolName,
    input: permission.input,
    suggestedRule: command ? `${permission.toolName}(${command.split(' ').slice(0, 2).join(' ')}:*)` : null,
    rules: true,
    defaultScope: 'project',
    createdAt: iso(now),
    expiresAt: iso(now + DEMO_PERMISSION_MS),
  }
}

/** Usage limits of the profiles whose sessions report a status line. */
export function demoLimits(now: number): AccountLimits[] {
  const seen = new Map<string, AccountLimits>()
  for (const session of DEMO_SESSIONS) {
    const status = session.status
    if (!status || seen.has(session.profileId)) continue
    seen.set(session.profileId, {
      profileId: session.profileId,
      fiveHour: { percent: status.fiveHour, resetsAt: Math.round(now + 3.2 * 3_600_000) },
      sevenDay: { percent: status.sevenDay, resetsAt: Math.round(now + 80 * 3_600_000) },
      updatedAt: iso(now),
    })
  }
  return [...seen.values()]
}

type Edit = { path: string; before: string[]; after: string[] }

/** The files a session's `Edit` calls changed, with the lines each one removed and added. */
function sessionEdits(session: DemoSession): Edit[] {
  const edits = new Map<string, Edit>()
  for (const entry of session.entries) {
    if (entry.kind !== 'tool' || entry.name !== 'Edit' || entry.result === undefined) continue
    const path = String(entry.input.file_path)
    const before = String(entry.input.old_string).split('\n')
    const after = String(entry.input.new_string).split('\n')
    const edit = edits.get(path) ?? { path, before: [], after: [] }
    edit.before.push(...before.filter((l) => !after.includes(l)))
    edit.after.push(...after.filter((l) => !before.includes(l)))
    edits.set(path, edit)
  }
  return [...edits.values()]
}

/** The working-tree changes of a session (`changes.result` files), from its edits. */
export function demoChanges(session: DemoSession): ChangedFile[] {
  return sessionEdits(session).map((edit) => ({
    path: edit.path,
    oldPath: null,
    status: 'modified',
    added: edit.after.length,
    deleted: edit.before.length,
    binary: false,
    generated: false,
    untracked: false,
  }))
}

/** A changed file's unified diff, as `git diff` prints it; null for a path that did not change. */
export function demoDiff(session: DemoSession, path: string): string[] | null {
  const edit = sessionEdits(session).find((e) => e.path === path)
  if (!edit) return null
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${edit.before.length} +1,${edit.after.length} @@`,
    ...edit.before.map((l) => `-${l}`),
    ...edit.after.map((l) => `+${l}`),
  ]
}

/** Folders the demo computer lists under its home (`directories.list`): `~/code` and its repositories. */
export function demoDirectories(path: string): { name: string; path: string; git: boolean }[] | null {
  if (path === DEMO_HOME) return [{ name: 'code', path: DEMO_CODE, git: false }]
  if (path === DEMO_CODE) {
    return DEMO_REPOS.map((repo) => ({ name: repo.name, path: `${DEMO_CODE}/${repo.name}`, git: true }))
  }
  return DEMO_REPOS.some((repo) => path === `${DEMO_CODE}/${repo.name}`) ? [] : null
}

/** The demo computer as the connection store holds it (pinned to the run's key; never saved). */
export function demoComputer(daemonKey: Uint8Array, deviceKey: KeyPair): Computer {
  return {
    daemonId: DEMO_DAEMON_ID,
    daemonKey,
    deviceKey,
    addresses: [`${DEMO_HOST_NAME}:7437`],
    relays: [],
    name: DEMO_HOST_NAME,
  }
}

/** Session preferences without the demo's sessions (what leaving the demo keeps). */
export function withoutDemoSessions(prefs: SessionPrefs): SessionPrefs {
  const demo = new Set(DEMO_SESSION_IDS)
  return {
    pinned: prefs.pinned.filter((id) => !demo.has(id)),
    hidden: prefs.hidden.filter((id) => !demo.has(id)),
  }
}
