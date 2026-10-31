import type { PermissionRequestInfo, SessionState } from '@remote-harness/protocol'
import { KEEP_AWAKE_MODES, type KeepAwakeMode } from '../../core/config.ts'
import type { Messages } from '../../core/i18n/index.ts'
import type { ConnectionPath } from '../../transport/connection.ts'
import type { UpdateChannel } from './channel.ts'
import type { TrayPopover } from './popover.ts'

/** One entry of the tray menu, rendered as-is by the helper (labels already translated). */
export type TrayItem =
  | { id: string; label: string; enabled?: boolean; checked?: boolean }
  | { type: 'separator' }
  | { type: 'submenu'; label: string; items: TrayItem[] }
  /** A QR code of `text`, drawn by helpers that can (macOS). */
  | { type: 'qr'; text: string }

/** Glyph state in the menu bar: color encodes only the state (the amber dot is the one color). */
export type TrayIcon = 'idle' | 'working' | 'waiting' | 'offline'

export type TrayMenu = {
  type: 'menu'
  tooltip: string
  icon: TrayIcon
  items: TrayItem[]
  /** Full, uncapped session list for the Sessions window; only sent to helpers that support windows. */
  sessions?: TraySession[]
  /** Window chrome for the Sessions window; only sent alongside `sessions` to helpers with windows. */
  sessionsWindow?: TraySessionsWindow
  /** The Preferences window's tabs, already translated; only sent to helpers that support windows. */
  prefsWindow?: TrayPrefsWindow
  /** The popover's cards, already translated; only sent to helpers that support the popover (macOS). */
  popover?: TrayPopover
}

/** A session as the tray shows it (folder already shortened, labels translated by the builder). */
export type TraySession = {
  id: string
  title: string
  folder: string
  profile: string
  state: SessionState
  worktree: boolean
  controllable: boolean
  /** Agent id (`claude`, `codex`…), for the Sessions window; not shown in the menu. */
  agent: string
  /** ISO time of the session's last activity, for the Sessions window; not shown in the menu. */
  updatedAt: string
}

/** One configured profile, for the Preferences window's Profiles tab (name editable). */
export type TrayProfile = {
  id: string
  name: string
  agent: string
  /** The agent's product name (`Claude Code`). */
  agentName: string
  color: string
  /** The profile's config folder, home shortened. */
  folder: string
}

/** A paired device as the tray shows it. */
export type TrayDevice = {
  id: string
  name: string
  platform: string
  /** Epoch ms. */
  pairedAt: number
  lastSeen: number | null
  /** The paths it is connected by right now; empty when offline. */
  paths: ConnectionPath[]
}

/** How devices reach this daemon: the direct path's addresses and the connection relay's home relay. */
export type TrayNetwork = {
  direct: boolean
  addresses: string[]
  relay: boolean
  /** The home relay (`wss://…`), null while none answers or the relay is off. */
  homeRelay: string | null
}

/**
 * One row of a Preferences window section, translated and built the same way as `TrayItem` — the
 * helper only renders by `kind`, it never invents a label or a value.
 */
export type PrefRow =
  | { kind: 'toggle'; id: string; label: string; hint?: string; checked: boolean }
  | { kind: 'text'; id: string; label: string; hint?: string; value: string }
  | { kind: 'value'; label: string; value: string }
  /** A labeled entry with a detail line, a state and an optional action (a paired device). */
  | {
      kind: 'entry'
      label: string
      hint?: string
      value?: string
      tone?: 'online' | 'offline'
      button?: PrefButton
    }
  | { kind: 'picker'; id: string; label: string; options: { id: string; label: string; checked: boolean }[] }
  | ({ kind: 'button' } & PrefButton)
  | { kind: 'qr'; text: string }
  | { kind: 'note'; label: string }

/** A button; a destructive one is confirmed by the helper with `confirm` as the question. */
export type PrefButton = { id: string; label: string; style?: 'destructive'; confirm?: string }

