import {
  type ApprovalEntry,
  type ClientMessage,
  type ClientMessageOf,
  type ErrorCode,
  KeySchema,
  lastActivityOf,
  type MuteState,
  type PermissionRequestInfo,
  PROTOCOL_VERSION,
  type RuleFile,
  SelectableModeSchema,
  type ServerMessage,
  type Session,
  type TranscriptEntry,
} from '@remote-harness/protocol'
import {
  DEMO_HOST_NAME,
  DEMO_SESSIONS,
  type DemoEntry,
  type DemoSession,
  paneText,
} from '@remote-harness/protocol/demo'
import {
  DEMO_CODE,
  DEMO_HOME,
  demoChanges,
  demoCwd,
  demoDiff,
  demoDirectories,
  demoEntries,
  demoLimits,
  demoPermission,
  demoProfiles,
  demoSession,
  demoSubagentTranscript,
  demoToolUseId,
  demoTranscript,
} from './fixtures'

/** Texts the demo daemon writes itself, in the app's language. */
export type DemoLabels = {
  /** Error message of a request the demo does not simulate. */
  unavailable: string
  /** The agent's answer to a prompt sent in the demo. */
  reply: string
}

/** Runs `fn` after `ms`; returns a cancel function. */
export type DemoScheduler = (fn: () => void, ms: number) => () => void

export type DemoDaemonOptions = {
  labels: DemoLabels
  /** Reported as the daemon's version (the app's own, so no update is suggested). */
  daemonVersion: string
  /** This device, as `devices.list` shows it. */
  device: { name: string; platform: string }
  now?: () => number
  schedule?: DemoScheduler
}

/** How long the fictional agent "works" before answering. */
export const DEMO_TURN_MS = 1_500
const PANE_COLS = 60
const PANE_ROWS = 40

type DemoState = {
  fixture: DemoSession
  wire: Session
  entries: TranscriptEntry[]
  /** The next fixture entry index (keeps uuids and tool use IDs unique). */
  nextIndex: number
  subagents: Map<string, TranscriptEntry[]>
}

class DemoError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
  }
}

/** A reply before its `replyTo` (the demo daemon adds it, like the real router). */
type Reply = ServerMessage extends infer M ? (M extends unknown ? Omit<M, 'replyTo'> : never) : never

const iso = (ms: number) => new Date(ms).toISOString()
const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path

const defaultSchedule: DemoScheduler = (fn, ms) => {
  const timer = setTimeout(fn, ms)
  return () => clearTimeout(timer)
}

/**
 * A fictional daemon living in the app (offline demo): answers each client message the way the real
 * daemon does, from the shared demo fixtures, and pushes the events that follow (a turn finishing, a
 * request resolved). No I/O: the replies and events go to `emit`, timers through `schedule`.
 */
export class DemoDaemon {
  private readonly now: () => number
  private readonly schedule: DemoScheduler
  private readonly sessions = new Map<string, DemoState>()
  private readonly pending = new Map<string, PermissionRequestInfo>()
  private readonly transcripts = new Set<string>()
  private readonly panes = new Set<string>()
  private readonly timers = new Set<() => void>()
  private readonly approvals: ApprovalEntry[] = []
  private readonly appRules: { rule: string; ruleId: string; createdAt: string; cwd: string }[] = []
  private muted: MuteState = { profiles: [], sessions: [] }
  private seq = 0

  constructor(
    private readonly options: DemoDaemonOptions,
    private readonly emit: (message: ServerMessage) => void,
  ) {
    this.now = options.now ?? Date.now
    this.schedule = options.schedule ?? defaultSchedule
    const now = this.now()
    DEMO_SESSIONS.forEach((source, index) => {
      const fixture = JSON.parse(JSON.stringify(source)) as DemoSession
      const subagents = new Map(
        (fixture.subagents ?? []).map((s) => [s.agentId, demoSubagentTranscript(fixture, s, now)] as const),
      )
      this.sessions.set(fixture.id, {
        fixture,
        wire: demoSession(fixture, index, now),
        entries: demoTranscript(fixture, now),
        nextIndex: fixture.entries.length,
        subagents,
      })
      const request = demoPermission(fixture, now)
      if (request) this.pending.set(request.requestId, request)
    })
  }

  /** Cancels the turns still running (the demo socket closed). */
  dispose(): void {
    for (const cancel of this.timers) cancel()
    this.timers.clear()
  }

