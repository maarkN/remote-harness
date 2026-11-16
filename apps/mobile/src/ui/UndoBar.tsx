import { useEffect } from 'react'
import { AccessibilityInfo, Pressable, View } from 'react-native'
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated'
import { makeStyles, radius, space } from '@/core/theme'
import { Text } from './Text'

/** How long the bar offers its action before it goes away on its own. */
export const UNDO_MS = 5_000
const FADE_MS = 200

const entering = FadeInDown.duration(FADE_MS).reduceMotion(ReduceMotion.System)
const exiting = FadeOutDown.duration(FADE_MS).reduceMotion(ReduceMotion.System)

/**
 * A short-lived bar at the bottom of a screen: what just happened and a way back ("Session hidden ·
 * Undo"). It leaves after `UNDO_MS` or once the action is tapped, and is announced to screen
 * readers. Give each occurrence its own `id`: a new one restarts the timer. It sits at the bottom of
 * its host, `inset` points clear of the right edge (a floating button).
 */
export function UndoBar({
  id,
  message,
  actionLabel,
  onAction,
  onDismiss,
  inset,
}: {
  id: string
  message: string
  actionLabel: string
  onAction: () => void
  onDismiss: () => void
  /** Room kept on the right (a floating button), in points. */
  inset?: number
}) {
  const styles = useStyles()
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new occurrence (`id`) restarts the timer.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${message}. ${actionLabel}`)
    const timer = setTimeout(onDismiss, UNDO_MS)
    return () => clearTimeout(timer)
  }, [id])
  return (
    <Animated.View
      key={id}
      entering={entering}
      exiting={exiting}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={[styles.host, inset ? { right: inset } : null]}
    >
      <View style={styles.bar}>
        <Text size="sm" numberOfLines={1} style={styles.message}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          onPress={() => {
            onAction()
            onDismiss()
          }}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text size="sm" weight="bold" color="accentText">
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const useStyles = makeStyles((theme) => ({
  host: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    width: '100%',
    maxWidth: 520,
    minHeight: 48,
    paddingLeft: space.md,
    paddingRight: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceRaised,
  },
  message: { flex: 1 },
  action: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md },
  pressed: { opacity: 0.6 },
}))
