import { LOCALE_NAMES, type Locale } from '@remote-harness/protocol'
import type { Href } from 'expo-router'
import type { ConnectionStatus } from '@/core/connection/daemon-client'
import type { TFunction } from '@/core/i18n/create'
import { AGENT_NAMES, type AgentId } from '@/core/theme/agents'
import type { ColorScheme } from '@/core/theme/palettes'
import { resolveThemeName, type ThemePreference } from '@/core/theme/resolve'
import type { UpdateChannel } from '@/core/updates'
import type { VoiceLanguage } from '@/features/voice/language'
import type { AppIconPreference } from './app-icon'
import { appIconRows } from './app-icon-picker'

export type SettingsSectionKey =
  | 'computer'
  | 'devices'
  | 'appearance'
  | 'profiles'
  | 'sessions'
  | 'notifications'
  | 'permissions'
  | 'voice'
  | 'app'

/** One row of the Settings screen: where it goes and what it says about the section's state. */
export type SettingsSection = { key: SettingsSectionKey; title: string; summary: string; route: Href }

/** What the Settings screen reads from the stores to summarize each section. */
export type SettingsSnapshot = {
  demo: boolean
  computer: { name: string | null; status: ConnectionStatus }
  appearance: { theme: ThemePreference; system: ColorScheme; icon: AppIconPreference }
  /** The agent of each profile. */
  profiles: readonly AgentId[]
  sessions: { openAfterCreate: boolean; returnSends: boolean; templates: number }
  notifications: { push: boolean; live: boolean; muted: number }
  voice: VoiceLanguage
  app: { version: string; channel: UpdateChannel; locale: Locale }
}

const ORDER: readonly SettingsSectionKey[] = [
  'computer',
  'devices',
  'appearance',
  'profiles',
  'sessions',
  'notifications',
  'permissions',
  'voice',
  'app',
]

const ROUTES: Record<SettingsSectionKey, Href> = {
  computer: '/settings/computer',
  devices: '/settings/devices',
  appearance: '/settings/appearance',
  profiles: '/settings/profiles',
  sessions: '/settings/sessions',
  notifications: '/settings/notifications',
  permissions: '/permissions',
  voice: '/settings/voice',
  app: '/settings/app',
}

function join(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part !== '').join(' · ')
}

/** The one line under a section's title: its current state, from the same labels its cards use. */
export function sectionSummary(key: SettingsSectionKey, s: SettingsSnapshot, t: TFunction): string {
  switch (key) {
    case 'computer':
      return join([s.computer.name, t(`connection.status.${s.computer.status}`)])
    case 'devices':
      return t('settings.sections.devicesHint')
    case 'appearance':
      return join([
        t(`settings.themes.${resolveThemeName(s.appearance.theme, s.appearance.system)}`),
        appIconRows(s.appearance.icon, t).find((row) => row.selected)?.label,
      ])
    case 'profiles': {
      const agents = [...new Set(s.profiles)].map((agent) => AGENT_NAMES[agent])
      return join([
        t('settings.summary.profiles', { count: s.profiles.length }),
        agents.length > 0 ? agents.join(', ') : null,
      ])
    }
    case 'sessions':
      return (
        join([
          s.sessions.openAfterCreate ? t('settings.summary.autoOpen') : null,
          s.sessions.templates > 0 ? t('settings.summary.templates', { count: s.sessions.templates }) : null,
          s.sessions.returnSends ? t('settings.summary.returnSends') : null,
        ]) || t('settings.sections.sessionsHint')
      )
    case 'notifications':
      return join([
        t(s.notifications.push ? 'settings.summary.pushOn' : 'settings.summary.pushOff'),
        t(s.notifications.live ? 'settings.summary.liveOn' : 'settings.summary.liveOff'),
        s.notifications.muted > 0 ? t('settings.summary.muted', { count: s.notifications.muted }) : null,
      ])
    case 'permissions':
      return t('settings.permissionsHint')
    case 'voice':
      return s.voice === 'app' ? t('voice.languageApp') : LOCALE_NAMES[s.voice]
    case 'app':
      return join([s.app.version, t(`updates.channels.${s.app.channel}`), LOCALE_NAMES[s.app.locale]])
  }
}

/** The rows of the Settings screen, in order; the demo never pushes, so it has no Notifications row. */
export function settingsSections(s: SettingsSnapshot, t: TFunction): SettingsSection[] {
  return ORDER.filter((key) => !(s.demo && key === 'notifications')).map((key) => ({
    key,
    title: t(`settings.sections.${key}`),
    summary: sectionSummary(key, s, t),
    route: ROUTES[key],
  }))
}
