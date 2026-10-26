import { describe, expect, test } from 'vitest'
import { requestVoiceReply, takeVoiceRequest } from './voice-request-store'

describe('voice reply request', () => {
  test('only the requested session takes it, once', () => {
    requestVoiceReply('s1')
    expect(takeVoiceRequest('s2')).toBe(false)
    expect(takeVoiceRequest('s1')).toBe(true)
    expect(takeVoiceRequest('s1')).toBe(false)
  })
})
