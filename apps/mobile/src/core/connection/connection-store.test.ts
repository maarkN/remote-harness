import * as nodeCrypto from 'node:crypto'
import { createNoiseCrypto, type NodeLikeCrypto } from '@remote-harness/protocol'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Computer } from '../storage/computer'
import { computerName, setComputerStorage, useConnectionStore } from './connection-store'

const crypto = createNoiseCrypto(nodeCrypto as unknown as NodeLikeCrypto)
const computer = (id: string, name: string): Computer => ({
  daemonId: id.repeat(32),
  daemonKey: crypto.generateKeyPair().publicKey,
  deviceKey: crypto.generateKeyPair(),
  addresses: ['127.0.0.1:1'],
  relays: [],
  name,
})
const laptop = computer('a', 'laptop')
const desktop = computer('b', 'desktop')

const saved: string[] = []
beforeEach(() => {
  vi.useFakeTimers()
  saved.length = 0
  setComputerStorage({
    save: async (c) => {
      saved.push(c.daemonId)
    },
    activate: async () => undefined,
    remove: async () => null,
  })
  useConnectionStore.getState().loadComputers([], null)
})
afterEach(() => {
  useConnectionStore.getState().client?.close()
  vi.useRealTimers()
})

describe('several computers', () => {
  test('pairing adds and activates; switching and forgetting keep one active connection', async () => {
    const store = useConnectionStore.getState()
    await store.addComputer(laptop)
    await useConnectionStore.getState().addComputer(desktop)
    let state = useConnectionStore.getState()
    expect(state.computers.map((c) => c.name)).toEqual(['desktop', 'laptop'])
    expect(state.activeId).toBe(desktop.daemonId)
    const first = state.client

    await state.selectComputer(laptop.daemonId)
    state = useConnectionStore.getState()
    expect(state.activeId).toBe(laptop.daemonId)
    expect(state.credentials?.name).toBe('laptop')
    expect(state.client).not.toBe(first)

    await state.forgetComputer(laptop.daemonId)
    state = useConnectionStore.getState()
    expect(state.computers.map((c) => c.name)).toEqual(['desktop'])
    expect(state.activeId).toBe(desktop.daemonId)

    await state.forgetComputer(desktop.daemonId)
    state = useConnectionStore.getState()
    expect(state.computers).toEqual([])
    expect(state.client).toBeNull()
  })

  test('re-pairing the same computer replaces it; aliases rename it on this device', async () => {
    await useConnectionStore.getState().addComputer(laptop)
    await useConnectionStore.getState().addComputer({ ...laptop, addresses: ['10.0.0.9:7337'] })
    expect(useConnectionStore.getState().computers).toHaveLength(1)
    await useConnectionStore.getState().renameComputer(laptop.daemonId, '  Work laptop ')
    const renamed = useConnectionStore.getState().credentials
    expect(renamed && computerName(renamed)).toBe('Work laptop')
    await useConnectionStore.getState().renameComputer(laptop.daemonId, '')
    const reset = useConnectionStore.getState().credentials
    expect(reset && computerName(reset)).toBe('laptop')
    expect(saved).toContain(laptop.daemonId)
  })
})
