import type { Messages } from '../../core/i18n/index.ts'
import {
  deviceDetail,
  deviceStateLabel,
  MAX_TRAY_SESSIONS_WINDOW,
  PREFS_TAB_PREFIX,
  statusLine,
  TRAY_ACTIONS,
  TRAY_PREFIXES,
  type TrayMenuState,
} from './menu.ts'

/** Color role of a pill; the helper maps it to its palette. */
export type TrayTone = 'running' | 'waiting' | 'idle' | 'ended' | 'online' | 'offline' | 'accent'
export type TrayPill = { label: string; tone: TrayTone }

/** A clickable line or button of the popover; `items` makes it a menu (Quit under a service manager). */
export type PopoverAction = {
  id: string
  label: string
  /** Secondary text on the right (`main (stable)` next to Check for updates). */
  detail?: string
  enabled?: boolean
  /** `allow`/`deny` color the permission answers. */
  style?: 'allow' | 'deny'
  items?: PopoverAction[]
}

export type PopoverSession = {
  id: string
  /** Agent id, for the badge (`claude`, `codex`…). */
  agent: string
  title: string
  /** `folder · profile · worktree`. */
  detail: string
  pill: TrayPill
  /** What a click does (open in terminal); null when the session has no pane. */
  action: string | null
  /** The row's context menu. */
  menu: PopoverAction[]
}

export type PopoverDevice = { id: string; name: string; platform: string; detail: string; pill: TrayPill }

/** The macOS popover's cards, every string translated: the helper only lays them out. */
export type TrayPopover = {
  header: { title: string; subtitle: string; pill: TrayPill }
  pending: {
    label: string
    /** ISO time of the request; the helper shows the elapsed `m:ss`. */
    createdAt: string
    agent: string
    title: string
    profile: string
    profileColor: string | null
    summary: string
    actions: PopoverAction[]
  } | null
  sessions: {
    label: string
    detail: string
    rows: PopoverSession[]
    /** "See all sessions…", when more are live than listed. */
    more: PopoverAction | null
    /** "3 ended sessions", opening the Sessions window. */
    ended: PopoverAction | null
    empty: string | null
  }
  devices: { label: string; detail: string; rows: PopoverDevice[]; empty: string | null; action: string }
  /** Groups of quick actions, drawn with a divider between groups. */
  actions: PopoverAction[][]
}

type TrayStrings = Messages['updates']['tray']

