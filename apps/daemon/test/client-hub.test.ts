import { describe, expect, test } from 'vitest'
import { ClientHub, type Connection, type ConnectionPath } from '../src/transport/connection.ts'

function connection(id: string, deviceId?: string, path?: ConnectionPath): Connection & { drop(): void } {
  const handlers: Array<() => void> = []
  return {
    id,
    deviceId,
    path,
    foreground: false,
    send: () => undefined,
    onClose: (fn) => handlers.push(fn),
    close: () => undefined,
    drop: () => {
      for (const fn of handlers.splice(0)) fn()
    },
  }
}

describe('ClientHub.devicePaths', () => {
  test('groups the paths of each authenticated device and forgets closed connections', () => {
    const hub = new ClientHub()
    const direct = connection('a', 'phone', 'direct')
    const relay = connection('b', 'phone', 'relay')
    hub.add(direct)
    hub.add(relay)
    hub.add(connection('c', 'tablet', 'relay'))
    hub.add(connection('d', undefined, 'direct'))
    expect(hub.devicePaths()).toEqual(
      new Map([
        ['phone', new Set(['direct', 'relay'])],
        ['tablet', new Set(['relay'])],
      ]),
    )
    direct.drop()
    expect(hub.devicePaths().get('phone')).toEqual(new Set(['relay']))
  })
})
