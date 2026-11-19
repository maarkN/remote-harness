import { describe, expect, test } from 'vitest'
import { messagesFor } from '../src/core/i18n/index.ts'
import {
  buildTrayMenu,
  MAX_TRAY_SESSIONS,
  MAX_TRAY_SESSIONS_WINDOW,
  pendingSummary,
  relativeTime,
  TRAY_ACTIONS,
  type TrayDevice,
  type TrayItem,
  type TrayMenuState,
  type TrayNetwork,
  type TraySession,
  trayIcon,
  trayTerminalOptions,
} from '../src/features/updates/menu.ts'

const en = messagesFor('en-US').updates.tray
const pt = messagesFor('pt-BR').updates.tray

const NOW = Date.parse('2026-10-18T09:41:00Z')

const DAY = 86_400_000
const device = (id: string, patch: Partial<TrayDevice> = {}): TrayDevice => ({
  id,
  name: id,
  platform: 'ios',
  pairedAt: NOW - 60 * DAY,
  lastSeen: null,
  paths: [],
  ...patch,
})
/** Six paired devices: `iphone` online, then `pixel`, `ipad`, `mac` and `old` by last seen, `never` never seen. */
const sixDevices: TrayDevice[] = [
  device('old', { lastSeen: NOW - 30 * DAY }),
  device('ipad', { lastSeen: NOW - 2 * DAY }),
  device('never', { pairedAt: NOW - DAY }),
  device('pixel', { lastSeen: NOW - 3_600_000 }),
  device('iphone', { lastSeen: NOW - 9 * DAY, paths: ['relay'] }),
  device('mac', { lastSeen: NOW - 5 * DAY }),
]

const base: TrayMenuState = {
  version: '0.11.0',
  channel: 'main',
  auto: false,
  available: null,
  checking: false,
  updating: false,
  canUpdate: false,
  canRestart: false,
  machine: 'MacBook Pro',
  since: '09:12',
  sessions: [],
  pending: null,
  devices: {
    push: true,
    items: [
      {
        id: 'iphone',
        name: 'iPhone',
        platform: 'ios',
        pairedAt: NOW - 3 * 86_400_000,
        lastSeen: NOW - 60_000,
        paths: ['relay'],
      },
    ],
  },
  canStart: true,
  locale: 'en-US',
  now: NOW,
}

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

const ids = (items: TrayItem[]): string[] =>
  items.flatMap((i) => ('id' in i ? [i.id] : 'items' in i ? ids(i.items) : []))
const labels = (items: TrayItem[]): string[] =>
  items.flatMap((i) => ('label' in i ? [i.label, ...('items' in i ? labels(i.items) : [])] : []))