  /** Answers one request; a refused one gets `error` like the real daemon's. */
  handle(message: ClientMessage): void {
    try {
      const reply = this.answer(message)
      this.emit({ ...(reply ?? { type: 'ack' }), replyTo: message.id } as ServerMessage)
      if (message.type === 'auth') this.replayOnConnect()
      if (message.type === 'pane.subscribe') this.sendPane(message.sessionId)
    } catch (error) {
      const code = error instanceof DemoError ? error.code : 'internal'
      const text = error instanceof Error ? error.message : String(error)
      this.emit({ type: 'error', replyTo: message.id, code, message: text })
    }
  }

  private unavailable(): DemoError {
    return new DemoError('bad_request', this.options.labels.unavailable)
  }

  private answer(message: ClientMessage): Reply | undefined {
    const now = this.now()
    switch (message.type) {
      case 'auth':
        if (message.protocolVersion !== PROTOCOL_VERSION)
          throw new DemoError('protocol_mismatch', 'protocol mismatch')
        return {
          type: 'auth.ok',
          protocolVersion: PROTOCOL_VERSION,
          daemonVersion: this.options.daemonVersion,
          host: DEMO_HOST_NAME,
          profiles: demoProfiles(),
          defaultRuleScope: 'project',
          muted: this.muted,
          push: { mode: 'off' },
          update: { channel: 'main' },
          commands: { enabled: false },
        }
      case 'ping':
        return { type: 'pong' }
      case 'sessions.list':
        return { type: 'sessions.snapshot', sessions: [...this.sessions.values()].map((s) => s.wire) }
      case 'session.subscribe': {
        const entries = this.stream(message.sessionId, message.agentId)
        this.transcripts.add(this.streamKey(message.sessionId, message.agentId))
        const since = message.sinceCursor
        return {
          type: 'transcript.page',
          sessionId: message.sessionId,
          ...(message.agentId ? { agentId: message.agentId } : {}),
          entries: since === undefined ? entries : entries.filter((e) => e.cursor > since),
          hasMore: false,
          lineCount: entries.length,
        }
      }
      case 'session.unsubscribe':
        this.transcripts.delete(this.streamKey(message.sessionId, message.agentId))
        return undefined
      case 'session.history': {
        const entries = this.stream(message.sessionId, message.agentId)
        const older = entries.filter((e) => e.cursor < message.before)
        return {
          type: 'transcript.page',
          sessionId: message.sessionId,
          ...(message.agentId ? { agentId: message.agentId } : {}),
          entries: older.slice(-message.limit),
          hasMore: older.length > message.limit,
          lineCount: entries.length,
        }
      }
      case 'session.input':
        return this.input(message)
      case 'session.key':
        this.live(message.sessionId)
        if (!KeySchema.safeParse(message.key).success) throw new DemoError('invalid_key', 'key not allowed')
        return undefined
      case 'session.setMode':
        this.setMode(message.sessionId, message.mode)
        return undefined
      case 'permission.respond':
        this.resolve(message.requestId, message.decision === 'allow', message.always?.rule)
        return undefined
      case 'permission.answer':
        this.resolve(message.requestId, true)
        return undefined
      case 'permissions.list':
        return { type: 'permissions.result', requests: [...this.pending.values()] }
      case 'pane.subscribe':
        this.live(message.sessionId)
        this.panes.add(message.sessionId)
        return undefined
      case 'pane.unsubscribe':
        this.panes.delete(message.sessionId)
        return undefined
      case 'pane.focus':
        this.live(message.sessionId)
        return undefined
      case 'session.close':
        return { type: 'ack', data: this.close(message.sessionId) }
      case 'worktree.inspect':
        this.session(message.sessionId)
        return { type: 'worktree.info', worktree: null }
      case 'settings.mute':
        this.mute(message.target, message.targetId, message.muted)
        return undefined
      case 'files.search':
        return {
          type: 'files.results',
          query: message.query,
          items: this.files(message.sessionId, message.query, message.limit),
        }
      case 'commands.list':
        this.session(message.sessionId)
        return {
          type: 'commands.results',
          items: [
            {
              name: 'clear',
              description: 'Clear the conversation history',
              source: 'builtin',
              interactive: false,
            },
            {
              name: 'compact',
              description: 'Summarize the conversation to free context',
              source: 'builtin',
              interactive: false,
            },
            {
              name: 'review',
              description: 'Review the current changes',
              source: 'project',
              interactive: false,
            },
          ],
        }
      case 'projects.list':
        return { type: 'projects.results', items: this.projects(message.profileId) }
      case 'models.list':
        if (message.profileId !== 'openrouter') throw new DemoError('bad_request', 'no provider')
        return {
          type: 'models.results',
          profileId: message.profileId,
          models: [
            {
              id: 'anthropic/claude-sonnet-5.5',
              name: 'Claude Sonnet 5.5',
              contextLength: 200_000,
              promptPrice: 3,
              completionPrice: 15,
              tools: true,
              reasoning: true,
              caching: true,
            },
            {
              id: 'anthropic/claude-haiku-5.5',
              name: 'Claude Haiku 5.5',
              contextLength: 200_000,
              promptPrice: 1,
              completionPrice: 5,
              tools: true,
              reasoning: false,
              caching: true,
            },
          ],
          fetchedAt: iso(now),
          stale: false,
        }
      case 'provider.status':
        if (message.profileId !== 'openrouter') throw new DemoError('bad_request', 'no provider')
        return {
          type: 'provider.info',
          profileId: message.profileId,
          hasKey: true,
          credits: { total: 20, used: 4.35 },
        }
      case 'voice.polish':
        return { type: 'voice.polish.result', text: message.text, applied: false }
      case 'directories.list':
        return this.directories(message.path, message.prefix, message.hidden)
      case 'checkout.inspect': {
        const repo = [...this.sessions.values()].find((s) => message.cwd === s.wire.cwd)
        return {
          type: 'checkout.info',
          checkout: repo ? { root: repo.wire.cwd, branch: repo.fixture.branch } : null,
          peers: repo && repo.wire.state !== 'ended' ? [{ id: repo.wire.id, title: repo.wire.title }] : [],
        }
      }
      case 'changes.list': {
        const { fixture, wire } = this.session(message.sessionId)
        return {
          type: 'changes.result',
          root: wire.cwd,
          branch: fixture.branch,
          files: demoChanges(fixture),
          remote: `https://example.com/acme/${fixture.repo}.git`,
          defaultBranch: 'main',
          unpushed: 0,
          gh: false,
        }
      }
      case 'changes.diff': {
        const lines = demoDiff(this.session(message.sessionId).fixture, message.path)
        if (!lines) throw new DemoError('not_found', 'not a changed file')
        const offset = message.offset ?? 0
        return {
          type: 'changes.diffResult',
          path: message.path,
          offset,
          total: lines.length,
          lines: lines.slice(offset),
          binary: false,
        }
      }
      case 'daemon.update.check':
        return {
          type: 'daemon.update.info',
          info: {
            current: this.options.daemonVersion,
            channel: message.channel ?? 'main',
            checkedAt: iso(now),
            checking: false,
            available: null,
            blocked: null,
            busy: false,
            run: null,
          },
        }
      case 'diagnostics.errors':
        return { type: 'diagnostics.result', daemonVersion: this.options.daemonVersion, errors: [] }
      case 'machine.permissions':
        return {
          type: 'machine.permissions.results',
          permissions: [
            { id: 'folderAccess', status: 'allowed', entries: [{ path: DEMO_CODE, status: 'allowed' }] },
            { id: 'fullDiskAccess', status: 'allowed' },
            { id: 'accessibility', status: 'allowed' },
            { id: 'desktopNotifications', status: 'allowed' },
            { id: 'keychain', status: 'allowed' },
          ],
        }
      case 'machine.openSettingsPane':
        return undefined
      case 'devices.list':
        return {
          type: 'devices.result',
          devices: [
            {
              id: 'demo-device',
              name: this.options.device.name,
              platform: this.options.device.platform,
              pairedAt: iso(now),
              lastSeen: iso(now),
              current: true,
            },
            {
              id: 'demo-tablet',
              name: 'Tablet',
              platform: 'ios',
              pairedAt: iso(now - 9 * 86_400_000),
              lastSeen: iso(now - 2 * 3_600_000),
              current: false,
            },
          ],
        }
      case 'rules.list':
        return { type: 'rules.result', files: this.rules() }
      case 'approvals.list':
        return { type: 'approvals.result', entries: this.approvals }
      case 'push.test':
        return { type: 'push.testResult', result: 'off' }
      // This phone's push and live status registrations: accepted and forgotten (the demo never pushes).
      case 'device.register':
      case 'device.unregister':
      case 'app.visibility':
      case 'live.register':
      case 'live.unregister':
        return undefined
      case 'queue.sendNext':
        throw new DemoError('not_found', 'the queue is empty')
      case 'command.run':
        throw new DemoError('commands_disabled', this.options.labels.unavailable)
      case 'transcript.image':
        throw new DemoError('not_found', 'image not found')
      // Not simulated: starting or resuming sessions, attachments, the queue, shell commands, commit
      // and push, follows, rules edits, adding or removing devices, updating the daemon.
      case 'attachment.upload':
      case 'queue.update':
      case 'queue.remove':
      case 'queue.sendNow':
      case 'queue.flush':
      case 'live.follow':
      case 'live.unfollow':
      case 'live.autoFollow':
      case 'live.follows':
      case 'session.start':
      case 'session.resume':
      case 'worktree.cleanup':
      case 'daemon.update.start':
      case 'command.cancel':
      case 'devices.revoke':
      case 'pairing.create':
      case 'changes.commit':
      case 'changes.push':
      case 'changes.pr':
      case 'changes.generate':
      case 'rules.undo':
      case 'rules.delete':
        throw this.unavailable()
      default: {
        // A new client message fails to compile here until the demo answers it.
        const unknown: never = message
        throw new DemoError('unknown_type', `unknown type ${(unknown as { type: string }).type}`)
      }
    }
  }

