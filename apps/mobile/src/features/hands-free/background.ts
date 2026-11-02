import type { MuteState, Session } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'
import type { HandsFreeBackgroundTexts } from '../../../modules/hands-free-background'
import { isMutedSession } from '../live-status/logic'

/** In the background, hands-free turns itself off after this long without anything read, heard or changed. */
export const IDLE_TIMEOUT_MS = 30 * 60_000

/** When hands-free in the background turns itself off, given the last activity. */
export function idleDeadline(lastActivityAt: number): number {
  return lastActivityAt + IDLE_TIMEOUT_MS
}

/**
 * Whether an item of `session` is read aloud: always in the foreground (the user turned the mode on
 * for it); in the background only when neither the session nor its profile is muted, like a push.
 */
export function announces(
  session: Pick<Session, 'id' | 'profileId'>,
  muted: MuteState,
  foreground: boolean,
): boolean {
  return foreground || !isMutedSession(session, muted)
}

/** Texts of the lock-screen card (iOS) or the notification (Android) shown while hands-free is on. */
export function backgroundTexts(
  session: Pick<Session, 'id' | 'title'>,
  t: TFunction,
): HandsFreeBackgroundTexts {
  return {
    title: t('handsFree.background.title'),
    subtitle: session.title || t('common.session'),
    stop: t('handsFree.background.stop'),
    channel: t('handsFree.background.channel'),
    link: `remoteharness://session/${session.id}`,
  }
}

/** What is spoken when the idle timeout turns hands-free off. */
export function idleOffSentence(t: TFunction): string {
  return t('handsFree.idleOff', { minutes: IDLE_TIMEOUT_MS / 60_000 })
}

/**
 * What `app.visibility` reports to the computer: with hands-free on the app counts as the
 * foreground even with the screen locked, since it reads the events aloud and a push would repeat them.
 */
export function reportedForeground(appState: string, handsFreeOn: boolean): boolean {
  return appState === 'active' || handsFreeOn
}
