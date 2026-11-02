import { beforeEach, describe, expect, test } from 'vitest'
import { useHandsFreeStore } from './store'

beforeEach(() => useHandsFreeStore.getState().stop())

describe('hands-free store', () => {
  test('starts for one session at a time', () => {
    useHandsFreeStore.getState().start('a')
    expect(useHandsFreeStore.getState().sessionId).toBe('a')
    useHandsFreeStore.getState().start('b')
    expect(useHandsFreeStore.getState().sessionId).toBe('b')
  })

  test('starting resets what the bar shows', () => {
    useHandsFreeStore.setState({ phase: 'speaking', lastSaid: 'Hello.' })
    useHandsFreeStore.getState().start('a')
    expect(useHandsFreeStore.getState()).toMatchObject({ phase: 'idle', lastSaid: '' })
  })

  test('stop clears the session and the controls', () => {
    let talked = 0
    useHandsFreeStore.getState().start('a')
    useHandsFreeStore.setState({ talk: () => void talked++ })
    useHandsFreeStore.getState().stop()
    const state = useHandsFreeStore.getState()
    expect(state.sessionId).toBeNull()
    state.talk()
    expect(talked).toBe(0)
  })
})
