import * as nodeCrypto from 'node:crypto'
import {
  AccountLimitsSchema,
  ChangedFileSchema,
  type ClientMessage,
  ClientMessageSchema,
  type ClientRequest,
  createNoiseCrypto,
  type NodeLikeCrypto,
  PermissionRequestInfoSchema,
  ServerMessageSchema,
  SessionSchema,
  TranscriptEntrySchema,
} from '@remote-harness/protocol'
import { DEMO_SESSIONS } from '@remote-harness/protocol/demo'
import { describe, expect, test, vi } from 'vitest'
import { DaemonClient, DaemonRequestError } from '@/core/connection/daemon-client'
import { DemoDaemon, type DemoScheduler } from './demo-daemon'
import { DemoServer } from './demo-socket'
import {
  DEMO_HOME,
  demoChanges,
  demoComputer,
  demoDiff,
  demoLimits,
  demoPermission,
  demoSession,
  demoSubagentTranscript,
  demoTranscript,
  withoutDemoSessions,
} from './fixtures'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const labels = { unavailable: 'Not available in the demo.', reply: 'Demo reply.' }
const crypto = createNoiseCrypto(nodeCrypto as unknown as NodeLikeCrypto)

const WAITING = DEMO_SESSIONS.find((s) => s.state === 'waiting')!
const IDLE = DEMO_SESSIONS.find((s) => s.state === 'idle')!
const ENDED = DEMO_SESSIONS.find((s) => s.state === 'ended')!
const WITH_SUBAGENTS = DEMO_SESSIONS.find((s) => (s.subagents ?? []).length > 0)!
const EDITED = DEMO_SESSIONS.find((s) => s.entries.some((e) => e.kind === 'tool' && e.name === 'Edit'))!

/** A demo daemon with a manual clock for its turns; every message it sends is recorded. */
function setup() {
  const sent: unknown[] = []
  const timers: (() => void)[] = []
  const schedule: DemoScheduler = (fn) => {
    timers.push(fn)
    return () => timers.splice(timers.indexOf(fn), 1)
  }
  const daemon = new DemoDaemon(
    { labels, daemonVersion: '1.2.3', device: { name: 'Phone', platform: 'ios' }, now: () => NOW, schedule },
    (message) => sent.push(message),
  )
  let seq = 0
  const send = (request: ClientRequest) => {
    const message = ClientMessageSchema.parse({ ...request, id: `r${++seq}` }) as ClientMessage
    daemon.handle(message)
    return message.id
  }
  const runTurns = () => {
    while (timers.length > 0) timers.shift()?.()
  }
  const replyTo = (id: string) =>
    sent.find((m) => (m as { replyTo?: string }).replyTo === id) as Record<string, unknown>
  const ofType = (type: string) =>
    sent.filter((m) => (m as { type: string }).type === type) as Record<string, unknown>[]
  return { daemon, sent, send, runTurns, replyTo, ofType }
}

describe('demo fixtures', () => {
  test('sessions, transcripts, the request, limits and changes are valid protocol values', () => {
    DEMO_SESSIONS.forEach((fixture, index) => {
      const session = SessionSchema.parse(demoSession(fixture, index, NOW))
      expect(session.cwd.startsWith(`${DEMO_HOME}/code/`)).toBe(true)
      expect(session.controllable).toBe(fixture.state !== 'ended')
      const entries = demoTranscript(fixture, NOW)
      for (const entry of entries) TranscriptEntrySchema.parse(entry)
      expect(entries.map((e) => e.cursor)).toEqual(entries.map((_, i) => i))
      expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length)
      for (const subagent of fixture.subagents ?? [])
        for (const entry of demoSubagentTranscript(fixture, subagent, NOW)) TranscriptEntrySchema.parse(entry)
      for (const file of demoChanges(fixture)) ChangedFileSchema.parse(file)
    })
    PermissionRequestInfoSchema.parse(demoPermission(WAITING, NOW))
    for (const limits of demoLimits(NOW)) AccountLimitsSchema.parse(limits)
  })

  test('covers every state, a subagent and a changed file with its diff', () => {
    expect(new Set(DEMO_SESSIONS.map((s) => s.state))).toEqual(
      new Set(['waiting', 'running', 'idle', 'ended']),
    )
    expect(WITH_SUBAGENTS.subagents?.map((s) => s.state)).toEqual(['done', 'running'])
    const [file] = demoChanges(EDITED)
    expect(file?.added).toBeGreaterThan(0)
    expect(demoDiff(EDITED, file?.path ?? '')?.some((l) => l.startsWith('+'))).toBe(true)
    expect(demoDiff(EDITED, 'nope.ts')).toBeNull()
  })
})