export type PrefSection = { title?: string; rows: PrefRow[] }
export type PrefTab = { id: string; label: string; sections: PrefSection[] }

/** The Preferences window's content, fully translated; the helper only lays it out. */
export type TrayPrefsWindow = { title: string; tabs: PrefTab[] }

/** The Sessions window's chrome, translated; the rows come from `TrayMenu.sessions`. */
export type TraySessionsWindow = {
  title: string
  searchPlaceholder: string
  actions: { focus: string; rename: string; close: string; copyPath: string }
  /** The helper's native rename prompt (a text field is not expressible as a `PrefRow`). */
  renamePrompt: { title: string; confirm: string; cancel: string }
}

/** The oldest pending tool permission, answerable from the menu. */
export type TrayPending = {
  requestId: string
  sessionId: string
  title: string
  profile: string
  /** `Tool · detail`, see `pendingSummary`. */
  summary: string
  /** Agent id of the session, for the popover's badge. */
  agent: string
  /** The profile's color, for the popover's tag. */
  profileColor: string | null
  /** ISO time the request was made (the popover shows how long it has waited). */
  createdAt: string
  /** The daemon suggested a rule: "Always allow" is offered. */
  canAlways: boolean
}

export type TrayMenuState = {
  version: string
  channel: UpdateChannel
  auto: boolean
  available: { version: string | null; downgrade: boolean } | null
  checking: boolean
  updating: boolean
  /** The daemon runs from the installer's checkout (development clones cannot update). */
  canUpdate: boolean
  /** Under a service manager, which brings the daemon back after it exits. */
  canRestart: boolean
  /** Shell sections; absent when only the update items are wanted (tests, headless paths). */
  machine?: string
  /** Start time already formatted (`09:12`). */
  since?: string
  sessions?: TraySession[]
  pending?: TrayPending | null
  /** The paired devices and whether push is on. */
  devices?: { push: boolean; items: TrayDevice[] }
  /** Where devices reach this daemon (status line, popover header, Network tab). */
  network?: TrayNetwork
  /** Locale for relative times (`paired 3 days ago`) and the clock they are relative to. */
  locale?: string
  now?: number
  /** At least one profile exists: "New session…" can launch it. */
  canStart?: boolean
  /** Pairing link and address once the daemon listens for the app; else "Pair a phone…" stays one item. */
  pairing?: { url: string; address: string } | null
  /** The helper draws `qr` items (macOS). */
  qr?: boolean
  /** The Preferences submenu (or, when `windows`, the window); absent opens the config file. */
  prefs?: {
    permissions: boolean
    keepAwake: KeepAwakeMode
    push: boolean
    machineName: string
    showInMenuBar: boolean
    startAtLogin: boolean | null
  }
  /** Under a service manager: Quit also offers to stop the service. */
  canStopService?: boolean
  /** The helper can open the Preferences and Sessions windows (macOS). */
  windows?: boolean
  /** The helper shows the popover instead of the menu (macOS). */
  popover?: boolean
  profiles?: TrayProfile[]
}

