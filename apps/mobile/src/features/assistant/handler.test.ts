import type { ClientRequest, PermissionRequestInfo, ServerMessage, Session } from '@remote-harness/protocol'
import { describe, expect, it } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import { type AssistantClient, handleAssistantRequest, parseAssistantRequest } from './handler'

const { t } = createI18n('en-US')

const session = (id: string, patch: Partial<Session> = {}): Session => ({
  id,
  profileId: 'p',
  cwd: '/work',
  title: `Session ${id}`,
  state: 'idle',
  permissionMode: null,
  approvalPolicy: null,
  permissionProfile: null,
  controllable: true,
  paneId: '%1',
  updatedAt: '2026-10-28T10:00:00.000Z',
  subagents: [],
  backgroundTasks: 0,
  checkout: null,
  status: null,
  ...patch,
})

const permission = (
  requestId: string,
  patch: Partial<PermissionRequestInfo> = {},
): PermissionRequestInfo => ({
  requestId,
  sessionId: 'a',
  profileId: 'p',
  tool: 'Bash',
  input: { command: 'pnpm test' },
  suggestedRule: null,
  rules: true,
  defaultScope: 'project',
  createdAt: '2026-10-28T10:00:00.000Z',
  expiresAt: '2026-10-28T10:05:00.000Z',
  ...patch,
})

/** A computer with these sessions and requests; records what the handler sends. */
function fakeClient(sessions: Session[], requests: PermissionRequestInfo[] = []) {
  const sent: ClientRequest[] = []
  const client: AssistantClient = {
    async request(message) {
      sent.push(message)
      if (message.type === 'sessions.list') return { type: 'sessions.snapshot', sessions } as ServerMessage
      if (message.type === 'permissions.list')
        return { type: 'permissions.result', requests } as ServerMessage
      return { type: 'ack' } as ServerMessage
    },
  }
  return { client, sent }
}

describe('parseAssistantRequest', () => {
  it('accepts the four actions', () => {
    expect(parseAssistantRequest({ action: 'reply', text: 'hi', sessionId: 's' })).toEqual({
      action: 'reply',
      text: 'hi',
      sessionId: 's',
    })
    expect(parseAssistantRequest({ action: 'reply', text: 'hi', sessionId: '' })).toEqual({
      action: 'reply',
      text: 'hi',
    })
    expect(parseAssistantRequest({ action: 'pending', decision: 'deny' })).toEqual({
      action: 'pending',
      decision: 'deny',
    })
    expect(parseAssistantRequest({ action: 'answer', requestId: 'r', decision: 'allow' })).toEqual({
      action: 'answer',
      requestId: 'r',
      decision: 'allow',
    })
    expect(parseAssistantRequest({ action: 'waiting' })).toEqual({ action: 'waiting' })
  })

  it('rejects unknown or incomplete payloads', () => {
    expect(parseAssistantRequest(null)).toBeNull()
    expect(parseAssistantRequest({ action: 'reply' })).toBeNull()
    expect(parseAssistantRequest({ action: 'answer', decision: 'maybe', requestId: 'r' })).toBeNull()
    expect(parseAssistantRequest({ action: 'delete' })).toBeNull()
  })
})

