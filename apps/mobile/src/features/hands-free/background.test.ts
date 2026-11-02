import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import {
  announces,
  backgroundTexts,
  IDLE_TIMEOUT_MS,
  idleDeadline,
  idleOffSentence,
  reportedForeground,
} from './background'

const session = { id: 's1', profileId: 'p1', title: 'Fix the tests' }
const none = { profiles: [], sessions: [] }

describe('announces', () => {
  test('always in the foreground', () => {
    expect(announces(session, { profiles: ['p1'], sessions: [] }, true)).toBe(true)
  })

  test('in the background only when neither the session nor its profile is muted', () => {
    expect(announces(session, none, false)).toBe(true)
    expect(announces(session, { profiles: [], sessions: ['s1'] }, false)).toBe(false)
    expect(announces(session, { profiles: ['p1'], sessions: [] }, false)).toBe(false)
  })
})

describe('idle timeout', () => {
  test('is 30 minutes after the last activity', () => {
    expect(IDLE_TIMEOUT_MS).toBe(30 * 60_000)
    expect(idleDeadline(1_000)).toBe(1_000 + IDLE_TIMEOUT_MS)
  })

  test('says how long it waited, in every language', () => {
    expect(idleOffSentence(createI18n('en-US').t)).toBe(
      'Hands-free turned off after 30 minutes without activity.',
    )
    expect(idleOffSentence(createI18n('pt-BR').t)).toContain('30 minutos')
    expect(idleOffSentence(createI18n('es-ES').t)).toContain('30 minutos')
  })
})

describe('backgroundTexts', () => {
  test('names the session and links to it', () => {
    const texts = backgroundTexts(session, createI18n('en-US').t)
    expect(texts).toEqual({
      title: 'Hands-free is on',
      subtitle: 'Fix the tests',
      stop: 'Stop',
      channel: 'Hands-free',
      link: 'remoteharness://session/s1',
    })
  })

  test('falls back to "Session" for an untitled session', () => {
    expect(backgroundTexts({ ...session, title: '' }, createI18n('pt-BR').t).subtitle).toBe('Sessão')
  })
})

describe('reportedForeground', () => {
  test('hands-free counts as the foreground', () => {
    expect(reportedForeground('active', false)).toBe(true)
    expect(reportedForeground('background', false)).toBe(false)
    expect(reportedForeground('background', true)).toBe(true)
    expect(reportedForeground('inactive', true)).toBe(true)
  })
})