/** Ids the daemon handles when the helper reports a click. */
export const TRAY_ACTIONS = {
  check: 'check',
  update: 'update',
  auto: 'auto',
  logs: 'logs',
  restart: 'restart',
  doctor: 'doctor',
  quit: 'quit',
  newSession: 'new',
  pair: 'pair',
  docs: 'docs',
  prefs: 'prefs',
  quitService: 'quit-service',
  prefPermissions: 'pref:permissions',
  prefPush: 'pref:push',
  prefMachineName: 'pref:machine-name',
  prefShowInMenuBar: 'pref:show-in-menu-bar',
  prefStartAtLogin: 'pref:start-at-login',
  seeAll: 'see-all',
} as const
export const CHANNEL_ACTION_PREFIX = 'channel:'
/** `awake:<mode>` sets the keep-awake mode. */
export const KEEP_AWAKE_ACTION_PREFIX = 'awake:'
/** Prefixed ids: `allow:<requestId>`, `always:<requestId>`, `deny:<requestId>`, `focus:<sessionId>`, `close:<sessionId>`, `rename:<sessionId>`. */
export const TRAY_PREFIXES = {
  allow: 'allow:',
  always: 'always:',
  deny: 'deny:',
  focus: 'focus:',
  close: 'close:',
  rename: 'rename:',
  revoke: 'revoke:',
  profileName: 'profile-name:',
} as const
/** Helper-local ids: open the Preferences window on that tab (`prefs:pairing`, `prefs:devices`). */
export const PREFS_TAB_PREFIX = 'prefs:'
/** Live sessions listed before the rest is left to the app, on a helper with no Sessions window. */
export const MAX_TRAY_SESSIONS = 8
/** Same, on a helper that can open the Sessions window for the rest ("See all sessions…"). */
export const MAX_TRAY_SESSIONS_WINDOW = 5
const SUMMARY_MAX = 48

/** `Bash · gh pr create --fill` for the pending item; the detail is cut, never the whole input. */
export function pendingSummary(info: Pick<PermissionRequestInfo, 'tool' | 'input'>): string {
  const { tool, input } = info
  const raw =
    typeof input.command === 'string'
      ? input.command
      : typeof input.file_path === 'string'
        ? input.file_path
        : typeof input.url === 'string'
          ? input.url
          : ''
  const detail = raw.replace(/\s+/g, ' ').trim()
  const short = detail.length > SUMMARY_MAX ? `${detail.slice(0, SUMMARY_MAX - 1)}…` : detail
  return short ? `${tool} · ${short}` : tool
}

/** The glyph state for the menu: waiting beats working beats idle. */
export function trayIcon(s: Pick<TrayMenuState, 'sessions' | 'pending'>): TrayIcon {
  if (s.pending) return 'waiting'
  if (s.sessions?.some((session) => session.state === 'running')) return 'working'
  return 'idle'
}

type TrayStrings = Messages['updates']['tray']

/** How devices reach the computer, for the status line and the popover header; never an address. */
export function pathsLabel(network: TrayNetwork, t: TrayStrings): string {
  const direct = network.direct && network.addresses.length > 0
  const relay = network.relay && network.homeRelay !== null
  if (direct && relay) return t.paths.both
  if (direct) return t.paths.direct
  return relay ? t.paths.relay : t.paths.none
}

