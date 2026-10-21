import { describe, expect, test } from 'vitest'
import { unreachableView } from './unreachable'

describe('unreachableView', () => {
  test('open connection: never shown', () => {
    expect(unreachableView('open', false, false)).toBe('none')
  })

  test('a brief reconnect (not yet unreachable): not shown', () => {
    expect(unreachableView('reconnecting', false, false)).toBe('none')
  })

  test('a token rejection is never the unreachable state, even if unreachable lingers true', () => {
    expect(unreachableView('unauthorized', true, false)).toBe('none')
  })

  test('unreachable with nothing cached: the full checklist', () => {
    expect(unreachableView('reconnecting', true, false)).toBe('full')
  })

  test('unreachable with a stale list cached: the compact notice', () => {
    expect(unreachableView('reconnecting', true, true)).toBe('compact')
  })
})