describe('reply', () => {
  it('sends the text to the named session like the reply field', async () => {
    const { client, sent } = fakeClient([session('a'), session('b')])
    const reply = await handleAssistantRequest(
      { action: 'reply', sessionId: 'b', text: ' run it ' },
      client,
      t,
    )
    expect(reply).toEqual({ ok: true, message: 'Sent to “Session b”.', sessionId: 'b' })
    expect(sent.at(-1)).toEqual({ type: 'session.input', sessionId: 'b', text: 'run it', mode: 'auto' })
  })

  it('goes to the session waiting for the user when none is named', async () => {
    const { client, sent } = fakeClient([
      session('running', { state: 'running', updatedAt: '2026-10-28T12:00:00.000Z' }),
      session('waiting', { state: 'waiting' }),
    ])
    const reply = await handleAssistantRequest({ action: 'reply', text: 'yes' }, client, t)
    expect(reply.sessionId).toBe('waiting')
    expect(sent.at(-1)).toMatchObject({ type: 'session.input', sessionId: 'waiting' })
  })

  it('refuses read-only, ended, missing and empty replies without sending', async () => {
    const { client, sent } = fakeClient([
      session('ro', { controllable: false }),
      session('done', { state: 'ended' }),
    ])
    const cases = [
      [
        { action: 'reply', sessionId: 'ro', text: 'x' },
        '“Session ro” is read-only. Resume it in the app to reply.',
      ],
      [
        { action: 'reply', sessionId: 'done', text: 'x' },
        '“Session done” has ended. Resume it in the app to reply.',
      ],
      [{ action: 'reply', sessionId: 'gone', text: 'x' }, 'That session is no longer on your computer.'],
      [{ action: 'reply', text: 'x' }, 'No session can receive a message right now.'],
      [{ action: 'reply', sessionId: 'ro', text: '  ' }, 'There was nothing to send.'],
    ] as const
    for (const [request, message] of cases) {
      expect(await handleAssistantRequest(request, client, t)).toEqual({ ok: false, message })
    }
    expect(sent.some((m) => m.type === 'session.input')).toBe(false)
  })

  it('reports a refused request as a failure', async () => {
    const client: AssistantClient = {
      async request(message) {
        if (message.type === 'sessions.list') {
          return { type: 'sessions.snapshot', sessions: [session('a')] } as ServerMessage
        }
        throw new Error('timeout')
      },
    }
    expect(await handleAssistantRequest({ action: 'reply', text: 'x' }, client, t)).toEqual({
      ok: false,
      message: 'Something went wrong, so nothing was sent.',
    })
  })
})

describe('permissions', () => {
  it('describes the oldest plain permission and returns its id', async () => {
    const { client } = fakeClient(
      [session('a')],
      [
        permission('newer', { createdAt: '2026-10-28T10:01:00.000Z' }),
        permission('question', {
          createdAt: '2026-10-28T09:00:00.000Z',
          interaction: { kind: 'question', questions: [] } as unknown as PermissionRequestInfo['interaction'],
        }),
        permission('older', { createdAt: '2026-10-28T09:30:00.000Z' }),
      ],
    )
    const reply = await handleAssistantRequest({ action: 'pending', decision: 'deny' }, client, t)
    expect(reply.ok).toBe(true)
    expect(reply.requestId).toBe('older')
    expect(reply.message).toMatch(/^Deny “.+” in “Session a”\?$/)
  })

  it('says when only questions or plans wait, and when nothing waits', async () => {
    const onlyQuestion = fakeClient([session('a')], [permission('q', { terminal: true })])
    expect(
      await handleAssistantRequest({ action: 'pending', decision: 'allow' }, onlyQuestion.client, t),
    ).toEqual({
      ok: false,
      message: 'Only questions or plans are waiting. Answer them in the app.',
    })
    const none = fakeClient([session('a')])
    expect(await handleAssistantRequest({ action: 'pending', decision: 'allow' }, none.client, t)).toEqual({
      ok: false,
      message: 'Nothing is waiting for permission.',
    })
  })

  it('answers the confirmed request', async () => {
    const { client, sent } = fakeClient([session('a')], [permission('r1')])
    const reply = await handleAssistantRequest(
      { action: 'answer', requestId: 'r1', decision: 'allow' },
      client,
      t,
    )
    expect(reply).toEqual({ ok: true, message: 'Allowed.' })
    expect(sent.at(-1)).toEqual({ type: 'permission.respond', requestId: 'r1', decision: 'allow' })
  })

  it('does not answer a request that is gone', async () => {
    const { client, sent } = fakeClient([session('a')], [])
    const reply = await handleAssistantRequest(
      { action: 'answer', requestId: 'r1', decision: 'deny' },
      client,
      t,
    )
    expect(reply).toEqual({ ok: false, message: 'That request was already answered or has expired.' })
    expect(sent.some((m) => m.type === 'permission.respond')).toBe(false)
  })
})

describe('waiting', () => {
  it('counts waiting and running sessions and names the waiting ones', async () => {
    const { client } = fakeClient([
      session('w1', { state: 'waiting', title: 'Fix login' }),
      session('w2', { state: 'waiting', title: 'Docs' }),
      session('r', { state: 'running' }),
      session('e', { state: 'ended' }),
    ])
    expect(await handleAssistantRequest({ action: 'waiting' }, client, t)).toEqual({
      ok: true,
      message: '2 sessions are waiting for you: “Fix login”, “Docs”. 1 session is running.',
    })
  })

  it('says nothing is waiting', async () => {
    const { client } = fakeClient([session('i')])
    expect(await handleAssistantRequest({ action: 'waiting' }, client, t)).toEqual({
      ok: true,
      message: 'No session is waiting for you.',
    })
  })
})
