import type { Session } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { stableSessionSelector } from './stable-session'

const base: Session = {
  id: 's1',
  profileId: 'personal',
  cwd: '/code/api',
  title: 'Fix login',
  state: 'running',
  permissionMode: 'default',
  approvalPolicy: null,
  permissionProfile: null,
  controllable: true,
  paneId: '%1',
  updatedAt: '2026-10-25T12:00:00.000Z',
  subagents: [],
  backgroundTasks: 0,
  lastActivity: null,
  checkout: null,
  status: { model: 'Opus 5.5', effort: 'high', context: { usedTokens: 1000, size: 200_000, percent: 0.5 } },
}

const at = (session: Session) => ({ sessions: { [session.id]: session } })

describe('stableSessionSelector', () => {
  test('keeps the same object while only the status line and activity change', () => {
    const select = stableSessionSelector('s1')
    const first = select(at(base))
    const ticked = select(
      at({
        ...base,
        updatedAt: '2026-10-25T12:00:05.000Z',
        status: {
          model: 'Opus 5.5',
          effort: 'high',
          context: { usedTokens: 4000, size: 200_000, percent: 2 },
        },
        subagents: [],
      }),
    )
    expect(ticked).toBe(first)
  })

  test('returns the new object when something shown changes', () => {
    const select = stableSessionSelector('s1')
    const first = select(at(base))
    const waiting = { ...base, state: 'waiting' as const }
    expect(select(at(waiting))).toBe(waiting)
    expect(select(at(waiting))).not.toBe(first)
    const renamed = { ...waiting, title: 'Fix login under load' }
    expect(select(at(renamed))).toBe(renamed)
  })

  test('a new subagent counts as a change even in a fresh array', () => {
    const select = stableSessionSelector('s1')
    select(at(base))
    const withSub = {
      ...base,
      subagents: [
        {
          agentId: 'a1',
          agentType: 'Explore',
          description: null,
          state: 'running' as const,
          updatedAt: base.updatedAt,
          startedAt: null,
          toolCount: 0,
        },
      ],
    }
    expect(select(at(withSub))).toBe(withSub)
  })

  test('undefined when the session is gone, then the session again', () => {
    const select = stableSessionSelector('s1')
    select(at(base))
    expect(select({ sessions: {} })).toBeUndefined()
    expect(select(at(base))).toBe(base)
  })
})