  /** What the real daemon sends a client that just connected: the waiting requests and the limits. */
  private replayOnConnect(): void {
    for (const request of this.pending.values()) this.emit({ type: 'permission.request', request })
    for (const limits of demoLimits(this.now())) this.emit({ type: 'limits.updated', limits })
  }

  private session(sessionId: string): DemoState {
    const state = this.sessions.get(sessionId)
    if (!state) throw new DemoError('not_found', `session ${sessionId} not found`)
    return state
  }

  /** A session that still has its terminal (not ended). */
  private live(sessionId: string): DemoState {
    const state = this.session(sessionId)
    if (!state.wire.controllable) throw new DemoError('not_controllable', 'session without a terminal')
    return state
  }

  private streamKey(sessionId: string, agentId?: string): string {
    return agentId ? `${sessionId}/${agentId}` : sessionId
  }

  private stream(sessionId: string, agentId?: string): TranscriptEntry[] {
    const state = this.session(sessionId)
    if (!agentId) return state.entries
    const entries = state.subagents.get(agentId)
    if (!entries) throw new DemoError('not_found', `subagent ${agentId} not found`)
    return entries
  }

  private later(fn: () => void, ms: number): void {
    const cancel = this.schedule(() => {
      this.timers.delete(cancel)
      fn()
    }, ms)
    this.timers.add(cancel)
  }