describe('demo daemon', () => {
  /** One request of every client message type the app sends, with arguments the demo knows. */
  const everyRequest = (): ClientRequest[] => {
    const [agent] = WITH_SUBAGENTS.subagents ?? []
    const [file] = demoChanges(EDITED)
    const device = { platform: 'ios' as const, fcmToken: 'token' }
    return [
      { type: 'auth', protocolVersion: 2 },
      { type: 'ping' },
      { type: 'sessions.list' },
      { type: 'session.subscribe', sessionId: IDLE.id },
      { type: 'session.subscribe', sessionId: WITH_SUBAGENTS.id, agentId: agent?.agentId },
      { type: 'session.history', sessionId: IDLE.id, before: 2, limit: 1 },
      { type: 'session.unsubscribe', sessionId: IDLE.id },
      { type: 'transcript.image', sessionId: IDLE.id, imageId: 'x' },
      { type: 'session.input', sessionId: IDLE.id, text: 'hello' },
      { type: 'attachment.upload', sessionId: IDLE.id, mimeType: 'image/png', data: 'AA' },
      { type: 'session.key', sessionId: IDLE.id, key: 'Escape' },
      { type: 'queue.update', sessionId: IDLE.id, itemId: 'q', text: 'x' },
      { type: 'queue.remove', sessionId: IDLE.id, itemId: 'q' },
      { type: 'queue.sendNow', sessionId: IDLE.id, itemId: 'q' },
      { type: 'queue.flush', sessionId: IDLE.id },
      { type: 'queue.sendNext', sessionId: IDLE.id },
      { type: 'session.setMode', sessionId: IDLE.id, mode: 'plan' },
      { type: 'permissions.list' },
      { type: 'permission.respond', requestId: 'missing', decision: 'allow' },
      { type: 'permission.answer', requestId: 'missing', answer: { kind: 'plan', decision: 'default' } },
      { type: 'device.register', fcmToken: 'token', platform: 'ios' },
      { type: 'device.unregister', fcmToken: 'token' },
      { type: 'app.visibility', foreground: true },
      { type: 'push.test', fcmToken: 'token' },
      { type: 'live.register', sessionId: IDLE.id, platform: 'ios', fcmToken: 'token' },
      { type: 'live.unregister', sessionId: IDLE.id },
      { type: 'live.follow', sessionId: IDLE.id, device },
      { type: 'live.unfollow', sessionId: IDLE.id, fcmToken: 'token' },
      { type: 'live.autoFollow', profileId: 'personal', enabled: true, device },
      { type: 'live.follows', device },
      { type: 'files.search', sessionId: EDITED.id, query: 'src' },
      { type: 'commands.list', sessionId: IDLE.id },
      { type: 'projects.list', profileId: 'personal' },
      { type: 'models.list', profileId: 'openrouter' },
      { type: 'provider.status', profileId: 'openrouter' },
      { type: 'voice.polish', sessionId: IDLE.id, text: 'hi' },
      { type: 'directories.list', path: '~/code' },
      { type: 'session.start', profileId: 'personal', cwd: '~/code/blog' },
      { type: 'checkout.inspect', profileId: 'personal', cwd: demoSession(IDLE, 0, NOW).cwd },
      { type: 'session.resume', profileId: 'personal', sessionId: ENDED.id },
      { type: 'worktree.inspect', sessionId: IDLE.id },
      { type: 'worktree.cleanup', sessionId: IDLE.id, action: 'delete' },
      { type: 'pane.subscribe', sessionId: IDLE.id },
      { type: 'pane.focus', sessionId: IDLE.id },
      { type: 'pane.unsubscribe', sessionId: IDLE.id },
      { type: 'daemon.update.check' },
      { type: 'daemon.update.start', channel: 'main' },
      { type: 'diagnostics.errors' },
      { type: 'machine.permissions' },
      { type: 'machine.openSettingsPane', pane: 'accessibility' },
      { type: 'command.run', sessionId: IDLE.id, command: 'ls' },
      { type: 'command.cancel', runId: 'x' },
      { type: 'settings.mute', target: 'profile', targetId: 'work', muted: true },
      { type: 'devices.list' },
      { type: 'devices.revoke', deviceId: 'demo-tablet' },
      { type: 'pairing.create' },
      { type: 'changes.list', sessionId: EDITED.id },
      { type: 'changes.diff', sessionId: EDITED.id, path: file?.path ?? '' },
      { type: 'changes.commit', sessionId: EDITED.id, paths: ['a'], message: 'm' },
      { type: 'changes.push', sessionId: EDITED.id },
      { type: 'changes.pr', sessionId: EDITED.id, title: 't', body: '' },
      { type: 'changes.generate', sessionId: EDITED.id, kind: 'commit' },
      { type: 'rules.list' },
      { type: 'rules.undo', ruleId: 'x' },
      { type: 'rules.delete', file: 'x', rule: 'y' },
      { type: 'approvals.list' },
      { type: 'session.close', sessionId: IDLE.id },
    ]
  }

  test('answers every request once, with messages the app accepts', () => {
    const requests = everyRequest()
    // Every client message type is exercised here.
    expect(new Set(requests.map((r) => r.type)).size).toBe(ClientMessageSchema.options.length)
    const { send, sent, runTurns, replyTo } = setup()
    const ids = requests.map((r) => send(r))
    runTurns()
    for (const message of sent) {
      const parsed = ServerMessageSchema.safeParse(message)
      expect(parsed.success, JSON.stringify(message).slice(0, 200)).toBe(true)
    }
    for (const id of ids)
      expect(sent.filter((m) => (m as { replyTo?: string }).replyTo === id)).toHaveLength(1)
    expect(replyTo(ids[0]!)).toMatchObject({ type: 'auth.ok', host: 'studio', push: { mode: 'off' } })
    expect(replyTo(ids[2]!)).toMatchObject({ type: 'sessions.snapshot' })
  })

  test('replays the waiting request and the limits after auth', () => {
    const { send, ofType } = setup()
    send({ type: 'auth', protocolVersion: 2 })
    expect(ofType('permission.request')).toHaveLength(1)
    expect(ofType('limits.updated').length).toBeGreaterThan(0)
  })

  test('what it does not simulate fails with the localized message', () => {
    const { send, replyTo } = setup()
    const id = send({ type: 'session.start', profileId: 'personal', cwd: '~/code/blog' })
    expect(replyTo(id)).toMatchObject({ type: 'error', message: labels.unavailable })
  })

  test('allowing the request runs the tool and ends the turn', () => {
    const { send, replyTo, runTurns, ofType } = setup()
    send({ type: 'session.subscribe', sessionId: WAITING.id })
    const request = demoPermission(WAITING, NOW)!
    const id = send({ type: 'permission.respond', requestId: request.requestId, decision: 'allow' })
    expect(replyTo(id)).toMatchObject({ type: 'ack' })
    expect(ofType('permission.resolved')[0]).toMatchObject({ outcome: 'allowed', sessionId: WAITING.id })
    expect(ofType('session.updated').at(-1)).toMatchObject({ session: { state: 'running' } })
    runTurns()
    const entries = ofType('transcript.entries').flatMap(
      (m) => m.entries as { kind: string; isError?: boolean }[],
    )
    expect(entries.map((e) => e.kind)).toEqual(['tool_result', 'assistant_text'])
    expect(entries[0]?.isError).toBe(false)
    expect(ofType('session.updated').at(-1)).toMatchObject({ session: { state: 'idle' } })
    const again = send({ type: 'permission.respond', requestId: request.requestId, decision: 'allow' })
    expect(replyTo(again)).toMatchObject({ type: 'error', code: 'already_resolved' })
    // The answer shows in the approval log.
    const log = send({ type: 'approvals.list' })
    expect(replyTo(log)).toMatchObject({ entries: [{ action: 'allow', tool: 'Bash', target: 'pnpm' }] })
  })

  test('denying the request records an error result and leaves the session idle', () => {
    const { send, ofType } = setup()
    send({ type: 'session.subscribe', sessionId: WAITING.id })
    const request = demoPermission(WAITING, NOW)!
    send({ type: 'permission.respond', requestId: request.requestId, decision: 'deny' })
    const [result] = ofType('transcript.entries').flatMap(
      (m) => m.entries as { kind: string; isError: boolean }[],
    )
    expect(result).toMatchObject({ kind: 'tool_result', isError: true })
    expect(ofType('session.updated').at(-1)).toMatchObject({ session: { state: 'idle' } })
  })

  test('a prompt shows in the transcript and gets the fictional reply', () => {
    const { send, replyTo, runTurns, ofType } = setup()
    const page = send({ type: 'session.subscribe', sessionId: IDLE.id })
    const count = (replyTo(page).entries as unknown[]).length
    const id = send({ type: 'session.input', sessionId: IDLE.id, text: 'Add a test' })
    expect(replyTo(id)).toMatchObject({ type: 'ack', data: { delivery: 'sent' } })
    expect(ofType('session.updated').at(-1)).toMatchObject({ session: { state: 'running' } })
    runTurns()
    const entries = ofType('transcript.entries').flatMap(
      (m) => m.entries as { kind: string; text: string; cursor: number }[],
    )
    expect(entries.map((e) => [e.kind, e.text])).toEqual([
      ['user', 'Add a test'],
      ['assistant_text', labels.reply],
    ])
    expect(entries[0]?.cursor).toBe(count)
    expect(ofType('session.updated').at(-1)).toMatchObject({ session: { state: 'idle' } })
    // A resume from the last cursor gets nothing again.
    const resumed = send({ type: 'session.subscribe', sessionId: IDLE.id, sinceCursor: entries[1]?.cursor })
    expect(replyTo(resumed).entries).toEqual([])
  })

  test('the terminal follows a mode change', () => {
    const { send, ofType } = setup()
    send({ type: 'pane.subscribe', sessionId: IDLE.id })
    expect(String(ofType('pane.frame').at(-1)?.text)).toContain('? for shortcuts')
    send({ type: 'session.setMode', sessionId: IDLE.id, mode: 'plan' })
    expect(String(ofType('pane.frame').at(-1)?.text)).toContain('plan mode on')
    expect(ofType('session.state').at(-1)).toMatchObject({ permissionMode: 'plan' })
  })

  test('refuses what a real daemon refuses', () => {
    const { send, replyTo } = setup()
    expect(replyTo(send({ type: 'session.input', sessionId: ENDED.id, text: 'x' }))).toMatchObject({
      code: 'not_controllable',
    })
    expect(
      replyTo(send({ type: 'session.setMode', sessionId: IDLE.id, mode: 'bypassPermissions' })),
    ).toMatchObject({
      code: 'mode_forbidden',
    })
    expect(replyTo(send({ type: 'session.setMode', sessionId: WAITING.id, mode: 'plan' }))).toMatchObject({
      code: 'session_busy',
    })
    expect(replyTo(send({ type: 'session.subscribe', sessionId: 'nope' }))).toMatchObject({
      code: 'not_found',
    })
  })
})

