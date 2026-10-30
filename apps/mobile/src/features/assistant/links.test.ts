import { describe, expect, it } from 'vitest'
import { parseAssistantLink, sessionByTitle } from './links'

describe('parseAssistantLink', () => {
  it('reads a reply with its text and session', () => {
    expect(parseAssistantLink('reply', { text: ' run the tests ', session: 'Docs' })).toEqual({
      kind: 'reply',
      text: 'run the tests',
      sessionTitle: 'Docs',
    })
    expect(parseAssistantLink('reply', { sessionId: 'abc' })).toEqual({
      kind: 'reply',
      text: '',
      sessionId: 'abc',
    })
    expect(parseAssistantLink('reply', { text: ['first', 'second'] })).toEqual({
      kind: 'reply',
      text: 'first',
    })
  })

  it('reads the decision of an answer and refuses anything else', () => {
    expect(parseAssistantLink('answer', { decision: 'deny' })).toEqual({ kind: 'answer', decision: 'deny' })
    expect(parseAssistantLink('answer', { decision: 'maybe' })).toBeNull()
    expect(parseAssistantLink('answer', {})).toBeNull()
  })

  it('reads waiting and ignores unknown actions', () => {
    expect(parseAssistantLink('waiting', {})).toEqual({ kind: 'waiting' })
    expect(parseAssistantLink('delete', {})).toBeNull()
  })
})

describe('sessionByTitle', () => {
  const live = (title: string, patch = {}) => ({
    title,
    state: 'idle' as const,
    controllable: true,
    ...patch,
  })
  const sessions = [
    live('Fix login'),
    live('Documentação'),
    live('Docs site', { state: 'ended' as const }),
    live('Release notes'),
    live('Release checklist'),
  ]

  it('matches the title ignoring case and accents', () => {
    expect(sessionByTitle(sessions, 'fix LOGIN')?.title).toBe('Fix login')
    expect(sessionByTitle(sessions, 'documentacao')?.title).toBe('Documentação')
  })

  it('accepts a part of the title when only one live session has it', () => {
    expect(sessionByTitle(sessions, 'login')?.title).toBe('Fix login')
  })

  it('refuses ambiguous, ended or unknown titles', () => {
    expect(sessionByTitle(sessions, 'release')).toBeNull()
    expect(sessionByTitle(sessions, 'docs site')).toBeNull()
    expect(sessionByTitle(sessions, 'nothing')).toBeNull()
    expect(sessionByTitle(sessions, ' ')).toBeNull()
  })
})
