import { describe, expect, test } from 'vitest'
import {
  ACTION_INTERRUPT,
  ACTION_REPLY,
  ACTION_REPLY_VOICE,
  ACTION_SEND_NEXT,
  parseTurnData,
  TURN_CATEGORY,
  turnActionOf,
  turnCategoryActions,
  turnRequest,
} from './turn'

const labels = {
  reply: 'Reply',
  replyPlaceholder: 'Message',
  send: 'Send',
  voice: 'Reply by voice',
  interrupt: 'Interrupt',
  sendNext: 'Send next queued',
}

describe('turn actions', () => {
  test('identifiers map to actions', () => {
    expect(turnActionOf(ACTION_REPLY)).toBe('reply')
    expect(turnActionOf(ACTION_REPLY_VOICE)).toBe('voice')
    expect(turnActionOf(ACTION_INTERRUPT)).toBe('interrupt')
    expect(turnActionOf(ACTION_SEND_NEXT)).toBe('sendNext')
    expect(turnActionOf('ALLOW')).toBeNull()
  })

  test('each action sends its request; voice and an empty reply send nothing', () => {
    expect(turnRequest('reply', 's', '  run the tests  ')).toEqual({
      type: 'session.input',
      sessionId: 's',
      text: 'run the tests',
      mode: 'auto',
    })
    expect(turnRequest('reply', 's', '   ')).toBeNull()
    expect(turnRequest('reply', 's')).toBeNull()
    expect(turnRequest('interrupt', 's')).toEqual({ type: 'session.key', sessionId: 's', key: 'Escape' })
    expect(turnRequest('sendNext', 's')).toEqual({ type: 'queue.sendNext', sessionId: 's' })
    expect(turnRequest('voice', 's')).toBeNull()
  })

  test('categories: Send next only with a queue, every action needs an unlock', () => {
    const plain = turnCategoryActions(false, labels)
    expect(plain.map((a) => a.identifier)).toEqual([ACTION_REPLY, ACTION_REPLY_VOICE, ACTION_INTERRUPT])
    expect(turnCategoryActions(true, labels).map((a) => a.identifier)).toEqual([
      ACTION_REPLY,
      ACTION_REPLY_VOICE,
      ACTION_SEND_NEXT,
      ACTION_INTERRUPT,
    ])
    expect(plain.every((a) => a.options.isAuthenticationRequired)).toBe(true)
    expect(plain[0]?.textInput).toEqual({ submitButtonTitle: 'Send', placeholder: 'Message' })
    expect(plain[1]?.options.opensAppToForeground).toBe(true)
    expect(plain[2]?.options).toMatchObject({ opensAppToForeground: false, isDestructive: true })
  })

  test('parses the daemon turn data message, keeping only identifiers', () => {
    expect(
      parseTurnData({
        push: 'turn',
        sessionId: 's',
        profileId: 'p',
        event: 'Stop',
        daemonId: 'D1',
        title: 'Session finished',
        body: 'DoctorX',
        category: TURN_CATEGORY,
        extra: 'x',
      }),
    ).toEqual({
      title: 'Session finished',
      body: 'DoctorX',
      category: TURN_CATEGORY,
      data: { sessionId: 's', profileId: 'p', event: 'Stop', daemonId: 'D1' },
    })
    expect(parseTurnData({ push: 'turn', sessionId: 's', category: 'PERMISSION' })).toBeNull()
    expect(parseTurnData({ event: 'live', sessionId: 's' })).toBeNull()
    expect(parseTurnData(null)).toBeNull()
  })
})