  /** Changes a session and tells the app, refreshing its terminal when it is open. */
  private update(state: DemoState, patch: Partial<Session>, touch = true): void {
    state.wire = { ...state.wire, ...patch, ...(touch ? { updatedAt: iso(this.now()) } : {}) }
    if (patch.state) state.fixture.state = patch.state
    this.emit({ type: 'session.updated', session: state.wire })
    this.sendPane(state.wire.id)
  }

  /** Appends fixture entries to a session's transcript and streams them to the app. */
  private append(state: DemoState, entries: DemoEntry[]): void {
    const now = this.now()
    const added = demoEntries(state.fixture, state.wire.cwd, entries, {
      startCursor: state.entries.length,
      startIndex: state.nextIndex,
      at: () => iso(now),
    })
    state.fixture.entries.push(...entries)
    state.nextIndex += entries.length
    state.entries.push(...added)
    this.sendEntries(state, added)
    const lastActivity = lastActivityOf(state.entries, iso(now))
    if (lastActivity) this.update(state, { lastActivity }, false)
  }

  private sendEntries(state: DemoState, entries: TranscriptEntry[]): void {
    if (entries.length === 0 || !this.transcripts.has(state.wire.id)) return
    this.emit({ type: 'transcript.entries', sessionId: state.wire.id, entries })
  }

  private sendPane(sessionId: string): void {
    const state = this.sessions.get(sessionId)
    if (!state || !this.panes.has(sessionId) || !state.wire.controllable) return
    this.emit({
      type: 'pane.frame',
      sessionId,
      text: paneText(state.fixture, PANE_COLS),
      cols: PANE_COLS,
      rows: PANE_ROWS,
    })
  }

