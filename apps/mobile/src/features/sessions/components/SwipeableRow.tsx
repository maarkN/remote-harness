import * as Haptics from 'expo-haptics'
import type { LucideIcon } from 'lucide-react-native'
import { type ReactNode, useRef } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { type ColorName, radius, space, useTheme } from '@/core/theme'
import { Text } from '@/ui'
import {
  ACTION_WIDTH,
  armedSide,
  fullSwipeDistance,
  IDLE_SWIPE,
  panelWidth,
  releaseSwipe,
  type SwipeSide,
  type SwipeTracker,
  startSwipe,
  stretchedWidth,
  trackArm,
} from '../swipe'

export type SwipeTone = 'danger' | 'accent' | 'info' | 'muted'

export type SwipeAction = {
  key: string
  label: string
  icon: LucideIcon
  tone: SwipeTone
  onPress: () => void
}

/** The revealed panel keeps the row's outer margin, so it reads as a card behind the row. */
const PANEL_MARGIN = space.lg

const TONES: Record<SwipeTone, { bg: ColorName; fg: ColorName }> = {
  danger: { bg: 'dangerSoft', fg: 'danger' },
  accent: { bg: 'accentSoft', fg: 'accentText' },
  info: { bg: 'infoSoft', fg: 'info' },
  muted: { bg: 'surfaceRaised', fg: 'text' },
}

/** Only one row stays open at a time. */
let openRow: SwipeableMethods | null = null

export function closeOpenRow(): void {
  openRow?.close()
  openRow = null
}

/**
 * Swipe actions around a session row. `start` actions show when swiping right (left edge) and the
 * first one fires on a full swipe; `end` actions show when swiping left (right edge) and the last
 * one fires. A short swipe only reveals the buttons: the full swipe arms once the drag passes half
 * the row (with a haptic tick, the outermost action stretching) and fires when the finger is lifted
 * there, never from the spring that opens or closes the row (#559).
 */
export function SwipeableRow({
  start,
  end,
  children,
}: {
  start: SwipeAction[]
  end: SwipeAction[]
  children: ReactNode
}) {
  const ref = useRef<SwipeableMethods>(null)
  const tracker = useRef<SwipeTracker>(IDLE_SWIPE)
  const rowWidth = useSharedValue(0)
  const startDrag = () => {
    tracker.current = startSwipe()
  }
  const arm = (side: SwipeSide, on: boolean) => {
    const next = trackArm(tracker.current, side, on)
    if (next === tracker.current) return
    tracker.current = next
    void (on ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) : Haptics.selectionAsync())
  }
  // Both callbacks come from the gesture's release (or a programmatic open / close, ignored here).
  const release = () => {
    const { fire, next } = releaseSwipe(tracker.current)
    tracker.current = next
    const action = fire === 'start' ? start[0] : fire === 'end' ? end[end.length - 1] : undefined
    if (action) run(action)
  }
  const run = (action: SwipeAction) => {
    ref.current?.close()
    action.onPress()
  }
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1}
      overshootLeft
      overshootRight
      leftThreshold={40}
      rightThreshold={40}
      onSwipeableOpenStartDrag={startDrag}
      onSwipeableCloseStartDrag={startDrag}
      onSwipeableWillOpen={() => {
        if (openRow && openRow !== ref.current) openRow.close()
        openRow = ref.current
        release()
      }}
      onSwipeableWillClose={release}
      onSwipeableClose={() => {
        if (openRow === ref.current) openRow = null
      }}
      renderLeftActions={(_progress, drag) => (
        <Actions actions={start} drag={drag} rowWidth={rowWidth} side="start" onArm={arm} onRun={run} />
      )}
      renderRightActions={(_progress, drag) => (
        <Actions actions={end} drag={drag} rowWidth={rowWidth} side="end" onArm={arm} onRun={run} />
      )}
    >
      <View
        onLayout={(event) => {
          rowWidth.value = event.nativeEvent.layout.width
        }}
      >
        {children}
      </View>
    </ReanimatedSwipeable>
  )
}

function Actions({
  actions,
  drag,
  rowWidth,
  side,
  onArm,
  onRun,
}: {
  actions: SwipeAction[]
  drag: SharedValue<number>
  rowWidth: SharedValue<number>
  side: SwipeSide
  onArm: (side: SwipeSide, on: boolean) => void
  onRun: (action: SwipeAction) => void
}) {
  const { colors } = useTheme()
  const count = actions.length
  const panel = panelWidth(count, PANEL_MARGIN)
  // The outermost action is the one a full swipe runs: it takes the room past the panel.
  const outermost = side === 'start' ? 0 : count - 1
  useAnimatedReaction(
    () => armedSide(drag.value, fullSwipeDistance(rowWidth.value, panel)) === side,
    (on, previous) => {
      if (previous !== null && on !== previous) runOnJS(onArm)(side, on)
    },
  )
  const stretch = useAnimatedStyle(() => ({
    width: stretchedWidth(drag.value, side, count, PANEL_MARGIN),
  }))
  return (
    <Animated.View style={[styles.actions, side === 'start' ? styles.startSide : styles.endSide, stretch]}>
      {actions.map((action, index) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => onRun(action)}
          style={[
            index === outermost ? styles.outermost : styles.action,
            { backgroundColor: colors[TONES[action.tone].bg] },
          ]}
        >
          <action.icon size={18} color={colors[TONES[action.tone].fg]} />
          <Text size="xs" weight="medium" color={TONES[action.tone].fg} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Same outer margins as the row, so the revealed actions read as a card behind it.
  actions: { flexDirection: 'row', marginBottom: space.sm, borderRadius: radius.lg + 2, overflow: 'hidden' },
  startSide: { marginLeft: PANEL_MARGIN },
  endSide: { marginRight: PANEL_MARGIN },
  action: { width: ACTION_WIDTH, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  outermost: {
    flexGrow: 1,
    minWidth: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
})
