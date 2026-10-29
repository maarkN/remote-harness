import type { ClientRequest, PermissionRequestInfo, ServerMessage, Session } from '@remote-harness/protocol'
import { describe, expect, it } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import type { AssistantClient } from './handler'
import { resolveAssistantLink } from './link-flow'

const { t } = createI18n('en-US')

const session = (id: string, patch: Partial<Session> = {}) =>
  ({
    id,
    title: `Session ${id}`,
    state: 'idle',
    controllable: true,
    updatedAt: '2026-10-28T10:00:00.000Z',
    ...patch,
  }) as Session

function fakeClient(sessions: Session[], requests: Partial<PermissionRequestInfo>[] = []) {
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

/** Only reads: a link never sends a prompt or answers a permission before the user taps. */
const onlyReads = (sent: ClientRequest[]) =>
  sent.every((m) => m.type === 'sessions.list' || m.type === 'permissions.list')

describe('resolveAssistantLink', () => {
  it('asks to confirm a message to the session waiting for the user, without sending it', async () => {
    const { client, sent } = fakeClient([
      session('a', { state: 'running' }),
      session('w', { state: 'waiting' }),
    ])
    const step = await resolveAssistantLink({ kind: 'reply', text: 'run the tests' }, client, t)
    expect(step).toEqual({
      kind: 'send',
      message: 'Send “run the tests” to “Session w”?',
      text: 'run the tests',
      sessionId: 'w',
    })
    expect(onlyReads(sent)).toBe(true)
  })

  it('finds the session by its spoken title, and says when none matches', async () => {
    const { client } = fakeClient([session('a', { title: 'Fix login' }), session('b', { title: 'Docs' })])
    expect(
      await resolveAssistantLink({ kind: 'reply', text: 'go', sessionTitle: 'fix login' }, client, t),
    ).toMatchObject({
      kind: 'send',
      sessionId: 'a',
    })
    expect(
      await resolveAssistantLink({ kind: 'reply', text: 'go', sessionTitle: 'billing' }, client, t),
    ).toEqual({
      kind: 'result',
      ok: false,
      message: 'No live session is called “billing”.',
    })
  })

  it('opens the session to type when there is no text', async () => {
    const { client, sent } = fakeClient([session('a')])
    expect(await resolveAssistantLink({ kind: 'reply', text: '', sessionId: 'a' }, client, t)).toEqual({
      kind: 'open',
      sessionId: 'a',
    })
    expect(onlyReads(sent)).toBe(true)
  })

  it('says when the shortcut session is gone or nothing is live', async () => {
    const { client } = fakeClient([session('x', { controllable: false })])
    expect(
      await resolveAssistantLink({ kind: 'reply', text: 'hi', sessionId: 'gone' }, client, t),
    ).toMatchObject({
      kind: 'result',
      ok: false,
      message: 'That session is no longer on your computer.',
    })
    expect(await resolveAssistantLink({ kind: 'reply', text: 'hi' }, client, t)).toMatchObject({
      kind: 'result',
      ok: false,
      message: 'No session can receive a message right now.',
    })
  })

  it('asks to confirm the oldest plain permission without answering it', async () => {
    const { client, sent } = fakeClient(
      [session('a')],
      [
        {
          requestId: 'r1',
          sessionId: 'a',
          tool: 'Bash',
          input: { command: 'pnpm test' },
          createdAt: '2026-10-28T10:00:00.000Z',
        },
      ],
    )
    const step = await resolveAssistantLink({ kind: 'answer', decision: 'allow' }, client, t)
    expect(step).toMatchObject({ kind: 'confirm', requestId: 'r1', decision: 'allow' })
    expect(onlyReads(sent)).toBe(true)
  })

  it('shows what is waiting', async () => {
    const { client } = fakeClient([session('w', { state: 'waiting', title: 'Docs' })])
    expect(await resolveAssistantLink({ kind: 'waiting' }, client, t)).toEqual({
      kind: 'result',
      ok: true,
      message: '1 session is waiting for you: “Docs”.',
    })
  })
})