  private input(message: ClientMessageOf<'session.input'>): Reply {
    const state = this.live(message.sessionId)
    if (message.attachmentIds?.length) throw this.unavailable()
    const text = message.text.trim()
    if (!text) throw new DemoError('bad_request', 'empty prompt')
    this.append(state, [{ kind: 'user', text }])
    const waiting = state.wire.state === 'waiting'
    if (!waiting) this.update(state, { state: 'running' })
    this.later(() => {
      this.append(state, [{ kind: 'text', text: this.options.labels.reply }])
      if (state.wire.state === 'running') this.update(state, { state: 'idle' })
    }, DEMO_TURN_MS)
    return { type: 'ack', data: { delivery: 'sent' } }
  }

  private setMode(sessionId: string, mode: string): void {
    const state = this.live(sessionId)
    const parsed = SelectableModeSchema.safeParse(mode)
    if (!parsed.success) throw new DemoError('mode_forbidden', `mode ${mode} is not offered`)
    if ([...this.pending.values()].some((r) => r.sessionId === sessionId))
      throw new DemoError('session_busy', 'a permission request is open')
    state.fixture.permissionMode = parsed.data
    this.update(state, { permissionMode: parsed.data }, false)
    this.emit({ type: 'session.state', sessionId, state: state.wire.state, permissionMode: parsed.data })
  }

  /** Answers the waiting request: the session runs the tool (or not) and finishes its turn. */
  private resolve(requestId: string, allowed: boolean, rule?: string): void {
    const request = this.pending.get(requestId)
    if (!request) throw new DemoError('already_resolved', 'request already resolved')
    this.pending.delete(requestId)
    const now = this.now()
    this.emit({
      type: 'permission.resolved',
      requestId,
      sessionId: request.sessionId,
      outcome: allowed ? 'allowed' : 'denied',
    })
    const state = this.session(request.sessionId)
    const ruleId = rule && allowed ? `rule-${++this.seq}` : null
    if (rule && ruleId) this.appRules.push({ rule, ruleId, createdAt: iso(now), cwd: state.wire.cwd })
    const command = typeof request.input.command === 'string' ? request.input.command : null
    this.approvals.unshift({
      id: `approval-${++this.seq}`,
      at: iso(now),
      action: allowed ? 'allow' : 'deny',
      ...(ruleId ? { always: true } : {}),
      device: { id: 'demo-device', name: this.options.device.name },
      sessionId: request.sessionId,
      folder: baseName(state.wire.cwd),
      tool: request.tool,
      target: command?.split(' ')[0] ?? null,
      rule: ruleId ? (rule ?? null) : null,
      ruleId,
    })
    const permission = state.fixture.permission
    state.fixture.permission = undefined
    this.update(state, { state: allowed ? 'running' : 'idle' })
    if (!permission) return
    if (!allowed) {
      this.toolResult(state, "The user doesn't want to proceed with this tool use.", true)
      return
    }
    this.later(() => {
      this.toolResult(state, permission.result, false)
      this.append(state, [{ kind: 'text', text: permission.followUp }])
      if (state.wire.state === 'running') this.update(state, { state: 'idle' })
    }, DEMO_TURN_MS)
  }

  /** The result of the tool call that waited for the answer (the last fixture tool without one). */
  private toolResult(state: DemoState, content: string, isError: boolean): void {
    const { entries } = state.fixture
    const waiting = (entry: DemoEntry | undefined) => entry?.kind === 'tool' && entry.result === undefined
    let index = entries.length - 1
    while (index >= 0 && !waiting(entries[index])) index--
    const tool = entries[index]
    if (tool?.kind !== 'tool') return
    tool.result = content
    tool.error = isError
    const uuid = `${state.wire.id.slice(0, 8)}-e${index}-r`
    const result: TranscriptEntry = {
      key: `${uuid}:0`,
      cursor: state.entries.length,
      index: 0,
      uuid,
      timestamp: iso(this.now()),
      isSidechain: false,
      kind: 'tool_result',
      toolUseId: demoToolUseId(state.wire.id, index),
      content,
      isError,
      truncated: false,
      images: [],
    }
    state.entries.push(result)
    this.sendEntries(state, [result])
    this.sendPane(state.wire.id)
  }

