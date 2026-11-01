import type { Session } from '@remote-harness/protocol'
import { beforeEach, describe, expect, test } from 'vitest'
import { useSessionsStore } from './store'

const session: Session = {
  id: 's',
  profileId: 'claudin',
  cwd: '/tmp',
  title: 'x',
  state: 'idle',
  permissionMode: 'default',
  approvalPolicy: null,
  permissionProfile: null,
  controllable: true,
  paneId: '%1',
  updatedAt: '2026-10-14T00:00:00Z',
  subagents: [],
  backgroundTasks: 0,
  lastActivity: null,
  checkout: null,
  status: null,
}

beforeEach(() => useSessionsStore.setState({ sessions: {} }))

describe('session deltas', () => {
  test('a delta merges only its fields into the known session', () => {
    useSessionsStore.getState().upsert(session)
    useSessionsStore.getState().applyChange('s', { set: { state: 'running', title: 'tests' }, unset: [] })
    expect(useSessionsStore.getState().sessions.s).toEqual({ ...session, state: 'running', title: 'tests' })
  })

  test('a delta for an unknown session or an invalid result changes nothing', () => {
    useSessionsStore.getState().applyChange('nope', { set: { state: 'running' }, unset: [] })
    expect(useSessionsStore.getState().sessions).toEqual({})
    useSessionsStore.getState().upsert(session)
    const before = useSessionsStore.getState().sessions
    useSessionsStore.getState().applyChange('s', { set: { state: 'flying' }, unset: [] })
    expect(useSessionsStore.getState().sessions).toBe(before)
  })
})
