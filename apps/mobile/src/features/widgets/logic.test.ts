import type { AccountLimits, LivePalette, PermissionRequestInfo, Session } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import {
  buildWidgetSnapshot,
  markAnswering,
  pairSnapshot,
  parseSnapshot,
  parseWidgetTarget,
  updatedLine,
  widgetLabels,
  widgetSessionLink,
  widgetTarget,
} from './logic'

const NOW = Date.parse('2026-10-30T12:00:00Z')
const palette: LivePalette = {
  background: '#0D0D0D',
  text: '#E8E6E3',
  textMuted: '#8A8784',
  accent: '#E8A33D',
  success: '#7FB069',
  warning: '#F3DC7A',
}
const labels = widgetLabels(createI18n('en-US').t)

function session(id: string, state: Session['state'], updatedAt: string): Session {
  return {
    id,
    profileId: 'p',
    cwd: '/tmp',
    title: `Title ${id}`,
    state,
    permissionMode: null,
    approvalPolicy: null,
    permissionProfile: null,
    controllable: true,
    paneId: null,
    updatedAt,
    subagents: [],
    backgroundTasks: 0,
    checkout: null,
    status: null,
  }
}

function request(
  requestId: string,
  sessionId: string,
  createdAt: string,
  extra: Partial<PermissionRequestInfo> = {},
): PermissionRequestInfo {
  return {
    requestId,
    sessionId,
    profileId: 'p',
    tool: 'Bash',
    input: { command: 'rm -rf /' },
    suggestedRule: null,
    rules: true,
    defaultScope: 'project',
    createdAt,
    expiresAt: createdAt,
    ...extra,
  }
}

const base = { limits: [], daemonId: 'd1', computer: 'mac', labels, palette, now: NOW }

describe('buildWidgetSnapshot', () => {
  test('pending first, then waiting, running and idle; ended never; counts', () => {
    const snapshot = buildWidgetSnapshot({
      ...base,
      sessions: [
        session('run', 'running', '2026-10-30T11:59:00Z'),
        session('wait', 'waiting', '2026-10-30T11:50:00Z'),
        session('ask', 'running', '2026-10-30T11:58:00Z'),
        session('idle', 'idle', '2026-10-30T11:59:30Z'),
        session('gone', 'ended', '2026-10-30T11:59:59Z'),
      ],
      pending: [request('r1', 'ask', '2026-10-30T11:58:30Z')],
    })
    expect(snapshot.sessions.map((s) => [s.id, s.state])).toEqual([
      ['ask', 'pending'],
      ['wait', 'waiting'],
      ['run', 'running'],
    ])
    expect(snapshot.waiting).toBe(2)
    expect(snapshot.running).toBe(1)
    expect(snapshot.sessions[0]?.since).toBe(Date.parse('2026-10-30T11:58:30Z'))
    expect(snapshot.sessions[0]?.link).toBe('remoteharness://session/ask?computer=d1')
    expect(snapshot.request).toEqual({
      requestId: 'r1',
      sessionId: 'ask',
      tool: 'Bash',
      text: 'Bash asks for permission',
    })
    // Session content beyond the title never lands in the snapshot.
    expect(JSON.stringify(snapshot)).not.toContain('rm -rf')
  })

  test('the oldest answerable request; questions, plans and terminal handovers are not', () => {
    const snapshot = buildWidgetSnapshot({
      ...base,
      sessions: [
        session('a', 'waiting', '2026-10-30T11:00:00Z'),
        session('b', 'waiting', '2026-10-30T11:00:00Z'),
      ],
      pending: [
        request('late', 'b', '2026-10-30T11:40:00Z'),
        request('question', 'a', '2026-10-30T11:10:00Z', {
          interaction: { kind: 'question', questions: [] } as unknown as PermissionRequestInfo['interaction'],
        }),
        request('handed', 'a', '2026-10-30T11:20:00Z', { terminal: true }),
      ],
    })
    expect(snapshot.request?.requestId).toBe('late')
    expect(snapshot.sessions.map((s) => s.id)).toEqual(['a', 'b'])
    expect(snapshot.sessions.every((s) => s.state === 'pending')).toBe(true)
  })

  test('requests of unknown or ended sessions are ignored; at most three sessions', () => {
    const snapshot = buildWidgetSnapshot({
      ...base,
      sessions: ['1', '2', '3', '4'].map((id) => session(id, 'running', `2026-10-30T11:0${id}:00Z`)),
      pending: [request('r', 'nope', '2026-10-30T11:00:00Z')],
    })
    expect(snapshot.request).toBeNull()
    expect(snapshot.sessions.map((s) => s.id)).toEqual(['4', '3', '2'])
    expect(snapshot.running).toBe(4)
  })

  test('limits: the highest percentage per window, ignoring windows already reset', () => {
    const limits: AccountLimits[] = [
      {
        profileId: 'a',
        fiveHour: { percent: 40, resetsAt: NOW + 1000 },
        sevenDay: { percent: 90, resetsAt: NOW - 1 },
        updatedAt: '',
      },
      {
        profileId: 'b',
        fiveHour: { percent: 72, resetsAt: NOW + 2000 },
        sevenDay: { percent: 35, resetsAt: NOW + 5000 },
        updatedAt: '',
      },
    ]
    const snapshot = buildWidgetSnapshot({ ...base, sessions: [], pending: [], limits })
    expect(snapshot.limits).toEqual({
      fiveHour: { percent: 72, resetsAt: NOW + 2000 },
      weekly: { percent: 35, resetsAt: NOW + 5000 },
    })
  })
})

describe('widget helpers', () => {
  test('pair state, answering and saved snapshots', () => {
    const pair = pairSnapshot(labels, palette, NOW)
    expect(pair.kind).toBe('pair')
    expect(parseSnapshot(JSON.stringify(pair))).toEqual(pair)
    expect(parseSnapshot('{"kind":"other"}')).toBeNull()
    expect(parseSnapshot('not json')).toBeNull()
    expect(parseSnapshot(null)).toBeNull()
    const snapshot = buildWidgetSnapshot({
      ...base,
      sessions: [session('a', 'waiting', '2026-10-30T11:00:00Z')],
      pending: [request('r1', 'a', '2026-10-30T11:00:00Z')],
    })
    expect(markAnswering(snapshot, 'r1').answering).toBe('r1')
    expect(markAnswering(snapshot, 'other')).toBe(snapshot)
  })

  test('button targets run in the app and parse back', () => {
    expect(widgetTarget('allow', 'r:1')).toBe('app:allow:r:1')
    expect(parseWidgetTarget('app:deny:r:1')).toEqual({ decision: 'deny', requestId: 'r:1' })
    expect(parseWidgetTarget('allow:r1')).toBeNull()
    expect(parseWidgetTarget('app:open:r1')).toBeNull()
  })

  test('links and labels in every language', () => {
    expect(widgetSessionLink('a b', null)).toBe('remoteharness://session/a%20b')
    expect(updatedLine(labels, '14:05')).toBe('Updated 14:05')
    const pt = widgetLabels(createI18n('pt-BR').t)
    expect(pt.request.replace('{tool}', 'Bash')).toBe('Bash pede permissão')
    expect(widgetLabels(createI18n('es-ES').t).allow).toBe('Permitir')
  })
})
