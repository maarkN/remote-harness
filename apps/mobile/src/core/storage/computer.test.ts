import * as nodeCrypto from 'node:crypto'
import { createNoiseCrypto, type NodeLikeCrypto } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import {
  activateInIndex,
  addToIndex,
  type Computer,
  EMPTY_INDEX,
  parseIndex,
  parseStoredComputer,
  removeFromIndex,
  serializeComputer,
  withPaths,
} from './computer'

const crypto = createNoiseCrypto(nodeCrypto as unknown as NodeLikeCrypto)
const A = 'a'.repeat(32)
const B = 'b'.repeat(32)
const computer: Computer = {
  daemonId: A,
  daemonKey: crypto.generateKeyPair().publicKey,
  deviceKey: crypto.generateKeyPair(),
  addresses: ['192.168.1.20:7337'],
  relay: 'wss://br.relay.remoteharness.app',
  relays: ['wss://us.relay.remoteharness.app', 'wss://br.relay.remoteharness.app'],
  name: 'studio',
  alias: 'Desk',
}

describe('stored computers', () => {
  test('round trip with relays and alias; the previous version without relays still reads', () => {
    expect(parseStoredComputer(serializeComputer(computer))).toEqual({ kind: 'computer', computer })
    const {
      relays: _r,
      alias: _a,
      ...old
    } = JSON.parse(serializeComputer(computer)) as Record<string, unknown>
    const parsed = parseStoredComputer(JSON.stringify(old))
    expect(parsed.kind === 'computer' && parsed.computer.relays).toEqual([])
  })

  test('paths from the daemon replace the saved ones only when they differ', () => {
    const same = withPaths(computer, {
      addresses: computer.addresses,
      relay: computer.relay ?? null,
      relays: computer.relays,
    })
    expect(same).toBe(computer)
    const moved = withPaths(computer, {
      addresses: ['10.0.0.5:7337'],
      relay: 'wss://us.relay.remoteharness.app',
      relays: computer.relays,
    })
    expect(moved).toMatchObject({ addresses: ['10.0.0.5:7337'], relay: 'wss://us.relay.remoteharness.app' })
    // A daemon with no relay right now keeps the last known one for the next attempts.
    expect(withPaths(computer, { addresses: [], relay: null, relays: [] })).toMatchObject({
      relay: computer.relay,
      relays: computer.relays,
    })
  })
})

describe('computers index', () => {
  test('adding makes active and most recent; removing the active one picks the next', () => {
    const one = addToIndex(EMPTY_INDEX, A)
    const two = addToIndex(one, B)
    expect(two).toEqual({ active: B, ids: [B, A] })
    expect(activateInIndex(two, A)).toEqual({ active: A, ids: [A, B] })
    expect(removeFromIndex(two, B)).toEqual({ active: A, ids: [A] })
    expect(removeFromIndex(two, A)).toEqual({ active: B, ids: [B] })
    expect(removeFromIndex(removeFromIndex(two, A), B)).toEqual({ active: null, ids: [] })
  })

  test('a broken or stale index is repaired', () => {
    expect(parseIndex(null)).toEqual(EMPTY_INDEX)
    expect(parseIndex('{oops')).toEqual(EMPTY_INDEX)
    expect(parseIndex(JSON.stringify({ active: B, ids: [A] }))).toEqual({ active: A, ids: [A] })
  })
})