/** The popover for a helper that reports popover support (macOS); built from the same state as the menu. */
export function buildTrayPopover(s: TrayMenuState, t: TrayStrings): TrayPopover {
  const sessions = s.sessions ?? []
  const live = sessions.filter((session) => session.state !== 'ended')
  const ended = sessions.length - live.length
  const running = live.filter((session) => session.state === 'running').length
  const devices = s.devices?.items ?? []
  const pill: TrayPill = s.updating
    ? { label: t.updating, tone: 'accent' }
    : s.available?.version
      ? { label: t.updateAvailableShort, tone: 'accent' }
      : { label: t.runningPill, tone: 'idle' }
  return {
    header: { title: t.appName, subtitle: statusLine(s, t) ?? t.running(s.version), pill },
    pending: pendingCard(s, t),
    sessions: {
      label: t.sessionsTitle,
      detail: t.sessionsDetail(sessions.length, running),
      rows: live.slice(0, MAX_TRAY_SESSIONS_WINDOW).map((session) => ({
        id: session.id,
        agent: session.agent,
        title: session.title,
        detail: [session.folder, session.profile, session.worktree ? t.worktree : null]
          .filter(Boolean)
          .join(' · '),
        pill: { label: t.states[session.state], tone: session.state },
        action: session.controllable ? `${TRAY_PREFIXES.focus}${session.id}` : null,
        menu: [
          { id: `${TRAY_PREFIXES.focus}${session.id}`, label: t.focus, enabled: session.controllable },
          { id: `${TRAY_PREFIXES.rename}${session.id}`, label: t.rename },
          { id: `${TRAY_PREFIXES.close}${session.id}`, label: t.close, enabled: session.controllable },
        ],
      })),
      more:
        live.length > MAX_TRAY_SESSIONS_WINDOW ? { id: TRAY_ACTIONS.seeAll, label: t.seeAllSessions } : null,
      ended: ended > 0 ? { id: TRAY_ACTIONS.seeAll, label: t.ended(ended) } : null,
      empty: sessions.length === 0 ? t.noSessions : null,
    },
    devices: {
      label: t.devicesTitle,
      detail: s.devices?.push ? t.pushOn : t.pushOff,
      rows: devices.map((device) => ({
        id: device.id,
        name: device.name,
        platform: device.platform,
        detail: deviceDetail(device, s, t),
        pill: {
          label: deviceStateLabel(device, t),
          tone: device.paths.length > 0 ? 'online' : 'offline',
        },
      })),
      empty: devices.length === 0 ? t.noDevicesHint : null,
      action: `${PREFS_TAB_PREFIX}devices`,
    },
    actions: [
      [
        { id: TRAY_ACTIONS.newSession, label: t.newSession, enabled: s.canStart ?? true },
        // Once the daemon listens, the Pairing tab shows the QR; before, the terminal does.
        { id: s.pairing ? `${PREFS_TAB_PREFIX}pairing` : TRAY_ACTIONS.pair, label: t.pair },
        { id: TRAY_ACTIONS.docs, label: t.docs },
      ],
      [{ id: TRAY_ACTIONS.prefs, label: t.prefs }, ...updateAction(s, t), quitAction(s, t)],
    ],
  }
}

/** The oldest pending tool permission as a card: the answers, or only the terminal when answered elsewhere. */
function pendingCard(s: TrayMenuState, t: TrayStrings): TrayPopover['pending'] {
  const p = s.pending
  if (!p) return null
  const answerable = s.prefs?.permissions ?? true
  return {
    label: t.waiting,
    createdAt: p.createdAt,
    agent: p.agent,
    title: p.title,
    profile: p.profile,
    profileColor: p.profileColor,
    summary: p.summary,
    actions: answerable
      ? [
          { id: `${TRAY_PREFIXES.deny}${p.requestId}`, label: t.deny, style: 'deny' },
          ...(p.canAlways ? [{ id: `${TRAY_PREFIXES.always}${p.requestId}`, label: t.always }] : []),
          { id: `${TRAY_PREFIXES.allow}${p.requestId}`, label: t.allow, style: 'allow' },
        ]
      : [{ id: `${TRAY_PREFIXES.focus}${p.sessionId}`, label: t.focus }],
  }
}

/** Updating…, Update now (version) or Check for updates with the channel; nothing in builds that cannot update. */
function updateAction(s: TrayMenuState, t: TrayStrings): PopoverAction[] {
  if (!s.canUpdate) return []
  if (s.updating) return [{ id: TRAY_ACTIONS.update, label: t.updating, enabled: false }]
  if (s.available) {
    const version = s.available.version ?? '?'
    return [
      {
        id: TRAY_ACTIONS.update,
        label: s.available.downgrade ? t.installOlder(version) : t.updateNow(version),
      },
    ]
  }
  return [
    {
      id: TRAY_ACTIONS.check,
      label: s.checking ? t.checking : t.check,
      detail: t.channels[s.channel],
      enabled: !s.checking,
    },
  ]
}

function quitAction(s: TrayMenuState, t: TrayStrings): PopoverAction {
  if (!s.canStopService) return { id: TRAY_ACTIONS.quit, label: t.quit }
  return {
    id: 'quit-menu',
    label: t.quitMenu,
    items: [
      { id: TRAY_ACTIONS.quit, label: t.hideIcon },
      { id: TRAY_ACTIONS.quitService, label: t.stopService },
    ],
  }
}
