import type { ClientMessage, PermissionRequestInfo, ServerMessage } from '@remote-harness/protocol'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ConnectionStatus, DaemonClient } from '@/core/connection/daemon-client'
import { bindPermissions, selectPendingCounts, usePermissionsStore } from './store'

function request(requestId: string, sessionId = 's1'): PermissionRequestInfo {
  return {
    requestId,
    sessionId,
    profileId: 'personal',
    tool: 'Bash',
    input: { command: 'pnpm test' },
    suggestedRule: null,
    defaultScope: 'project',
    createdAt: '2026-10-25T10:00:00.000Z',
    expiresAt: '2026-10-25T10:10:00.000Z',
  }
}

type Handler = (message: ServerMessage) => void

/**
 * A client that delivers like `DaemonClient`: a message that follows `auth.ok` in the same frame
 * batch reaches its handlers before the ready listeners, which run once the auth reply settles.
 */
function fakeClient(o: { list?: (pending: PermissionRequestInfo[]) => ServerMessage | Error } = {}) {
  let status: ConnectionStatus = 'idle'
  const handlers = new Map<string, Set<Handler>>()
  const ready = new Set<() => void>()
  const statusListeners = new Set<(status: ConnectionStatus) => void>()
  // What the daemon has waiting now.
  let waiting: PermissionRequestInfo[] = []
  const requests: ClientMessage['type'][] = []
  const setStatus = (next: ConnectionStatus) => {
    status = next
    for (const listener of statusListeners) listener(next)
  }
  const deliver = (message: ServerMessage) => {
    for (const handler of handlers.get(message.type) ?? []) handler(message)
  }
  const client = {
    get status() {
      return status
    },
    on: (type: string, handler: Handler) => {
      const set = handlers.get(type) ?? new Set()
      set.add(handler)
      handlers.set(type, set)
      return () => set.delete(handler)
    },
    onReady: (listener: () => void) => {
      ready.add(listener)
      return () => ready.delete(listener)
    },
    onStatus: (listener: (status: ConnectionStatus) => void) => {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    request: async (message: { type: ClientMessage['type'] }) => {
      requests.push(message.type)
      const reply = o.list
        ? o.list(waiting)
        : ({ type: 'permissions.result', requests: waiting } satisfies ServerMessage)
      if (reply instanceof Error) throw reply
      return reply
    },
  }
  return {
    client: client as unknown as DaemonClient,
    requests,
    setWaiting: (next: PermissionRequestInfo[]) => {
      waiting = next
    },
    deliver,
    /** The daemon accepts the connection and replays what waits, in one go (#384). */
    async connect() {
      setStatus('authenticating')
      for (const r of waiting) deliver({ type: 'permission.request', request: r })
      await Promise.resolve()
      setStatus('open')
      for (const listener of ready) listener()
      // The list reply settles.
      await new Promise((r) => setTimeout(r, 0))
    },
    drop: () => setStatus('reconnecting'),
  }
}

const pendingIds = () => Object.keys(usePermissionsStore.getState().pending).sort()

beforeEach(() => {
  usePermissionsStore.setState({ pending: {}, lastResolved: null })
})

describe('bindPermissions (#384)', () => {
  test('a replay delivered before ready is kept on a cold start', async () => {
    const f = fakeClient()
    f.setWaiting([request('r1')])
    bindPermissions(f.client)
    await f.connect()
    expect(pendingIds()).toEqual(['r1'])
    expect(selectPendingCounts(usePermissionsStore.getState())).toEqual({ s1: 1 })
  })

  test('stores bound after the connection opened ask for the waiting requests', async () => {
    const f = fakeClient()
    f.setWaiting([request('r1')])
    // The replay went out before anyone listened.
    await f.connect()
    expect(pendingIds()).toEqual([])
    bindPermissions(f.client)
    await vi.waitFor(() => expect(pendingIds()).toEqual(['r1']))
  })

  test('a reconnect keeps the waiting requests and drops the ones answered meanwhile', async () => {
    const f = fakeClient()
    f.setWaiting([request('r1'), request('r2')])
    bindPermissions(f.client)
    await f.connect()
    f.drop()
    // r1 was answered elsewhere while this phone was away; r3 is new.
    f.setWaiting([request('r2'), request('r3')])
    await f.connect()
    expect(pendingIds()).toEqual(['r2', 'r3'])
  })

  test('requests seen again do not buzz twice; new ones do', async () => {
    const f = fakeClient()
    const buzz = vi.fn()
    f.setWaiting([request('r1')])
    bindPermissions(f.client, buzz)
    await f.connect()
    f.drop()
    f.setWaiting([request('r1'), request('r2')])
    await f.connect()
    expect(buzz.mock.calls.map(([r]) => r.requestId)).toEqual(['r1', 'r2'])
  })

  test('older daemons without the list keep what this connection replayed', async () => {
    const f = fakeClient({ list: () => new Error('unknown_type') })
    f.setWaiting([request('r1'), request('r2')])
    bindPermissions(f.client)
    await f.connect()
    expect(pendingIds()).toEqual(['r1', 'r2'])
    f.drop()
    f.setWaiting([request('r2')])
    await f.connect()
    expect(pendingIds()).toEqual(['r2'])
  })

  test('resolved requests leave the list', async () => {
    const f = fakeClient()
    f.setWaiting([request('r1')])
    bindPermissions(f.client)
    await f.connect()
    f.deliver({ type: 'permission.resolved', requestId: 'r1', sessionId: 's1', outcome: 'allowed' })
    expect(pendingIds()).toEqual([])
    expect(usePermissionsStore.getState().lastResolved).toMatchObject({ requestId: 'r1', outcome: 'allowed' })
  })
})
