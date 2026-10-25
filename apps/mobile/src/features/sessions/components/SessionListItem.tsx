import type { Profile, Session } from '@remote-harness/protocol'
import {
  Bell,
  BellOff,
  Ellipsis,
  EyeOff,
  type LucideIcon,
  Pin,
  PinOff,
  Power,
  Radio,
  RadioOff,
} from 'lucide-react-native'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NestedSubagents } from '../../subagents/SubagentList'
import { type SessionAction, swipeSides } from '../actions'
import { SessionRow } from './SessionRow'
import { closeOpenRow, type SwipeAction, SwipeableRow, type SwipeTone } from './SwipeableRow'

export type SwipeKey = SessionAction | 'more'

const SWIPE_LOOK: Record<SwipeKey, { icon: LucideIcon; tone: SwipeTone }> = {
  close: { icon: Power, tone: 'danger' },
  hide: { icon: EyeOff, tone: 'muted' },
  more: { icon: Ellipsis, tone: 'muted' },
  mute: { icon: BellOff, tone: 'accent' },
  unmute: { icon: Bell, tone: 'accent' },
  pin: { icon: Pin, tone: 'info' },
  unpin: { icon: PinOff, tone: 'info' },
  // Never on a swipe side; listed so the record stays exhaustive.
  resume: { icon: Power, tone: 'muted' },
  cleanup: { icon: Power, tone: 'muted' },
  copyPath: { icon: Power, tone: 'muted' },
  followLive: { icon: Radio, tone: 'accent' },
  unfollowLive: { icon: RadioOff, tone: 'accent' },
}

type Props = {
  session: Session
  profile: Profile | undefined
  muted: boolean
  pinned: boolean
  following: boolean
  pendingPermissions: number
  sharedCheckout: number
  selected: boolean
  keyboardFocused: boolean
  /** Stable across renders (the list passes the same function to every row). */
  onAction: (session: Session, action: SwipeKey) => void
  /** Stable across renders. */
  onLongPress: (session: Session) => void
}

/**
 * One row of the session list (swipe actions, the row, its nested subagents). Memoized on plain
 * props, so an update of one session re-renders only its own row.
 */
export const SessionListItem = memo(function SessionListItem({
  session,
  profile,
  muted,
  pinned,
  following,
  pendingPermissions,
  sharedCheckout,
  selected,
  keyboardFocused,
  onAction,
  onLongPress,
}: Props) {
  const { t } = useTranslation()
  const { start, end } = useMemo(() => {
    const sides = swipeSides(session, { muted, pinned })
    const action = (key: SwipeKey): SwipeAction => ({
      key,
      label: t(`sessionActions.short.${key}` as const),
      ...SWIPE_LOOK[key],
      onPress: () => onAction(session, key),
    })
    return { start: sides.start.map(action), end: sides.end.map(action) }
  }, [session, muted, pinned, t, onAction])
  const longPress = useMemo(
    () => () => {
      closeOpenRow()
      onLongPress(session)
    },
    [session, onLongPress],
  )
  return (
    <>
      <SwipeableRow start={start} end={end}>
        <SessionRow
          session={session}
          profile={profile}
          muted={muted}
          pinned={pinned}
          following={following}
          pendingPermissions={pendingPermissions}
          sharedCheckout={sharedCheckout}
          selected={selected}
          keyboardFocused={keyboardFocused}
          onLongPress={longPress}
        />
      </SwipeableRow>
      <NestedSubagents sessionId={session.id} subagents={session.subagents} />
    </>
  )
})