  private close(sessionId: string): { closed: 'exited' | 'already' } {
    const state = this.session(sessionId)
    if (state.wire.state === 'ended') return { closed: 'already' }
    for (const request of [...this.pending.values()]) {
      if (request.sessionId !== sessionId) continue
      this.pending.delete(request.requestId)
      this.emit({
        type: 'permission.resolved',
        requestId: request.requestId,
        sessionId,
        outcome: 'cancelled',
      })
    }
    state.fixture.permission = undefined
    this.panes.delete(sessionId)
    this.update(state, { state: 'ended', controllable: false, paneId: null })
    return { closed: 'exited' }
  }

  private mute(target: 'profile' | 'session', id: string, muted: boolean): void {
    const key = target === 'profile' ? 'profiles' : 'sessions'
    const others = this.muted[key].filter((v) => v !== id)
    this.muted = { ...this.muted, [key]: muted ? [...others, id] : others }
    this.emit({ type: 'mute.updated', muted: this.muted })
  }

  /** The files under a session's folder that its transcript mentions, matching `query`. */
  private files(sessionId: string, query: string, limit: number) {
    const state = this.session(sessionId)
    const paths = new Set<string>()
    for (const entry of state.fixture.entries) {
      if (entry.kind !== 'tool') continue
      if (typeof entry.input.file_path === 'string') paths.add(entry.input.file_path)
      for (const line of entry.result?.split('\n') ?? []) {
        const path = line.split(':')[0]?.trim()
        if (path && /^[\w./-]+\.\w+$/.test(path)) paths.add(path)
      }
    }
    paths.add('README.md')
    const needle = query.toLowerCase()
    return [...paths]
      .filter((path) => path.toLowerCase().includes(needle))
      .sort()
      .slice(0, limit)
      .map((path) => ({ path, kind: 'file' as const }))
  }

  private projects(profileId: string) {
    const byCwd = new Map<
      string,
      { cwd: string; lastUsedAt: string; branch: string | null; sessions: number }
    >()
    for (const { wire, fixture } of this.sessions.values()) {
      if (wire.profileId !== profileId) continue
      const known = byCwd.get(wire.cwd)
      if (known) known.sessions += 1
      else
        byCwd.set(wire.cwd, {
          cwd: wire.cwd,
          lastUsedAt: wire.updatedAt,
          branch: fixture.branch,
          sessions: 1,
        })
    }
    return [...byCwd.values()]
  }

  private directories(path: string, prefix?: string, hidden?: boolean): Reply {
    const absolute = path === '~' ? DEMO_HOME : path.startsWith('~/') ? `${DEMO_HOME}/${path.slice(2)}` : path
    const listed = absolute.replace(/\/+$/, '') || '/'
    const items = demoDirectories(listed)
    if (!items) throw new DemoError('invalid_cwd', 'directory not found')
    const filtered = items.filter(
      (item) =>
        (hidden || !item.name.startsWith('.')) &&
        (!prefix || item.name.toLowerCase().startsWith(prefix.toLowerCase())),
    )
    return {
      type: 'directories.results',
      path: listed,
      parent: listed === DEMO_HOME ? null : listed.slice(0, listed.lastIndexOf('/')) || DEMO_HOME,
      home: DEMO_HOME,
      items: filtered,
      truncated: false,
    }
  }

  private rules(): RuleFile[] {
    const project = demoCwd({ repo: 'acme-api' })
    const files: RuleFile[] = [
      {
        file: `${DEMO_HOME}/.claude/settings.json`,
        scope: 'profile',
        profileId: 'personal',
        project: null,
        rules: [
          { origin: 'hand', rule: 'Bash(git status:*)' },
          { origin: 'hand', rule: 'Read(~/code/**)' },
        ],
      },
      {
        file: `${project}/.claude/settings.local.json`,
        scope: 'project',
        profileId: null,
        project,
        rules: [{ origin: 'hand', rule: 'Bash(pnpm lint:*)' }],
      },
    ]
    for (const rule of this.appRules) {
      const file = files.find((f) => f.project === rule.cwd)
      const entry = {
        origin: 'app' as const,
        rule: rule.rule,
        ruleId: rule.ruleId,
        createdAt: rule.createdAt,
      }
      if (file) file.rules.push(entry)
      else
        files.push({
          file: `${rule.cwd}/.claude/settings.local.json`,
          scope: 'project',
          profileId: null,
          project: rule.cwd,
          rules: [entry],
        })
    }
    return files
  }
}
