import type { PermissionRequestInfo } from '@remote-harness/protocol'
import { useLayoutEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, Pressable, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  type LayoutAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'
import { selectProfiles, useConnectionStore } from '@/core/connection'
import type { TFunction } from '@/core/i18n/create'
import { makeStyles, radius, space } from '@/core/theme'
import { formatElapsed } from '@/core/utils/time'
import { useNow } from '@/core/utils/use-now'
import { sessionAgent } from '@/features/sessions/agent'
import { openSession } from '@/features/sessions/open-session'
import { useSessionsStore } from '@/features/sessions/store'
import { AgentBadge, Button, ProfileTag, Text } from '@/ui'
import { describePermission } from '../describe'
import { usePermissionsStore } from '../store'
import {
  deckEdges,
  deckFront,
  deckStep,
  pendingForStrip,
  type StripItem,
  type StripModel,
  stripCandidates,
  stripItemKey,
  stripSessionId,
  swipeDelta,
} from '../strip'
import { useRespond } from '../use-respond'
import { AlwaysAllowSheet } from './AlwaysAllowSheet'

/** Each card edge below the front card is this much narrower on both sides than the one above. */
const EDGE_INSET = 10
const COME_FORWARD_MS = 200
const SLIDE_OUT_MS = 140

/** A new front card rises from the edge below it. */
function comeForward(): LayoutAnimation {
  'worklet'
  const timing = { duration: COME_FORWARD_MS }
  return {
    initialValues: { opacity: 0.3, transform: [{ translateY: 10 }, { scale: 0.96 }] },
    animations: {
      opacity: withTiming(1, timing),
      transform: [{ translateY: withTiming(0, timing) }, { scale: withTiming(1, timing) }],
    },
  }
}

/**
 * Pinned above the session list while something waits for the user, with the same Deny / Always /
 * Allow flow as the session screen (questions, plans and waiting sessions without a request get an
 * Open button) and a live elapsed time. One item shows as a single card with the number of sessions
 * waiting; two or more as a deck (#561): the front card (the oldest at first) with one or two card
 * edges below it and an "n/N ›" counter that brings the next one forward, swipes left and right to
 * move through the queue, and the next card coming forward once the front one is answered. The list
 * order below is untouched.
 */
export function WaitingStrip() {
  const pending = usePermissionsStore((s) => s.pending)
  const requestSessionIds = useMemo(
    () => new Set(Object.values(pending).map((request) => request.sessionId)),
    [pending],
  )
  // Only the sessions the strip can show: others working do not re-render it.
  const sessions = useSessionsStore(useShallow((s) => stripCandidates(s.sessions, requestSessionIds)))
  const strip = useMemo(() => pendingForStrip(sessions, Object.values(pending)), [sessions, pending])
  // Mounted only while something waits, so a new queue starts again from the oldest.
  return strip ? <Deck strip={strip} /> : null
}

function Deck({ strip }: { strip: StripModel }) {
  const { t } = useTranslation()
  const styles = useStyles()
  const profiles = useConnectionStore(selectProfiles)
  const now = useNow(1000)
  const { respond, busy, error } = useRespond()
  const [always, setAlways] = useState<PermissionRequestInfo | null>(null)
  const [front, setFront] = useState<{ key: string | null; index: number }>({ key: null, index: 0 })
  const reduceMotion = useReducedMotion()
  const offset = useSharedValue(0)

  const { items } = strip
  const index = deckFront(items, front.key, front.index)
  const item = items[index] ?? items[0]
  const itemKey = stripItemKey(item)
  const deck = items.length > 1
  const total = items.length

  const move = (delta: 1 | -1) => {
    const nextIndex = deckStep(index, delta, total)
    const target = items[nextIndex]
    if (!target) return
    setFront({ key: stripItemKey(target), index: nextIndex })
    AccessibilityInfo.announceForAccessibility(
      t('permissions.strip.moved', { n: nextIndex + 1, total, title: itemTitle(target, t) }),
    )
  }
  // A card that slid out leaves the offset off screen: the new front card starts in place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new front card resets it.
  useLayoutEffect(() => {
    offset.value = 0
  }, [itemKey])

  const swipe = Gesture.Pan()
    .enabled(deck)
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      if (!reduceMotion) offset.value = event.translationX
    })
    .onEnd((event) => {
      const delta = swipeDelta(event.translationX, event.velocityX)
      if (delta === 0) {
        offset.value = reduceMotion ? 0 : withSpring(0)
      } else if (reduceMotion) {
        runOnJS(move)(delta)
      } else {
        offset.value = withTiming(-delta * 480, { duration: SLIDE_OUT_MS }, (finished) => {
          if (finished) runOnJS(move)(delta)
        })
      }
    })
  const follow = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }))

  const session = item.session
  const sessionId = stripSessionId(item)
  const profileId = session?.profileId ?? (item.kind === 'request' ? item.request.profileId : '')
  const profile = profiles.find((p) => p.id === profileId)
  const agent = session ? sessionAgent(session) : null
  const request = item.kind === 'request' ? item.request : null
  const answerable = request !== null && !request.interaction && !request.terminal
  const status = request?.terminal
    ? t('permissions.strip.terminal')
    : request?.interaction?.kind === 'question'
      ? t('permissions.strip.question')
      : request?.interaction?.kind === 'plan'
        ? t('permissions.strip.plan')
        : t('permissions.strip.waiting')
  const detail = request ? describePermission(request, t) : null
  const title = session?.title || t('common.session')

  return (
    <View style={styles.host}>
      <GestureDetector gesture={swipe}>
        <Animated.View style={follow}>
          <Animated.View
            key={itemKey}
            entering={deck && !reduceMotion ? comeForward : undefined}
            style={styles.card}
            accessibilityRole="summary"
          >
            <View style={styles.header}>
              <Text size="xs" weight="bold" color="warning" style={styles.headerText}>
                ⚠ {t('permissions.strip.title').toUpperCase()}
                {deck ? '' : ` · ${strip.sessions}`}
              </Text>
              {deck ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('permissions.strip.position', { n: index + 1, total })}
                  accessibilityHint={t('permissions.strip.nextHint')}
                  hitSlop={8}
                  onPress={() => move(1)}
                  style={({ pressed }) => [styles.counter, pressed && styles.pressed]}
                >
                  <Text size="xs" weight="bold" color="warning">
                    {index + 1}/{total} ›
                  </Text>
                </Pressable>
              ) : null}
              <Text size="xs" color="textMuted">
                {formatElapsed(now - item.since)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={title}
              onPress={() => openSession(sessionId)}
              style={styles.row}
            >
              {agent ? <AgentBadge agent={agent} /> : null}
              <Text weight="medium" numberOfLines={1} style={styles.title}>
                {title}
              </Text>
              <ProfileTag profile={profile ?? { name: profileId, color: '' }} />
            </Pressable>
            {detail && answerable ? (
              <Text size="xs" color="textMuted" numberOfLines={1}>
                {request.tool} · <Text size="xs">{detail.detail}</Text>
              </Text>
            ) : (
              <Text size="xs" color="textMuted" numberOfLines={1}>
                {status}
              </Text>
            )}
            <View style={styles.actions}>
              {answerable ? (
                <>
                  <Button
                    label={t('permissions.deny')}
                    variant="danger"
                    compact
                    flex
                    disabled={busy !== null}
                    onPress={() => void respond(request.requestId, 'deny')}
                  />
                  {request.rules ? (
                    <Button
                      label={t('permissions.always')}
                      compact
                      flex
                      disabled={busy !== null}
                      onPress={() => setAlways(request)}
                    />
                  ) : null}
                  <Button
                    label={t('permissions.allow')}
                    variant="success"
                    compact
                    flex
                    loading={busy === request.requestId}
                    onPress={() => void respond(request.requestId, 'allow')}
                  />
                </>
              ) : (
                <Button
                  label={t('permissions.strip.open')}
                  compact
                  flex
                  onPress={() => openSession(sessionId)}
                />
              )}
            </View>
            {error ? (
              <Text size="xs" color="danger">
                {error}
              </Text>
            ) : null}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      {deck ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: deckEdges(total) }, (_, edge) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: the edges are fixed decoration.
              key={edge}
              style={[
                styles.edge,
                { marginHorizontal: space.lg + EDGE_INSET * (edge + 1) },
                edge > 0 && styles.far,
              ]}
            />
          ))}
        </View>
      ) : null}
      <AlwaysAllowSheet
        request={always}
        cwd={session?.cwd ?? ''}
        profileName={profile?.name ?? profileId}
        onCancel={() => setAlways(null)}
        onConfirm={(rule) => {
          if (always) void respond(always.requestId, 'allow', rule)
          setAlways(null)
        }}
      />
    </View>
  )
}

function itemTitle(item: StripItem, t: TFunction): string {
  return item.session?.title || t('common.session')
}

const useStyles = makeStyles((theme) => ({
  host: { marginBottom: space.sm },
  card: {
    marginHorizontal: space.lg,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: space.sm,
    borderRadius: radius.lg + 2,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.surface,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerText: { flex: 1, letterSpacing: 0.8 },
  counter: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningSoft,
  },
  pressed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm },
  edge: {
    height: 5,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: theme.colors.warning,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    backgroundColor: theme.colors.surface,
  },
  far: { opacity: 0.55 },
}))