/** `online · relay`, `online · direct + relay` or `offline`. */
export function deviceStateLabel(device: Pick<TrayDevice, 'paths'>, t: TrayStrings): string {
  const [first] = device.paths
  if (!first) return t.offline
  return t.online(device.paths.length > 1 ? t.devicePath.both : t.devicePath[first])
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/** `3 days ago` / `yesterday` in `locale`; `just now` under a minute. */
export function relativeTime(at: number, now: number, locale: string, t: TrayStrings): string {
  const seconds = (at - now) / 1000
  const abs = Math.abs(seconds)
  const unit = RELATIVE_UNITS.find(([, size]) => abs >= size)
  if (!unit) return t.justNow
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  return format.format(Math.round(seconds / unit[1]), unit[0])
}

/** `paired 3 days ago`, plus `last seen …` (or `not seen yet`) when the device is offline. */
export function deviceDetail(
  device: TrayDevice,
  s: Pick<TrayMenuState, 'locale' | 'now'>,
  t: TrayStrings,
): string {
  const now = s.now ?? Date.now()
  const locale = s.locale ?? 'en-US'
  const paired = t.pairedAgo(relativeTime(device.pairedAt, now, locale, t))
  if (device.paths.length > 0) return paired
  const seen =
    device.lastSeen === null ? t.neverSeen : t.lastSeen(relativeTime(device.lastSeen, now, locale, t))
  return `${paired} · ${seen}`
}

/** The status line / popover subtitle: `machine name · paths · version · since HH:MM`. */
export function statusLine(s: TrayMenuState, t: TrayStrings): string | null {
  if (!s.machine || !s.since) return null
  return t.status(s.machine, s.version, s.since, s.network ? pathsLabel(s.network, t) : undefined)
}

export function buildTrayMenu(s: TrayMenuState, t: TrayStrings): TrayMenu {
  const separator = { type: 'separator' } as const
  const status = s.updating
    ? t.updating
    : s.available?.version
      ? t.updateAvailable(s.available.version)
      : (statusLine(s, t) ?? t.running(s.version))
  const items: TrayItem[] = [{ id: 'status', label: status, enabled: false }, separator]

  if (s.pending) {
    const p = s.pending
    // "Show permission requests here" off: the request is still shown, answered elsewhere.
    const answerable = s.prefs?.permissions ?? true
    const answers: TrayItem[] = [
      ...(answerable
        ? [
            { id: `${TRAY_PREFIXES.allow}${p.requestId}`, label: t.allow },
            ...(p.canAlways ? [{ id: `${TRAY_PREFIXES.always}${p.requestId}`, label: t.always }] : []),
            { id: `${TRAY_PREFIXES.deny}${p.requestId}`, label: t.deny },
            separator,
          ]
        : []),
      { id: `${TRAY_PREFIXES.focus}${p.sessionId}`, label: t.focus },
    ]
    items.push(
      { id: 'waiting', label: t.waiting, enabled: false },
      { type: 'submenu', label: `${p.title} · ${p.summary}`, items: answers },
      separator,
    )
  }

  if (s.sessions) {
    const live = s.sessions.filter((session) => session.state !== 'ended')
    const ended = s.sessions.filter((session) => session.state === 'ended')
    const running = live.filter((session) => session.state === 'running').length
    const cap = s.windows ? MAX_TRAY_SESSIONS_WINDOW : MAX_TRAY_SESSIONS
    items.push({ id: 'sessions', label: t.sessions(s.sessions.length, running), enabled: false })
    for (const session of live.slice(0, cap)) {
      const meta = [session.folder, session.profile, session.worktree ? t.worktree : null].filter(Boolean)
      items.push({
        type: 'submenu',
        label: `${session.title} · ${t.states[session.state]}`,
        items: [
          { id: `info:${session.id}`, label: meta.join(' · '), enabled: false },
          { id: `${TRAY_PREFIXES.focus}${session.id}`, label: t.focus, enabled: session.controllable },
          { id: `${TRAY_PREFIXES.rename}${session.id}`, label: t.rename },
          { id: `${TRAY_PREFIXES.close}${session.id}`, label: t.close, enabled: session.controllable },
        ],
      })
    }
    if (s.windows && live.length > cap) items.push({ id: TRAY_ACTIONS.seeAll, label: t.seeAllSessions })
    if (ended.length > 0) {
      items.push({
        type: 'submenu',
        label: t.ended(ended.length),
        items: ended.slice(0, cap).map((session) => ({
          id: `info:${session.id}`,
          label: `${session.title} · ${session.folder}`,
          enabled: false,
        })),
      })
    }
    if (s.sessions.length === 0) items.push({ id: 'no-sessions', label: t.noSessions, enabled: false })
    items.push(separator)
  }

  if (s.devices) {
    const devices = s.devices.items
    items.push({ id: 'devices', label: t.devices(devices.length, s.devices.push), enabled: false })
    for (const device of devices) {
      items.push({
        type: 'submenu',
        label: `${device.name} · ${deviceStateLabel(device, t)}`,
        items: [
          { id: `info:device:${device.id}`, label: deviceDetail(device, s, t), enabled: false },
          separator,
          {
            type: 'submenu',
            label: t.revoke,
            items: [{ id: `${TRAY_PREFIXES.revoke}${device.id}`, label: t.revokeConfirm }],
          },
        ],
      })
    }
    if (devices.length === 0) items.push({ id: 'no-devices', label: t.noDevices, enabled: false })
    items.push(separator)
  }

  items.push(
    { id: TRAY_ACTIONS.newSession, label: t.newSession, enabled: s.canStart ?? true },
    pairItem(s, t),
    { id: TRAY_ACTIONS.docs, label: t.docs },
    prefsItem(s, t),
    separator,
  )

  if (s.canUpdate) {
    items.push({
      id: TRAY_ACTIONS.check,
      label: s.checking ? t.checking : t.check,
      enabled: !s.checking && !s.updating,
    })
    if (s.available) {
      const version = s.available.version ?? '?'
      items.push({
        id: TRAY_ACTIONS.update,
        label: s.available.downgrade ? t.installOlder(version) : t.updateNow(version),
        enabled: !s.updating,
      })
    }
    items.push(
      { id: TRAY_ACTIONS.auto, label: t.auto, checked: s.auto },
      {
        type: 'submenu',
        label: t.channel,
        items: (['main', 'development'] as const).map((channel) => ({
          id: `${CHANNEL_ACTION_PREFIX}${channel}`,
          label: t.channels[channel],
          checked: s.channel === channel,
        })),
      },
      separator,
    )
  }
  items.push({ id: TRAY_ACTIONS.logs, label: t.logs })
  if (s.canRestart) items.push({ id: TRAY_ACTIONS.restart, label: t.restart })
  items.push(
    { id: TRAY_ACTIONS.doctor, label: t.doctor },
    separator,
    s.canStopService
      ? {
          type: 'submenu',
          label: t.quitMenu,
          items: [
            { id: TRAY_ACTIONS.quit, label: t.hideIcon },
            { id: TRAY_ACTIONS.quitService, label: t.stopService },
          ],
        }
      : { id: TRAY_ACTIONS.quit, label: t.quit },
  )
  return {
    type: 'menu',
    tooltip: t.tooltip(s.version),
    icon: trayIcon(s),
    items,
    ...(s.windows && s.sessions
      ? {
          sessions: s.sessions,
          sessionsWindow: {
            title: t.sessionsWindowTitle,
            searchPlaceholder: t.searchSessions,
            actions: { focus: t.focus, rename: t.rename, close: t.close, copyPath: t.copyPath },
            renamePrompt: { title: t.renamePromptTitle, confirm: t.renameConfirm, cancel: t.cancel },
          },
        }
      : {}),
    ...(s.windows && s.prefs ? { prefsWindow: buildPrefsWindow(s, t) } : {}),
  }
}

/** The Preferences window's tabs, built from the same state and translated strings as the menu. */
function buildPrefsWindow(s: TrayMenuState, t: TrayStrings): TrayPrefsWindow {
  const prefs = s.prefs as NonNullable<TrayMenuState['prefs']>
  const general: PrefRow[] = [
    { kind: 'text', id: TRAY_ACTIONS.prefMachineName, label: t.prefMachineName, value: prefs.machineName },
    {
      kind: 'toggle',
      id: TRAY_ACTIONS.prefShowInMenuBar,
      label: t.prefShowInMenuBar,
      checked: prefs.showInMenuBar,
    },
    {
      kind: 'toggle',
      id: TRAY_ACTIONS.prefPermissions,
      label: t.prefPermissions,
      checked: prefs.permissions,
    },
    ...(prefs.startAtLogin !== null
      ? ([
          {
            kind: 'toggle',
            id: TRAY_ACTIONS.prefStartAtLogin,
            label: t.prefStartAtLogin,
            checked: prefs.startAtLogin,
          },
        ] as const)
      : []),
    {
      kind: 'picker',
      id: KEEP_AWAKE_ACTION_PREFIX,
      label: t.keepAwake,
      options: KEEP_AWAKE_MODES.map((mode) => ({
        id: `${KEEP_AWAKE_ACTION_PREFIX}${mode}`,
        label: t.keepAwakeModes[mode],
        checked: prefs.keepAwake === mode,
      })),
    },
  ]
  const updates: PrefRow[] = s.canUpdate
    ? [
        {
          kind: 'picker',
          id: CHANNEL_ACTION_PREFIX,
          label: t.channel,
          options: (['main', 'development'] as const).map((channel) => ({
            id: `${CHANNEL_ACTION_PREFIX}${channel}`,
            label: t.channels[channel],
            checked: s.channel === channel,
          })),
        },
        { kind: 'toggle', id: TRAY_ACTIONS.auto, label: t.auto, checked: s.auto },
        { kind: 'button', id: TRAY_ACTIONS.check, label: s.checking ? t.checking : t.check },
      ]
    : [{ kind: 'note', label: t.updatesUnavailable }]
  const notifications: PrefRow[] = [
    {
      kind: 'toggle',
      id: TRAY_ACTIONS.prefPush,
      label: t.prefPush,
      hint: t.prefPushHint,
      checked: prefs.push,
    },
    { kind: 'note', label: t.muteRulesHint },
  ]
  const profiles: PrefSection[] = (s.profiles ?? []).map((p) => ({
    title: p.name,
    rows: [
      { kind: 'text', id: `${TRAY_PREFIXES.profileName}${p.id}`, label: t.profileName, value: p.name },
      { kind: 'value', label: t.profileAgent, value: p.agentName },
      { kind: 'value', label: t.profileFolder, value: p.folder },
    ],
  }))
  const pairing: PrefRow[] = s.pairing
    ? [
        ...(s.qr ? [{ kind: 'qr', text: s.pairing.url } as const] : []),
        { kind: 'value', label: t.pairMenu, value: s.pairing.address },
        { kind: 'note', label: t.pairNote },
        { kind: 'button', id: TRAY_ACTIONS.pair, label: t.pairInTerminal },
      ]
    : [{ kind: 'button', id: TRAY_ACTIONS.pair, label: t.pair }]
  const advanced: PrefRow[] = [
    { kind: 'button', id: TRAY_ACTIONS.prefs, label: t.openConfig },
    { kind: 'button', id: TRAY_ACTIONS.logs, label: t.logs },
    { kind: 'button', id: TRAY_ACTIONS.doctor, label: t.doctor },
    ...(s.canRestart ? [{ kind: 'button', id: TRAY_ACTIONS.restart, label: t.restart } as const] : []),
  ]
  return {
    title: t.prefsWindowTitle,
    tabs: [
      { id: 'general', label: t.tabGeneral, sections: [{ rows: general }] },
      { id: 'profiles', label: t.tabProfiles, sections: profiles },
      { id: 'notifications', label: t.tabNotifications, sections: [{ rows: notifications }] },
      ...(s.network
        ? [{ id: 'network', label: t.tabNetwork, sections: networkSections(s, s.network, t) }]
        : []),
      ...(s.devices ? [{ id: 'devices', label: t.tabDevices, sections: [{ rows: deviceRows(s, t) }] }] : []),
      { id: 'pairing', label: t.tabPairing, sections: [{ rows: pairing }] },
      { id: 'updates', label: t.tabUpdates, sections: [{ rows: updates }] },
      { id: 'advanced', label: t.tabAdvanced, sections: [{ rows: advanced }] },
    ],
  }
}

/** `relay.remoteharness.app` out of `wss://relay.remoteharness.app/…`. */
function relayHost(url: string): string {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}

/** Network tab: the direct path, the connection relay and the devices connected now by path. */
function networkSections(s: TrayMenuState, network: TrayNetwork, t: TrayStrings): PrefSection[] {
  const connected = s.devices?.items ?? []
  const count = (path: ConnectionPath) => connected.filter((d) => d.paths.includes(path)).length
  return [
    {
      title: t.directPath,
      rows: [
        { kind: 'value', label: t.pathState, value: network.direct ? t.on : t.off },
        ...(network.direct
          ? [{ kind: 'value', label: t.directAddresses, value: network.addresses.join(', ') || '—' } as const]
          : []),
        { kind: 'note', label: t.directHint },
      ],
    },
    {
      title: t.connectionRelay,
      rows: [
        { kind: 'value', label: t.pathState, value: network.relay ? t.on : t.off },
        ...(network.relay
          ? [
              {
                kind: 'value',
                label: t.homeRelay,
                value: network.homeRelay ? relayHost(network.homeRelay) : t.noHomeRelay,
              } as const,
            ]
          : []),
        { kind: 'note', label: t.relayHint },
      ],
    },
    {
      title: t.devicesTitle,
      rows: [
        { kind: 'value', label: t.connectedNow, value: t.connectedCounts(count('direct'), count('relay')) },
        { kind: 'note', label: t.networkHint },
      ],
    },
  ]
}

const PLATFORM_NAMES: Record<string, string> = { ios: 'iOS', android: 'Android' }

/** Devices tab: each paired device with its state and a confirmed Revoke…. */
function deviceRows(s: TrayMenuState, t: TrayStrings): PrefRow[] {
  const devices = s.devices?.items ?? []
  if (devices.length === 0) return [{ kind: 'note', label: t.noDevicesHint }]
  return devices.map((device) => ({
    kind: 'entry',
    label: device.name,
    hint: `${PLATFORM_NAMES[device.platform] ?? device.platform} · ${deviceDetail(device, s, t)}`,
    value: deviceStateLabel(device, t),
    tone: device.paths.length > 0 ? 'online' : 'offline',
    button: {
      id: `${TRAY_PREFIXES.revoke}${device.id}`,
      label: t.revoke,
      style: 'destructive',
      confirm: t.revokeConfirmText(device.name),
    },
  }))
}

/** Pair a phone: the QR (macOS, a single-use code), the address and the terminal fallback. */
function pairItem(s: TrayMenuState, t: TrayStrings): TrayItem {
  if (!s.pairing) return { id: TRAY_ACTIONS.pair, label: t.pair }
  return {
    type: 'submenu',
    label: t.pairMenu,
    items: [
      ...(s.qr ? [{ type: 'qr' as const, text: s.pairing.url }] : []),
      { id: 'pair-address', label: s.pairing.address, enabled: false },
      { id: 'pair-note', label: t.pairNote, enabled: false },
      { type: 'separator' },
      { id: TRAY_ACTIONS.pair, label: t.pairInTerminal },
    ],
  }
}

/**
 * Preferences: a helper that can open windows gets a single item opening the Preferences window
 * (built from `prefsWindow`/`profiles` on the outgoing menu); otherwise the submenu of quick
 * toggles, falling back further to opening the config file when there is no shell state at all.
 */
function prefsItem(s: TrayMenuState, t: TrayStrings): TrayItem {
  if (!s.prefs || s.windows) return { id: TRAY_ACTIONS.prefs, label: t.prefs }
  const prefs = s.prefs
  return {
    type: 'submenu',
    label: t.prefsMenu,
    items: [
      { id: TRAY_ACTIONS.prefPermissions, label: t.prefPermissions, checked: prefs.permissions },
      {
        type: 'submenu',
        label: t.keepAwake,
        items: KEEP_AWAKE_MODES.map((mode) => ({
          id: `${KEEP_AWAKE_ACTION_PREFIX}${mode}`,
          label: t.keepAwakeModes[mode],
          checked: prefs.keepAwake === mode,
        })),
      },
      { id: TRAY_ACTIONS.prefPush, label: t.prefPush, checked: prefs.push },
      { type: 'separator' },
      { id: TRAY_ACTIONS.prefs, label: t.openConfig },
    ],
  }
}
