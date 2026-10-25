import type { Session } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import { dark } from '@/core/theme/palettes'
import {
  activityTokenKey,
  backgroundRegistration,
  liveAction,
  liveActionTarget,
  livePalette,
  liveStateFor,
  localLiveProps,
  sessionsToStart,
  shortenHome,
} from './logic'

const session = (id: string, state: Session['state'], profileId = 'p1') =>
  ({ id, state, profileId, title: 'Fix login', cwd: '/Users/me/app' }) as Session
const none = { profiles: [], sessions: [] }

describe('sessionsToStart', () => {
  test('starts sessions that just turned running', () => {
    const previous = { a: session('a', 'idle'), b: session('b', 'running') }
    const current = { a: session('a', 'running'), b: session('b', 'running'), c: session('c', 'running') }
    expect(sessionsToStart(previous, current, { enabled: true, muted: none })).toEqual(['a', 'c'])
  })

  test('skips muted sessions and profiles, and everything when disabled', () => {
    const current = { a: session('a', 'running'), b: session('b', 'running', 'p2') }
    expect(
      sessionsToStart({}, current, { enabled: true, muted: { profiles: ['p2'], sessions: ['a'] } }),
    ).toEqual([])
    expect(sessionsToStart({}, current, { enabled: false, muted: none })).toEqual([])
  })
})

describe('liveAction', () => {
  test('parses the widget button targets and ignores anything else', () => {
    expect(liveAction(liveActionTarget('allow', 'r1'))).toEqual({ requestId: 'r1', decision: 'allow' })
    expect(liveAction('deny:req:with:colons')).toEqual({ requestId: 'req:with:colons', decision: 'deny' })
    expect(liveAction('open')).toBeNull()
    expect(liveAction('allow:')).toBeNull()
  })
})

describe('localLiveProps', () => {
  test('maps the session state and translates it', () => {
    expect(liveStateFor('idle')).toBe('done')
    const info = { title: 'Work', host: 'mac', startedAt: 5, changedAt: 6, endedAt: null }
    expect(localLiveProps(session('a', 'waiting'), info, createI18n('pt-BR').t)).toEqual({
      title: 'Work',
      state: 'waiting',
      status: 'Esperando você',
      step: '',
      tools: '',
      startedAt: 5,
      host: 'mac',
      session: 'Fix login',
      path: '~/app',
      recent: [],
      ago: 'há {time}',
      changedAt: 6,
      endedAt: null,
      glyphs: [],
      pending: null,
      hint: '',
      tasks: '',
      current: '',
      progress: null,
    })
  })

  test('carries the theme palette the status started with', () => {
    const palette = livePalette(dark)
    expect(palette).toEqual({
      background: dark.colors.background,
      text: dark.colors.text,
      textMuted: dark.colors.textMuted,
      accent: dark.colors.accent,
      success: dark.colors.success,
      warning: dark.colors.warning,
    })
    const info = { title: 'Work', host: 'mac', startedAt: 5, changedAt: 6, endedAt: null, palette }
    expect(localLiveProps(session('a', 'running'), info, createI18n('en-US').t).palette).toEqual(palette)
  })

  test('shortens the usual home folders', () => {
    expect(shortenHome('/Users/me/code/app')).toBe('~/code/app')
    expect(shortenHome('/home/me')).toBe('~')
    expect(shortenHome('/srv/app')).toBe('/srv/app')
    expect(shortenHome('/Users')).toBe('/Users')
  })
})

describe('backgroundRegistration', () => {
  const token = { activityId: 'a1', pushToken: 'tok', url: 'claude-remote://session/s1' }
  const idle = { appActive: false, sent: new Set<string>() }

  test('a push-started activity registers its session from the background', () => {
    expect(backgroundRegistration(token, idle)).toBe('s1')
  })

  test('the app in front registers its own activities', () => {
    expect(backgroundRegistration(token, { ...idle, appActive: true })).toBeNull()
  })

  test('each token of an activity goes once; a new token goes again', () => {
    const sent = new Set([activityTokenKey(token)])
    expect(backgroundRegistration(token, { appActive: false, sent })).toBeNull()
    expect(backgroundRegistration({ ...token, pushToken: 'tok2' }, { appActive: false, sent })).toBe('s1')
  })

  test('activities without a session deep link or token are left alone', () => {
    expect(backgroundRegistration({ activityId: 'a1', pushToken: 'tok' }, idle)).toBeNull()
    expect(backgroundRegistration({ ...token, url: 'https://example.com' }, idle)).toBeNull()
    expect(backgroundRegistration({ ...token, pushToken: '' }, idle)).toBeNull()
  })
})