describe('tray shell menu', () => {
  test('status line, devices and the shell actions', () => {
    const menu = buildTrayMenu(base, en)
    expect(menu.icon).toBe('idle')
    expect(menu.items[0]).toEqual({
      id: 'status',
      label: 'MacBook Pro · 0.11.0 · since 09:12',
      enabled: false,
    })
    expect(labels(menu.items)).toContain('Devices · 1 · push ✓')
    expect(labels(menu.items)).toContain('No sessions')
    expect(ids(menu.items)).toEqual(
      expect.arrayContaining(['new', 'pair', 'docs', 'prefs', 'logs', 'doctor', 'quit']),
    )
    expect(
      buildTrayMenu({ ...base, devices: { push: false, items: [] } }, pt).items.map((i) =>
        'label' in i ? i.label : '',
      ),
    ).toContain('Dispositivos · 0')
  })

  test('sessions by recency with focus and close, ended ones collapsed, capped', () => {
    const sessions = [
      session('a', 'running', { worktree: true }),
      session('b', 'waiting'),
      session('c', 'idle'),
      session('d', 'ended'),
      session('e', 'ended'),
    ]
    const menu = buildTrayMenu({ ...base, sessions }, en)
    expect(menu.icon).toBe('working')
    expect(labels(menu.items)).toContain('Sessions · 5 · 1 running')
    expect(labels(menu.items)).toContain('Session a · running')
    expect(labels(menu.items)).toContain('~/projects/acme-api · Work · worktree')
    expect(ids(menu.items)).toEqual(
      expect.arrayContaining(['focus:a', 'rename:a', 'close:a', 'focus:c', 'rename:c', 'close:c']),
    )
    expect(ids(menu.items)).not.toContain('focus:d')
    expect(labels(menu.items)).toContain('2 ended sessions')
    const many = Array.from({ length: MAX_TRAY_SESSIONS + 3 }, (_, i) => session(`s${i}`, 'idle'))
    const capped = buildTrayMenu({ ...base, sessions: many }, en)
    expect(ids(capped.items).filter((id) => id.startsWith('focus:'))).toHaveLength(MAX_TRAY_SESSIONS)
    expect(ids(capped.items)).not.toContain(TRAY_ACTIONS.seeAll)
  })

  test('a helper with windows caps at 5 and adds "See all sessions…"; without windows it stays at 8', () => {
    const sessions = Array.from({ length: MAX_TRAY_SESSIONS_WINDOW + 3 }, (_, i) => session(`s${i}`, 'idle'))
    const windowed = buildTrayMenu({ ...base, sessions, windows: true }, en)
    expect(ids(windowed.items).filter((id) => id.startsWith('focus:'))).toHaveLength(MAX_TRAY_SESSIONS_WINDOW)
    expect(labels(windowed.items)).toContain('See all sessions…')
    expect(windowed.sessions).toEqual(sessions)
    expect(windowed.sessionsWindow).toEqual({
      title: 'Sessions',
      searchPlaceholder: 'Search sessions',
      actions: {
        focus: 'Open in terminal (tmux)',
        rename: 'Rename…',
        close: 'Close session',
        copyPath: 'Copy path',
      },
      renamePrompt: { title: 'Rename session', confirm: 'Rename', cancel: 'Cancel' },
      outsideTmux: { tag: 'outside tmux', hint: en.outsideTmuxHint },
    })
    const few = buildTrayMenu({ ...base, sessions: sessions.slice(0, 2), windows: true }, en)
    expect(ids(few.items)).not.toContain(TRAY_ACTIONS.seeAll)
  })

  test('a session outside tmux says so in its label and starts its submenu with why (#613)', () => {
    const sessions = [
      session('o', 'running', { controllable: false }),
      session('t', 'idle'),
      session('z', 'ended', { controllable: false }),
    ]
    const menu = buildTrayMenu({ ...base, sessions }, en)
    const submenu = (title: string) =>
      menu.items.find((i) => 'type' in i && i.type === 'submenu' && i.label.startsWith(title))
    const outside = submenu('Session o')
    expect(outside).toMatchObject({ type: 'submenu', label: 'Session o · running · outside tmux' })
    const items = outside && 'items' in outside ? outside.items : []
    expect(items[0]).toEqual({ id: 'outside:o', label: en.outsideTmuxHint, enabled: false })
    expect(items).toContainEqual({ id: 'focus:o', label: 'Open in terminal (tmux)', enabled: false })
    expect(items).toContainEqual({ id: 'close:o', label: 'Close session', enabled: false })
    expect(submenu('Session t')).toMatchObject({ label: 'Session t · idle' })
    expect(labels(menu.items).filter((label) => label.includes('outside tmux'))).toEqual([
      'Session o · running · outside tmux',
    ])
    expect(labels(buildTrayMenu({ ...base, sessions }, pt).items)).toContain(
      `Session o · ${pt.states.running} · fora do tmux`,
    )
  })

  test('the oldest pending permission goes first with Allow / Always / Deny / Focus', () => {
    const pending = {
      requestId: 'r1',
      sessionId: 'b',
      title: 'Add rate limit on login',
      profile: 'Work',
      summary: 'Bash · gh pr create --fill --base main',
      canAlways: true,
      agent: 'claude',
      profileColor: '#61afef',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const menu = buildTrayMenu({ ...base, sessions: [session('b', 'waiting')], pending }, en)
    expect(menu.icon).toBe('waiting')
    expect(labels(menu.items)).toContain('Waiting for you')
    expect(labels(menu.items)).toContain('Add rate limit on login · Bash · gh pr create --fill --base main')
    expect(ids(menu.items)).toEqual(expect.arrayContaining(['allow:r1', 'always:r1', 'deny:r1', 'focus:b']))
    const noRule = buildTrayMenu({ ...base, pending: { ...pending, canAlways: false } }, en)
    expect(ids(noRule.items)).not.toContain('always:r1')
    expect(trayIcon({ pending, sessions: [] })).toBe('waiting')
    expect(trayIcon({ pending: null, sessions: [session('x', 'idle')] })).toBe('idle')
  })

  test('Pair a phone: QR on macOS, the address, the terminal and a confirmed token rotation', () => {
    const pairing = { url: 'remoteharness://pair?v=2&id=x', address: '100.64.0.2:7337' }
    const find = (items: TrayItem[], label: string) =>
      items.find((i): i is Extract<TrayItem, { type: 'submenu' }> => 'items' in i && i.label === label)
    const mac = find(buildTrayMenu({ ...base, pairing, qr: true }, en).items, 'Pair a phone')
    expect(mac?.items[0]).toEqual({ type: 'qr', text: pairing.url })
    expect(labels(mac?.items ?? [])).toEqual(
      expect.arrayContaining([
        '100.64.0.2:7337',
        'Single use · expires in 5 minutes',
        'Show the pairing in the terminal',
      ]),
    )
    expect(ids(mac?.items ?? [])).toEqual(expect.arrayContaining(['pair']))
    expect(ids(mac?.items ?? [])).not.toContain('rotate-token')
    // Linux helpers get no QR item; before the daemon listens, the single item stays.
    const linux = find(buildTrayMenu({ ...base, pairing, qr: false }, en).items, 'Pair a phone')
    expect(linux?.items.some((i) => 'type' in i && i.type === 'qr')).toBe(false)
    expect(buildTrayMenu({ ...base, pairing: null }, en).items).toContainEqual({
      id: 'pair',
      label: 'Pair a phone…',
    })
  })

  test('Pair a phone shows the confirmation code once a device presented the QR (#593)', () => {
    const pairing = {
      url: 'remoteharness://pair?v=2&id=x',
      address: '100.64.0.2:7337',
      confirmation: '012345',
    }
    const find = (items: TrayItem[], label: string) =>
      items.find((i): i is Extract<TrayItem, { type: 'submenu' }> => 'items' in i && i.label === label)
    const mac = find(buildTrayMenu({ ...base, pairing, qr: true }, en).items, 'Pair a phone')
    expect(labels(mac?.items ?? [])).toContain('On the phone, enter 012 345')
    const before = find(
      buildTrayMenu({ ...base, pairing: { url: pairing.url, address: pairing.address }, qr: true }, en).items,
      'Pair a phone',
    )
    expect(labels(before?.items ?? []).some((label) => label.startsWith('On the phone'))).toBe(false)
    const prefs = {
      permissions: true,
      keepAwake: 'sessions' as const,
      push: true,
      machineName: 'MacBook Pro',
      showInMenuBar: true,
      startAtLogin: null,
    }
    const tab = buildTrayMenu(
      { ...base, pairing, prefs, windows: true, qr: true },
      en,
    ).prefsWindow?.tabs.find((t) => t.id === 'pairing')
    expect(tab?.sections.flatMap((section) => section.rows)).toContainEqual({
      kind: 'note',
      label: 'On the phone, enter 012 345',
    })
  })

  test('Preferences: permissions here, keep awake, push and the config file', () => {
    const prefs = {
      permissions: true,
      keepAwake: 'sessions' as const,
      push: true,
      machineName: 'MacBook Pro',
      showInMenuBar: true,
      startAtLogin: true,
    }
    const menu = buildTrayMenu({ ...base, prefs }, en)
    const sub = menu.items.find(
      (i): i is Extract<TrayItem, { type: 'submenu' }> => 'items' in i && i.label === 'Preferences',
    )
    expect(sub?.items[0]).toEqual({
      id: 'pref:permissions',
      label: 'Show permission requests here',
      checked: true,
    })
    const awake = sub?.items.find(
      (i): i is Extract<TrayItem, { type: 'submenu' }> =>
        'items' in i && i.label === 'Keep the computer awake',
    )
    expect(awake?.items).toEqual([
      { id: 'awake:off', label: 'Never', checked: false },
      { id: 'awake:sessions', label: 'While sessions are active', checked: true },
      { id: 'awake:always', label: 'Always', checked: false },
    ])
    expect(ids(sub?.items ?? [])).toEqual(expect.arrayContaining(['pref:push', 'prefs']))
    // Answers off: the waiting request keeps only Open in terminal.
    const pending = {
      requestId: 'r1',
      sessionId: 'b',
      title: 'T',
      profile: 'Work',
      summary: 'Bash · ls',
      canAlways: true,
      agent: 'claude',
      profileColor: '#61afef',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const quiet = buildTrayMenu({ ...base, pending, prefs: { ...prefs, permissions: false } }, en)
    expect(ids(quiet.items)).toContain('focus:b')
    expect(ids(quiet.items)).not.toContain('allow:r1')
    expect(ids(quiet.items)).not.toContain('deny:r1')
  })

  test('a helper with windows gets a single Preferences item instead of the submenu, plus the window payload', () => {
    const prefs = {
      permissions: true,
      keepAwake: 'sessions' as const,
      push: true,
      machineName: 'MacBook Pro',
      showInMenuBar: true,
      startAtLogin: false,
    }
    const profiles = [
      {
        id: 'claudin',
        name: 'Work',
        agent: 'claude',
        agentName: 'Claude Code',
        color: '#D97757',
        folder: '~/.claude',
      },
    ]
    const menu = buildTrayMenu({ ...base, prefs, profiles, windows: true }, en)
    expect(menu.items).toContainEqual({ id: 'prefs', label: 'Preferences…' })
    expect(menu.items.some((i) => 'items' in i && 'label' in i && i.label === 'Preferences')).toBe(false)
    expect(menu.prefsWindow?.title).toBe('Remote Harness Preferences')
    const tab = (id: string) => menu.prefsWindow?.tabs.find((t) => t.id === id)
    expect(tab('general')?.sections[0]?.rows).toEqual(
      expect.arrayContaining([
        { kind: 'text', id: 'pref:machine-name', label: 'Machine name', value: 'MacBook Pro' },
        { kind: 'toggle', id: 'pref:show-in-menu-bar', label: 'Show in menu bar', checked: true },
      ]),
    )
    expect(tab('general')?.sections[0]?.rows).toContainEqual({
      kind: 'toggle',
      id: 'pref:start-at-login',
      label: 'Start at login',
      checked: false,
    })
    // startAtLogin null (no service manager known): the row is omitted, not shown disabled.
    const noManager = buildTrayMenu(
      { ...base, prefs: { ...prefs, startAtLogin: null }, profiles, windows: true },
      en,
    )
    const noManagerTab = noManager.prefsWindow?.tabs.find((t) => t.id === 'general')
    expect(noManagerTab?.sections[0]?.rows.some((r) => 'id' in r && r.id === 'pref:start-at-login')).toBe(
      false,
    )
    expect(tab('profiles')?.sections).toEqual([
      {
        title: 'Work',
        rows: [
          { kind: 'text', id: 'profile-name:claudin', label: 'Name', value: 'Work' },
          { kind: 'value', label: 'Agent', value: 'Claude Code' },
          { kind: 'value', label: 'Config folder', value: '~/.claude' },
        ],
      },
    ])
    expect(menu.sessions).toEqual([]) // `base` has no sessions, but the field is still sent
    // Without windows, nothing is sent: the submenu already carries everything a thin helper needs.
    const thin = buildTrayMenu({ ...base, prefs, profiles }, en)
    expect(thin.prefsWindow).toBeUndefined()
  })

  test('Quit asks about the service only under a service manager', () => {
    const managed = buildTrayMenu({ ...base, canStopService: true }, en).items.at(-1)
    expect(managed).toEqual({
      type: 'submenu',
      label: 'Quit',
      items: [
        { id: 'quit', label: 'Hide the icon (the service keeps running)' },
        { id: 'quit-service', label: 'Stop the service until the next login' },
      ],
    })
    expect(buildTrayMenu(base, en).items.at(-1)).toEqual({ id: 'quit', label: 'Quit tray' })
  })

  test('pendingSummary keeps the tool and a short detail, never the whole input', () => {
    expect(pendingSummary({ tool: 'Bash', input: { command: 'gh pr create --fill --base main' } })).toBe(
      'Bash · gh pr create --fill --base main',
    )
    expect(pendingSummary({ tool: 'Edit', input: { file_path: '/w/src/a.ts', new_string: 'secret' } })).toBe(
      'Edit · /w/src/a.ts',
    )
    expect(pendingSummary({ tool: 'WebFetch', input: { url: 'https://example.com' } })).toBe(
      'WebFetch · https://example.com',
    )
    expect(pendingSummary({ tool: 'Task', input: { prompt: 'long prompt' } })).toBe('Task')
    const long = pendingSummary({ tool: 'Bash', input: { command: 'x'.repeat(100) } })
    expect(long.length).toBeLessThanOrEqual('Bash · '.length + 48)
    expect(long.endsWith('…')).toBe(true)
  })

  test('the status line names the paths, never an address', () => {
    const network = {
      direct: true,
      addresses: ['192.168.1.20:7337'],
      relay: true,
      homeRelay: 'wss://r.example',
    }
    const status = (n: TrayNetwork) => buildTrayMenu({ ...base, network: n }, en).items[0]
    expect(status(network)).toMatchObject({
      label: 'MacBook Pro · direct + relay paths · 0.11.0 · since 09:12',
    })
    expect(status({ ...network, homeRelay: null })).toMatchObject({
      label: expect.stringContaining('direct path'),
    })
    expect(status({ ...network, direct: false })).toMatchObject({
      label: expect.stringContaining('relay path'),
    })
    expect(status({ ...network, addresses: [], relay: false })).toMatchObject({
      label: expect.stringContaining('not reachable yet'),
    })
    expect(JSON.stringify(buildTrayMenu({ ...base, network }, en).items)).not.toContain('192.168.1.20')
  })

  test('each device with its state and a confirmed Revoke…', () => {
    const offline = {
      id: 'pixel',
      name: 'Pixel',
      platform: 'android',
      pairedAt: NOW - 86_400_000,
      lastSeen: null,
      paths: [] as ('direct' | 'relay')[],
    }
    const items = buildTrayMenu(
      { ...base, devices: { push: true, items: [...(base.devices?.items ?? []), offline] } },
      en,
    ).items
    const iphone = items.find((i) => 'label' in i && i.label === 'iPhone · online · relay')
    expect(iphone).toEqual({
      type: 'submenu',
      label: 'iPhone · online · relay',
      items: [
        { id: 'info:device:iphone', label: 'paired 3 days ago', enabled: false },
        { type: 'separator' },
        {
          type: 'submenu',
          label: 'Revoke…',
          items: [{ id: 'revoke:iphone', label: 'Revoke and sign it out' }],
        },
      ],
    })
    expect(labels(items)).toContain('Pixel · offline')
    expect(labels(items)).toContain('paired yesterday · not seen yet')
    expect(labels(buildTrayMenu({ ...base, devices: { push: false, items: [] } }, en).items)).toContain(
      'No paired devices',
    )
  })

  test('at most three devices; the rest behind "See all devices", a window or a submenu (#619)', () => {
    const state = { ...base, devices: { push: true, items: sixDevices } }
    const deviceRows = (items: TrayItem[]) =>
      items.flatMap((i) =>
        'type' in i && i.type === 'submenu' && / · (online|offline)/.test(i.label) ? [i.label] : [],
      )
    // A helper with windows: three devices and an item opening the Devices tab.
    const windowed = buildTrayMenu({ ...state, windows: true }, en).items
    expect(deviceRows(windowed)).toEqual(['iphone · online · relay', 'pixel · offline', 'ipad · offline'])
    expect(windowed).toContainEqual({ id: 'prefs:devices', label: 'See all devices (6)…' })
    // Without windows (Linux, Windows): every device in a submenu, each still with Revoke….
    const plain = buildTrayMenu({ ...state, windows: false }, en).items
    expect(deviceRows(plain)).toEqual(['iphone · online · relay', 'pixel · offline', 'ipad · offline'])
    const all = plain.find((i) => 'type' in i && i.type === 'submenu' && i.label === 'See all devices (6)')
    expect(all && 'type' in all && all.type === 'submenu' && deviceRows(all.items)).toEqual([
      'iphone · online · relay',
      'pixel · offline',
      'ipad · offline',
      'mac · offline',
      'old · offline',
      'never · offline',
    ])
    expect(labels(all ? [all] : [])).toContain('Revoke…')
    expect(labels(buildTrayMenu({ ...state, windows: false }, pt).items)).toContain(
      'Ver todos os dispositivos (6)',
    )
    // Three or fewer: no link.
    const few = buildTrayMenu(
      { ...base, devices: { push: true, items: sixDevices.slice(0, 3) }, windows: true },
      en,
    )
    expect(labels(few.items).some((label) => label.startsWith('See all devices'))).toBe(false)
  })

  test('relative times follow the locale', () => {
    const es = messagesFor('es-ES').updates.tray
    expect(relativeTime(NOW - 3 * 86_400_000, NOW, 'pt-BR', pt)).toBe('há 3 dias')
    expect(relativeTime(NOW - 2 * 3_600_000, NOW, 'es-ES', es)).toBe('hace 2 horas')
    expect(relativeTime(NOW - 10_000, NOW, 'en-US', en)).toBe('just now')
  })

  test('"Open sessions in": the choices offered and the picker / submenu (#615)', () => {
    const labels = messagesFor('en-US').terminals.choices
    // macOS with terminal windows: the window, Automatic, the installed apps, and the current choice.
    expect(
      trayTerminalOptions({
        platform: 'darwin',
        windows: true,
        installed: ['ghostty', 'terminal'],
        current: 'kitty',
      }),
    ).toEqual(['window', 'auto', 'ghostty', 'kitty', 'terminal'])
    expect(
      trayTerminalOptions({ platform: 'linux', windows: false, installed: ['kitty'], current: undefined }),
    ).toEqual(['auto', 'kitty'])
    const terminal = {
      label: 'Open sessions in',
      choice: 'ghostty' as const,
      options: (['window', 'auto', 'ghostty'] as const).map((id) => ({ id, label: labels[id] })),
    }
    const prefs = {
      permissions: true,
      keepAwake: 'sessions' as const,
      push: true,
      machineName: 'MacBook Pro',
      showInMenuBar: true,
      startAtLogin: null,
    }
    const windowed = buildTrayMenu({ ...base, prefs, terminal, windows: true }, en)
    const general = windowed.prefsWindow?.tabs
      .find((tab) => tab.id === 'general')
      ?.sections.flatMap((x) => x.rows)
    expect(general).toContainEqual({
      kind: 'picker',
      id: 'open-in:',
      label: 'Open sessions in',
      options: [
        { id: 'open-in:window', label: 'Remote Harness terminal window', checked: false },
        { id: 'open-in:auto', label: 'Automatic (the terminal app that is open)', checked: false },
        { id: 'open-in:ghostty', label: 'Ghostty', checked: true },
      ],
    })
    const plain = buildTrayMenu({ ...base, prefs, terminal }, en)
    const sub = plain.items.find(
      (i): i is Extract<TrayItem, { type: 'submenu' }> => 'items' in i && i.label === 'Preferences',
    )
    expect(sub?.items).toContainEqual({
      type: 'submenu',
      label: 'Open sessions in',
      items: [
        { id: 'open-in:window', label: 'Remote Harness terminal window', checked: false },
        { id: 'open-in:auto', label: 'Automatic (the terminal app that is open)', checked: false },
        { id: 'open-in:ghostty', label: 'Ghostty', checked: true },
      ],
    })
    // No shell state: no picker.
    expect(JSON.stringify(buildTrayMenu({ ...base, prefs, windows: true }, en))).not.toContain('open-in:')
  })

  test('Preferences tabs in the prototype order, with Network and Devices', () => {
    const prefs = {
      permissions: true,
      keepAwake: 'sessions' as const,
      push: true,
      machineName: 'MacBook Pro',
      showInMenuBar: true,
      startAtLogin: null,
    }
    const network = { direct: true, addresses: ['192.168.1.20:7337'], relay: true, homeRelay: null }
    const menu = buildTrayMenu({ ...base, prefs, network, windows: true, canRestart: true }, en)
    const tabs = menu.prefsWindow?.tabs ?? []
    expect(tabs.map((t) => t.id)).toEqual([
      'general',
      'profiles',
      'notifications',
      'network',
      'devices',
      'pairing',
      'updates',
      'advanced',
    ])
    const rows = (id: string) =>
      tabs.find((t) => t.id === id)?.sections.flatMap((section) => section.rows) ?? []
    expect(rows('network')).toEqual(
      expect.arrayContaining([
        { kind: 'value', label: 'Status', value: 'On' },
        { kind: 'value', label: 'Addresses', value: '192.168.1.20:7337' },
        { kind: 'value', label: 'Home relay', value: 'No connection relay answers yet' },
        { kind: 'value', label: 'Connected now', value: '0 direct · 1 relay' },
      ]),
    )
    expect(rows('devices')).toEqual([
      {
        kind: 'entry',
        label: 'iPhone',
        hint: 'iOS · paired 3 days ago',
        value: 'online · relay',
        tone: 'online',
        button: {
          id: 'revoke:iphone',
          label: 'Revoke…',
          style: 'destructive',
          confirm: 'Revoke iPhone? It has to pair again to reach this computer.',
        },
      },
    ])
    expect(rows('advanced')).toContainEqual({ kind: 'button', id: 'restart', label: 'Restart daemon' })
    const relayed = buildTrayMenu(
      {
        ...base,
        prefs,
        network: { ...network, homeRelay: 'wss://relay.remoteharness.app/v1' },
        windows: true,
      },
      en,
    )
    expect(JSON.stringify(relayed.prefsWindow)).toContain('"value":"relay.remoteharness.app"')
  })
})
