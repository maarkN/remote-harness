import { CHANNEL_CLOSE } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { bannerKey } from './banner'

describe('bannerKey', () => {
  test('a refused protocol reads as incompatible versions, other refusals as pair again', () => {
    expect(bannerKey('unauthorized', false, CHANNEL_CLOSE.protocolMismatch)).toBe('incompatible')
    expect(bannerKey('unauthorized', false, CHANNEL_CLOSE.unauthorized)).toBe('unauthorized')
    expect(bannerKey('unauthorized', false, undefined)).toBe('unauthorized')
  })

  test('an unanswered reconnect reads as asleep; the other states as themselves', () => {
    expect(bannerKey('reconnecting', true, undefined)).toBe('asleep')
    expect(bannerKey('reconnecting', false, undefined)).toBe('reconnecting')
    expect(bannerKey('authenticating', true, undefined)).toBe('authenticating')
    expect(bannerKey('closed', false, CHANNEL_CLOSE.protocolMismatch)).toBe('closed')
  })
})
