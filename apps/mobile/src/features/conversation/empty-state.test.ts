import { describe, expect, test } from 'vitest'
import { emptyConversation } from './empty-state'

describe('emptyConversation', () => {
  test('loading only until the first page, then an empty state', () => {
    expect(emptyConversation({ loaded: false, error: null }, true)).toBe('loading')
    expect(emptyConversation({ loaded: true, error: null }, true)).toBe('firstPrompt')
    expect(emptyConversation({ loaded: true, error: null }, false)).toBe('noMessages')
  })

  test('an error wins over loading and the empty state', () => {
    expect(emptyConversation({ loaded: false, error: new Error('x') }, true)).toBe('error')
    expect(emptyConversation({ loaded: true, error: 'gone' }, false)).toBe('error')
  })
})
