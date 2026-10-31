import { describe, expect, test } from 'vitest'
import { messagesFor } from '../src/core/i18n/index.ts'
import type { TrayMenuState, TrayPending, TraySession } from '../src/features/updates/menu.ts'
import { buildTrayPopover } from '../src/features/updates/popover.ts'

const en = messagesFor('en-US').updates.tray
const pt = messagesFor('pt-BR').updates.tray
const NOW = Date.parse('2026-10-18T09:41:00Z')

const session = (id: string, state: TraySession['state'], patch: Partial<TraySession> = {}): TraySession => ({
  id,
  title: `Session ${id}`,
  folder: '~/projects/acme-api',
  profile: 'Work',
  state,
  worktree: false,
  controllable: state !== 'ended',
  agent: 'claude',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
})

const pending: TrayPending = {
  requestId: 'r1',
  sessionId: 'a',
  title: 'Add rate limit on login',
  profile: 'Work',
  summary: 'Bash · gh pr create --fill --base main',
  canAlways: true,
  agent: 'claude',
  profileColor: '#61afef',
  createdAt: '2026-10-18T09:40:08.000Z',
}

const base: TrayMenuState = {
  version: '0.11.0',
  channel: 'main',
  auto: false,
  available: null,
  checking: false,
  updating: false,
  canUpdate: true,
  canRestart: true,
  machine: 'MacBook Pro',
  since: '09:12',
  sessions: [
    session('a', 'waiting', { worktree: true }),
    session('b', 'running', { agent: 'codex', profile: 'Personal' }),
    session('z', 'ended'),
  ],
  pending: null,
  devices: {
    push: true,
    items: [
      {
        id: 'iphone',
        name: 'iPhone',
        platform: 'ios',
        pairedAt: NOW - 3 * 86_400_000,
        lastSeen: NOW,
        paths: ['direct'],
      },
    ],
  },
  network: { direct: true, addresses: ['192.168.1.20:7337'], relay: true, homeRelay: 'wss://r.example' },
  canStart: true,
  pairing: { url: 'remoteharness://pair?v=2', address: '192.168.1.20:7337' },
  locale: 'en-US',
  now: NOW,
  windows: true,
  popover: true,
}

describe('tray popover', () => {
  test('header with the paths and a state pill, never an address', () => {
    const popover = buildTrayPopover(base, en)
    expect(popover.header).toEqual({
      title: 'Remote Harness',
      subtitle: 'MacBook Pro · direct + relay paths · 0.11.0 · since 09:12',
      pill: { label: 'running', tone: 'idle' },
    })
    expect(JSON.stringify(popover)).not.toContain('192.168.1.20')
    expect(buildTrayPopover({ ...base, updating: true }, en).header.pill).toEqual({
      label: 'Updating…',
      tone: 'accent',
    })
  })

  test('the waiting card answers in place, or only opens the terminal when answered elsewhere', () => {
    const card = buildTrayPopover({ ...base, pending }, en).pending
    expect(card).toMatchObject({
      label: 'Waiting for you',
      createdAt: pending.createdAt,
      agent: 'claude',
      title: 'Add rate limit on login',
      profile: 'Work',
      profileColor: '#61afef',
      summary: 'Bash · gh pr create --fill --base main',
    })
    expect(card?.actions).toEqual([
      { id: 'deny:r1', label: 'Deny', style: 'deny' },
      { id: 'always:r1', label: 'Always allow' },
      { id: 'allow:r1', label: 'Allow', style: 'allow' },
    ])
    const prefs = {
      permissions: false,
      keepAwake: 'off' as const,
      push: true,
      machineName: 'MacBook Pro',
      showInMenuBar: true,
      startAtLogin: null,
    }
    expect(buildTrayPopover({ ...base, pending, prefs }, en).pending?.actions).toEqual([
      { id: 'focus:a', label: 'Open in terminal (tmux)' },
    ])
    expect(buildTrayPopover(base, en).pending).toBeNull()
  })

  test('sessions as rows with badge, detail and pill; ended and the rest open the Sessions window', () => {
    const { sessions } = buildTrayPopover(base, en)
    expect(sessions.label).toBe('Sessions')
    expect(sessions.detail).toBe('3 · 1 running')
    expect(sessions.rows[0]).toEqual({
      id: 'a',
      agent: 'claude',
      title: 'Session a',
      detail: '~/projects/acme-api · Work · worktree',
      pill: { label: 'waiting', tone: 'waiting' },
      action: 'focus:a',
      menu: [
        { id: 'focus:a', label: 'Open in terminal (tmux)', enabled: true },
        { id: 'rename:a', label: 'Rename…' },
        { id: 'close:a', label: 'Close session', enabled: true },
      ],
    })
    expect(sessions.rows.map((row) => row.id)).toEqual(['a', 'b'])
    expect(sessions.ended).toEqual({ id: 'see-all', label: '1 ended session' })
    expect(sessions.more).toBeNull()
    const many = Array.from({ length: 8 }, (_, i) => session(`s${i}`, 'idle'))
    const capped = buildTrayPopover({ ...base, sessions: many }, en).sessions
    expect(capped.rows).toHaveLength(5)
    expect(capped.more).toEqual({ id: 'see-all', label: 'See all sessions…' })
    expect(buildTrayPopover({ ...base, sessions: [] }, en).sessions.empty).toBe('No sessions')
  })

  test('devices with their state, opening the Devices tab', () => {
    const { devices } = buildTrayPopover(base, en)
    expect(devices).toEqual({
      label: 'Devices',
      detail: 'push ✓',
      rows: [
        {
          id: 'iphone',
          name: 'iPhone',
          platform: 'ios',
          detail: 'paired 3 days ago',
          pill: { label: 'online · direct', tone: 'online' },
        },
      ],
      empty: null,
      action: 'prefs:devices',
    })
    const none = buildTrayPopover({ ...base, devices: { push: false, items: [] } }, pt).devices
    expect(none.empty).toBe('Pareie um celular para acompanhar suas sessões por ele')
    expect(none.detail).toBe('push desligado')
  })

  test('quick actions: pairing tab once listening, the update state and Quit', () => {
    const [first, second] = buildTrayPopover(base, en).actions
    expect(first?.map((a) => a.id)).toEqual(['new', 'prefs:pairing', 'docs'])
    expect(second).toEqual([
      { id: 'prefs', label: 'Preferences…' },
      { id: 'check', label: 'Check for updates', detail: 'main (stable)', enabled: true },
      { id: 'quit', label: 'Quit tray' },
    ])
    const notListening = buildTrayPopover({ ...base, pairing: null }, en).actions[0]
    expect(notListening?.[1]?.id).toBe('pair')
    const available = buildTrayPopover(
      { ...base, available: { version: '0.12.0', downgrade: false }, canStopService: true },
      en,
    ).actions[1]
    expect(available?.[1]).toEqual({ id: 'update', label: 'Update now (0.12.0)' })
    expect(available?.[2]).toEqual({
      id: 'quit-menu',
      label: 'Quit',
      items: [
        { id: 'quit', label: 'Hide the icon (the service keeps running)' },
        { id: 'quit-service', label: 'Stop the service until the next login' },
      ],
    })
    expect(buildTrayPopover({ ...base, canUpdate: false }, en).actions[1]?.map((a) => a.id)).toEqual([
      'prefs',
      'quit',
    ])
  })
})
