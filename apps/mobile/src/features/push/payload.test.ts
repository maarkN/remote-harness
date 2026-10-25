import { describe, expect, test } from 'vitest'
import { extractPushData } from './payload'

describe('extractPushData', () => {
  test('carries the computer that sent it', () => {
    expect(
      extractPushData({ content: { data: { sessionId: 's', daemonId: 'd'.repeat(32) } } })?.daemonId,
    ).toBe('d'.repeat(32))
  })

  test('reads data from content or from the remote payload', () => {
    expect(
      extractPushData({ content: { data: { sessionId: 's', requestId: 'r', event: 'PermissionRequest' } } }),
    ).toEqual({
      sessionId: 's',
      profileId: undefined,
      event: 'PermissionRequest',
      requestId: 'r',
      daemonId: undefined,
    })
    expect(
      extractPushData({
        content: { data: {} },
        trigger: { type: 'push', payload: { sessionId: 'x', aps: {} } },
      }),
    ).toMatchObject({
      sessionId: 'x',
    })
    expect(extractPushData({ content: {} })).toBeNull()
  })
})