describe('demo socket', () => {
  test('a real client authenticates over the in-memory Noise channel and gets the sessions', async () => {
    const server = new DemoServer(crypto, {
      labels,
      daemonVersion: '1.2.3',
      device: { name: 'Phone', platform: 'ios' },
    })
    const client = new DaemonClient({
      computer: {
        daemonId: 'demo',
        addresses: ['studio:7437'],
        daemonKey: server.publicKey,
        deviceKey: crypto.generateKeyPair(),
      },
      crypto,
      socketFactory: server.socketFactory,
    })
    const requests: string[] = []
    client.on('permission.request', (m) => requests.push(m.request.sessionId))
    client.connect()
    await vi.waitFor(() => expect(client.status).toBe('open'))
    expect(client.hello?.host).toBe('studio')
    const reply = await client.request({ type: 'sessions.list' })
    expect(reply.type === 'sessions.snapshot' ? reply.sessions.length : 0).toBe(DEMO_SESSIONS.length)
    await vi.waitFor(() => expect(requests).toEqual([WAITING.id]))
    await expect(client.request({ type: 'pairing.create' })).rejects.toBeInstanceOf(DaemonRequestError)
    client.close()
    server.dispose()
  })

  test('refuses a client that expects another daemon key', async () => {
    const server = new DemoServer(crypto, {
      labels,
      daemonVersion: '1.2.3',
      device: { name: 'Phone', platform: 'ios' },
    })
    const client = new DaemonClient({
      computer: {
        daemonId: 'demo',
        addresses: ['studio:7437'],
        daemonKey: crypto.generateKeyPair().publicKey,
        deviceKey: crypto.generateKeyPair(),
      },
      crypto,
      socketFactory: server.socketFactory,
      reconnect: false,
    })
    client.connect()
    await vi.waitFor(() => expect(['unauthorized', 'closed']).toContain(client.status))
    expect(client.hello).toBeNull()
    server.dispose()
  })
})

describe('leaving the demo', () => {
  test('drops only the demo sessions from the pinned and hidden lists', () => {
    const [first, second] = DEMO_SESSIONS
    expect(withoutDemoSessions({ pinned: [first!.id, 'real-1'], hidden: ['real-2', second!.id] })).toEqual({
      pinned: ['real-1'],
      hidden: ['real-2'],
    })
  })

  test('the demo computer is pinned to the run key and never looks like a saved one', () => {
    const key = crypto.generateKeyPair()
    const computer = demoComputer(key.publicKey, crypto.generateKeyPair())
    expect(computer).toMatchObject({ daemonId: 'demo', name: 'studio', relays: [] })
    expect(computer.daemonKey).toBe(key.publicKey)
    // Saved computers have a 32-hex daemon ID: the demo's can never be read back as one.
    expect(/^[0-9a-f]{32}$/.test(computer.daemonId)).toBe(false)
  })
})
