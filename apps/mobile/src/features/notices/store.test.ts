import { beforeEach, describe, expect, test } from 'vitest'
import type { Notice } from './select'
import { useNoticesStore } from './store'

const notice = (id: string): Notice => ({ id, kind: 'finished', sessionId: 's', session: 'S', at: 1 })

beforeEach(() => useNoticesStore.setState({ current: null, onScreen: null }))

describe('notices store', () => {
  test('the newest notice replaces the one shown', () => {
    useNoticesStore.getState().show(notice('a'))
    useNoticesStore.getState().show(notice('b'))
    expect(useNoticesStore.getState().current?.id).toBe('b')
  })

  test('dismissing by id only hides that notice', () => {
    useNoticesStore.getState().show(notice('b'))
    useNoticesStore.getState().dismiss('a')
    expect(useNoticesStore.getState().current?.id).toBe('b')
    useNoticesStore.getState().dismiss('b')
    expect(useNoticesStore.getState().current).toBeNull()
  })

  test('dismissing without an id hides whatever is shown', () => {
    useNoticesStore.getState().show(notice('a'))
    useNoticesStore.getState().dismiss()
    expect(useNoticesStore.getState().current).toBeNull()
  })
})
