import { describe, expect, test } from 'vitest'
import { computerQueryKey } from './query-key'

describe('computerQueryKey', () => {
  test('the same query on two computers has two keys (#555)', () => {
    expect(computerQueryKey('laptop', ['models', 'work'])).toEqual(['computer', 'laptop', 'models', 'work'])
    expect(computerQueryKey('desktop', ['models', 'work'])).not.toEqual(
      computerQueryKey('laptop', ['models', 'work']),
    )
    expect(computerQueryKey(null, ['projects'])).toEqual(['computer', null, 'projects'])
  })
})
