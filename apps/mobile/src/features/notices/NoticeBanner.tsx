import { CircleCheck, ClipboardList, MessageCircleQuestionMark, ShieldAlert, X } from 'lucide-react-native'
import type { ComponentType } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { makeStyles, radius, space, useTheme } from '@/core/theme'
import { IconButton, Text } from '@/ui'
import { openSession } from '../sessions/open-session'
import type { NoticeKind } from './select'
import { useNoticesStore } from './store'

/** How long a notice stays before it goes away on its own. */
export const NOTICE_MS = 6_000
const SLIDE_MS = 220

const ICONS: Record<NoticeKind, ComponentType<{ size?: number; color?: string }>> = {
  finished: CircleCheck,
  permission: ShieldAlert,
  question: MessageCircleQuestionMark,
  plan: ClipboardList,
}

const entering = FadeInUp.duration(SLIDE_MS).reduceMotion(ReduceMotion.System)
const exiting = FadeOutUp.duration(SLIDE_MS).reduceMotion(ReduceMotion.System)

/**
 * The in-app notice (#472): a banner at the top over the detail pane with what happened in another
 * session and that session's title. Tap opens the session; it leaves after `NOTICE_MS` or with
 * Dismiss. Mounted once in the main layout; `useNotices` decides what it shows.
 */
export function NoticeBanner() {
  const notice = useNoticesStore((s) => s.current)
  const dismiss = useNoticesStore((s) => s.dismiss)
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => dismiss(notice.id), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice, dismiss])

  if (!notice) return null
  const Icon = ICONS[notice.kind]
  const color = notice.kind === 'finished' ? colors.success : colors.warning
  const what = t(`notices.${notice.kind}`)
  const open = () => {
    dismiss(notice.id)
    openSession(notice.sessionId)
  }
  return (
    <Animated.View
      key={notice.id}
      entering={entering}
      exiting={exiting}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={[styles.host, { top: insets.top + space.sm }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${what} · ${notice.session}`}
        accessibilityHint={t('notices.openHint')}
        onPress={open}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <Icon size={18} color={color} />
        <View style={styles.text}>
          <Text size="sm" weight="medium" numberOfLines={1}>
            {what}
          </Text>
          <Text size="xs" color="textMuted" numberOfLines={1}>
            {notice.session}
          </Text>
        </View>
        <IconButton icon={X} label={t('notices.dismiss')} onPress={() => dismiss(notice.id)} />
      </Pressable>
    </Animated.View>
  )
}

const useStyles = makeStyles((theme) => ({
  host: { position: 'absolute', left: space.md, right: space.md, alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
    maxWidth: 520,
    paddingVertical: space.sm,
    paddingLeft: space.md,
    paddingRight: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceRaised,
  },
  pressed: { opacity: 0.85 },
  text: { flex: 1 },
}))
