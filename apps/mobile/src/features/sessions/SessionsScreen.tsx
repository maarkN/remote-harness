import type { Session } from '@remote-harness/protocol'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { Settings, SlidersHorizontal } from 'lucide-react-native'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, type LayoutChangeEvent, RefreshControl, ScrollView, TextInput, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { selectProfiles, useConnectionStore, useDaemonClient } from '@/core/connection'
import { errorMessage } from '@/core/connection/error-message'
import { keys, useKeyCommand } from '@/core/keyboard/key-commands'
import { useWidthClass } from '@/core/layout'
import { makeStyles, space, useTheme } from '@/core/theme'
import { useDebounced } from '@/core/utils/use-debounced'
import { useStableCallback } from '@/core/utils/use-stable-callback'
import {
  Button,
  ConnectionBanner,
  DaemonUpdateBanner,
  EmptyState,
  IconButton,
  Mark,
  Screen,
  Text,
} from '@/ui'
import { useLiveFollowStore } from '../live-status/follow-store'
import { useLiveStatusSettings } from '../live-status/settings-store'
import { followSession, unfollowSession } from '../live-status/use-live-follow'
import { setMuted, useMuteStore } from '../mute/store'
import { WaitingStrip } from '../permissions/components/WaitingStrip'
import { sessionActions } from './actions'
import { sharedCheckoutCounts } from './checkout'
import { COMPACT_MARK_SIZE, MARK_GLYPH_SIZE, type MarkTransform, markTransform, slotIn } from './collapse'
import { CloseSessionSheet } from './components/CloseSessionSheet'
import { MachineLine } from './components/MachineLine'
import { NEW_SESSION_FAB_SPACE, NewSessionFab } from './components/NewSessionFab'
import { SessionActionsSheet } from './components/SessionActionsSheet'
import { SessionFilterChips } from './components/SessionFilterChips'
import { SessionFiltersSheet } from './components/SessionFiltersSheet'
import { SessionListItem, type SwipeKey } from './components/SessionListItem'
import { SessionSearch } from './components/SessionSearch'
import { closeOpenRow } from './components/SwipeableRow'
import { UnreachableEmptyState } from './components/UnreachableEmptyState'
import { UnreachableNotice } from './components/UnreachableNotice'
import { isFiltering, listSessions, NO_FILTER, type SessionFilter, type StateFilter } from './filter'
import { moveCursor } from './keyboard-nav'
import { openSession } from './open-session'
import { setHidden, setPinned, useSessionPrefsStore } from './prefs-store'
import { setSessionSort, useSessionSortStore } from './sort-store'
import { refreshSessions, useSessionsStore } from './store'
import { unreachableView } from './unreachable'

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as unknown as typeof FlashList

/** Natural heights before the real ones are measured (`onLayout`); avoids a flash on first mount. */
const HEADER_HEIGHT_FALLBACK = 176
const COMPACT_BAR_HEIGHT_FALLBACK = 56
/** Scroll delta (px) past which a direction counts as a deliberate up/down, not jitter. */
const SCROLL_DIRECTION_THRESHOLD = 2
const NO_TRANSFORM: MarkTransform = { translateX: 0, translateY: 0, scale: 1 }

type Props = {
  pendingBySession?: Record<string, number>
  selectedSessionId?: string | null
  /** Arrow keys + Enter navigate the list: only while it is on screen (master pane, or the phone's visible list). */
  interactive?: boolean
  /** Compact width only: floating action button over the list instead of the header's icon. */
  fab?: boolean
}

/** The search applies once typing pauses this long, so a long list is not filtered on every key. */
const SEARCH_DEBOUNCE_MS = 150
const NO_PENDING: Record<string, number> = {}

export function SessionsScreen({
  pendingBySession = NO_PENDING,
  selectedSessionId = null,
  interactive = false,
  fab = false,
}: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const client = useDaemonClient()
  const profiles = useConnectionStore(selectProfiles)
  const sessions = useSessionsStore((s) => s.sessions)
  const loaded = useSessionsStore((s) => s.loaded)
  const refreshing = useSessionsStore((s) => s.refreshing)
  const lastFetchedAt = useSessionsStore((s) => s.lastFetchedAt)
  const connectionStatus = useConnectionStore((s) => s.status)
  const unreachable = useConnectionStore((s) => s.unreachable)
  const unreachableState = unreachableView(connectionStatus, unreachable, Object.keys(sessions).length > 0)
  const mutedSessions = useMuteStore((s) => s.sessions)
  const mutedProfiles = useMuteStore((s) => s.profiles)
  const pinned = useSessionPrefsStore((s) => s.pinned)
  const hidden = useSessionPrefsStore((s) => s.hidden)
  const prefs = useMemo(() => ({ pinned, hidden }), [pinned, hidden])
  const [filter, setFilter] = useState<SessionFilter>(NO_FILTER)
  // What the search field shows; the filter takes it once typing pauses.
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS)
  const [keyboardCursor, setKeyboardCursor] = useState<string | null>(null)
  const [actionsFor, setActionsFor] = useState<Session | null>(null)
  const [closing, setClosing] = useState<{ session: Session; mode: 'close' | 'cleanup' } | null>(null)
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false)
  const listRef = useRef<FlashListRef<Session>>(null)

  // A new filter is a new list: start from the top.
  const changeFilter = (patch: Partial<SessionFilter>) => {
    if (patch.query !== undefined) setQuery(patch.query)
    setFilter((current) => ({ ...current, ...patch }))
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: applies the paused search only; `changeFilter` reads the latest state.
  useEffect(() => {
    if (debouncedQuery !== filter.query) changeFilter({ query: debouncedQuery })
  }, [debouncedQuery])
  const toggleState = (state: Exclude<StateFilter, 'all'>) =>
    changeFilter({ state: filter.state === state ? 'all' : state })
  const changeSort = () => {
    void setSessionSort(sort === 'recent' ? 'state' : 'recent')
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }

  // Collapsing header (compact width only): the title row, machine line, chips and search give way,
  // on scroll down, to a slim bar with the mark, the search field, a filters button and settings;
  // scrolling up, or reaching the top, restores it. One mark slides between the two layouts.
  const widthClass = useWidthClass()
  const collapsible = widthClass === 'compact'
  const reducedMotion = useReducedMotion()
  const collapsed = useSharedValue(0)
  const lastScrollY = useSharedValue(0)
  const fullHeaderHeight = useSharedValue(HEADER_HEIGHT_FALLBACK)
  const compactBarHeight = useSharedValue(COMPACT_BAR_HEIGHT_FALLBACK)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const onFullHeaderLayout = (event: LayoutChangeEvent) => {
    fullHeaderHeight.value = event.nativeEvent.layout.height
  }
  const onCompactBarLayout = (event: LayoutChangeEvent) => {
    compactBarHeight.value = event.nativeEvent.layout.height
  }
  const expandedMark = useSharedValue(NO_TRANSFORM)
  const compactMark = useSharedValue(NO_TRANSFORM)
  // Hidden until both slots are measured, so it never flashes at the origin.
  const markReady = useSharedValue(0)
  const measuredSlots = useRef({ expanded: false, compact: false })
  // The title row and the compact bar both sit at the top of the header: their own origin is (0, 0).
  // In the title row the slot is the first child of the centered title group, measured instead.
  const onMarkSlot = (which: 'expanded' | 'compact') => (event: LayoutChangeEvent) => {
    const size = which === 'expanded' ? MARK_GLYPH_SIZE : COMPACT_MARK_SIZE
    const transform = markTransform(slotIn({ x: 0, y: 0 }, event.nativeEvent.layout, size))
    if (which === 'expanded') expandedMark.value = transform
    else compactMark.value = transform
    measuredSlots.current[which] = true
    if (measuredSlots.current.expanded && measuredSlots.current.compact) markReady.value = 1
  }

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!collapsible) return
      const y = Math.max(0, event.contentOffset.y)
      const dy = y - lastScrollY.value
      const next =
        y <= 0 || dy < -SCROLL_DIRECTION_THRESHOLD ? 0 : dy > SCROLL_DIRECTION_THRESHOLD ? 1 : collapsed.value
      lastScrollY.value = y
      if (next !== collapsed.value) {
        collapsed.value = reducedMotion ? next : withTiming(next, { duration: 220 })
        runOnJS(setHeaderCollapsed)(next === 1)
      }
    },
  })
  const containerStyle = useAnimatedStyle(() => ({
    height: collapsible
      ? interpolate(
          collapsed.value,
          [0, 1],
          [fullHeaderHeight.value, compactBarHeight.value],
          Extrapolation.CLAMP,
        )
      : fullHeaderHeight.value,
  }))
  const fullHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapsed.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }))
  const compactBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapsed.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }))
  const markStyle = useAnimatedStyle(() => {
    const from = expandedMark.value
    const to = compactMark.value
    const at = (a: number, b: number) => interpolate(collapsed.value, [0, 1], [a, b], Extrapolation.CLAMP)
    return {
      opacity: markReady.value,
      transform: [
        { translateX: at(from.translateX, to.translateX) },
        { translateY: at(from.translateY, to.translateY) },
        { scale: at(from.scale, to.scale) },
      ],
    }
  })
  const settingsButton = (
    <IconButton icon={Settings} label={t('nav.settings')} onPress={() => router.push('/settings')} />
  )

  const sort = useSessionSortStore((s) => s.sort)
  const items = useMemo(
    () => listSessions(Object.values(sessions), filter, sort, prefs),
    [sessions, filter, sort, prefs],
  )
  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const sharedCheckout = useMemo(() => sharedCheckoutCounts(Object.values(sessions)), [sessions])
  const sessionIds = useMemo(() => items.map((session) => session.id), [items])
  const sessionIdsRef = useRef(sessionIds)
  const keyboardCursorRef = useRef(keyboardCursor)
  useLayoutEffect(() => {
    sessionIdsRef.current = sessionIds
    keyboardCursorRef.current = keyboardCursor
  })

  const moveKeyboardCursor = (delta: 1 | -1) => {
    if (TextInput.State.currentlyFocusedInput()) return false
    const next = moveCursor(sessionIdsRef.current, keyboardCursorRef.current, delta)
    setKeyboardCursor(next)
    // Keep the ring in view; the row may be far from the visible part of a long list.
    const index = next ? sessionIdsRef.current.indexOf(next) : -1
    if (index !== -1) listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true })
  }
  useKeyCommand({ input: keys.keyInputDownArrow }, () => moveKeyboardCursor(1), interactive)
  useKeyCommand({ input: keys.keyInputUpArrow }, () => moveKeyboardCursor(-1), interactive)
  useKeyCommand(
    { input: keys.keyInputEnter },
    () => {
      if (TextInput.State.currentlyFocusedInput()) return false
      const id = keyboardCursorRef.current
      if (id) openSession(id)
    },
    interactive,
  )

  const onRefresh = () => {
    if (client) void refreshSessions(client).catch(() => undefined)
  }

  const isMuted = (session: Session) =>
    mutedSessions.includes(session.id) || mutedProfiles.includes(session.profileId)
  const isPinned = (session: Session) => pinned.includes(session.id)
  // Follow needs a daemon that can follow, the live status on and a session that has not ended.
  const followSupported = useLiveFollowStore((s) => s.supported)
  const followed = useLiveFollowStore((s) => s.sessionIds)
  const liveEnabled = useLiveStatusSettings((s) => s.enabled)
  const liveFollow = (session: Session) =>
    followSupported && liveEnabled && session.state !== 'ended' ? followed.includes(session.id) : null
  const fail = (error: unknown) => Alert.alert(t('sessionActions.failed'), errorMessage(error, t))

  const act = useStableCallback((session: Session, action: SwipeKey) => {
    setActionsFor(action === 'more' ? session : null)
    switch (action) {
      case 'close':
        setClosing({ session, mode: 'close' })
        break
      case 'cleanup':
        setClosing({ session, mode: 'cleanup' })
        break
      case 'resume':
        if (!client) return
        client
          .request({ type: 'session.resume', profileId: session.profileId, sessionId: session.id })
          .then(() => openSession(session.id), fail)
        break
      case 'mute':
      case 'unmute':
        if (client) setMuted(client, 'session', session.id, action === 'mute').catch(fail)
        break
      case 'pin':
      case 'unpin':
        void setPinned(session.id, action === 'pin')
        break
      case 'hide':
        void setHidden(session.id, true)
        break
      case 'copyPath':
        void Clipboard.setStringAsync(session.cwd)
        break
      case 'followLive':
        followSession(session.id).catch(fail)
        break
      case 'unfollowLive':
        unfollowSession(session.id).catch(fail)
        break
      case 'more':
        break
    }
  })
  const openActions = useStableCallback((session: Session) => setActionsFor(session))

  // Rows re-render only when their own props change (`SessionListItem` is memoized); the list as a
  // whole re-renders its visible rows when one of these inputs changes.
  const renderItem = useCallback(
    ({ item: session }: { item: Session }) => {
      const following =
        followSupported && liveEnabled && session.state !== 'ended' && followed.includes(session.id)
      return (
        <SessionListItem
          session={session}
          profile={profilesById.get(session.profileId)}
          muted={mutedSessions.includes(session.id) || mutedProfiles.includes(session.profileId)}
          pinned={pinned.includes(session.id)}
          following={following}
          pendingPermissions={pendingBySession[session.id] ?? 0}
          sharedCheckout={sharedCheckout[session.id] ?? 0}
          selected={session.id === selectedSessionId}
          keyboardFocused={session.id === keyboardCursor}
          onAction={act}
          onLongPress={openActions}
        />
      )
    },
    [
      act,
      openActions,
      followSupported,
      liveEnabled,
      followed,
      profilesById,
      mutedSessions,
      mutedProfiles,
      pinned,
      pendingBySession,
      sharedCheckout,
      selectedSessionId,
      keyboardCursor,
    ],
  )
  const extraData = useMemo(
    () => [mutedSessions, mutedProfiles, pinned, followed],
    [mutedSessions, mutedProfiles, pinned, followed],
  )

  return (
    // On compact width the list draws its own title row (the stack header is hidden): it keeps the top inset.
    <Screen edges={collapsible ? ['top', 'bottom'] : ['bottom']}>
      <ConnectionBanner />
      <DaemonUpdateBanner />
      <Animated.View style={[collapsible && styles.headerContainer, collapsible && containerStyle]}>
        <Animated.View
          style={[collapsible && styles.headerLayer, collapsible && fullHeaderStyle]}
          onLayout={onFullHeaderLayout}
          pointerEvents={collapsible && headerCollapsed ? 'none' : 'auto'}
        >
          {collapsible ? (
            <View style={styles.titleRow}>
              <View
                style={styles.titleGroup}
                onLayout={onMarkSlot('expanded')}
                accessible
                accessibilityRole="header"
                accessibilityLabel={t('sessions.title')}
              >
                <View style={styles.expandedMarkSlot} />
                <Text weight="bold" size="lg" numberOfLines={1}>
                  {t('sessions.title')}
                </Text>
              </View>
              <View style={styles.titleActions}>{settingsButton}</View>
            </View>
          ) : null}
          <MachineLine sessions={items} stateFilter={filter.state} onToggleState={toggleState} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.filterBar}
            contentContainerStyle={styles.filters}
          >
            <SessionFilterChips
              profiles={profiles}
              filter={filter}
              sort={sort}
              onChangeFilter={changeFilter}
              onToggleState={toggleState}
              onChangeSort={changeSort}
            />
          </ScrollView>
          <SessionSearch value={query} onChange={setQuery} focusable={!collapsible || !headerCollapsed} />
        </Animated.View>
        {collapsible ? (
          <Animated.View
            style={[styles.headerLayer, styles.compactBar, compactBarStyle]}
            onLayout={onCompactBarLayout}
            pointerEvents={headerCollapsed ? 'auto' : 'none'}
          >
            <View style={styles.compactMarkSlot} onLayout={onMarkSlot('compact')} />
            <View style={styles.compactSearch}>
              <SessionSearch value={query} onChange={setQuery} focusable={headerCollapsed} />
            </View>
            <View>
              <IconButton
                icon={SlidersHorizontal}
                label={t('sessions.filters')}
                onPress={() => setFiltersSheetOpen(true)}
              />
              {isFiltering(filter) ? <View style={styles.filterDot} /> : null}
            </View>
            {settingsButton}
          </Animated.View>
        ) : null}
        {collapsible ? (
          <Animated.View
            style={[styles.slidingMark, markStyle]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Mark size={MARK_GLYPH_SIZE} />
          </Animated.View>
        ) : null}
      </Animated.View>
      <View style={styles.strip}>
        <WaitingStrip />
      </View>
      {unreachableState === 'compact' && lastFetchedAt ? (
        <UnreachableNotice lastFetchedAt={lastFetchedAt} />
      ) : null}
      <AnimatedFlashList<Session>
        ref={listRef}
        data={items}
        extraData={extraData}
        // On by default in FlashList 2: when a filter brings other sessions back, it kept the list
        // anchored to the last rows, with the rest above the viewport.
        maintainVisibleContentPosition={{ disabled: true }}
        keyExtractor={(session) => session.id}
        onScrollBeginDrag={closeOpenRow}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          unreachableState === 'full' ? (
            <UnreachableEmptyState />
          ) : loaded && isFiltering(filter) && Object.keys(sessions).length > 0 ? (
            <EmptyState title={t('sessions.noMatch')}>
              <Button label={t('sessions.clearFilters')} onPress={() => changeFilter(NO_FILTER)} />
            </EmptyState>
          ) : loaded ? (
            <EmptyState title={t('sessions.emptyTitle')}>
              <Text color="textMuted">{t('sessions.emptyBody')}</Text>
              <View style={styles.code}>
                {(profiles.length > 0 ? profiles.map((p) => p.id) : ['claudin']).map((alias) => (
                  <Text key={alias} color="accentText">
                    $ {alias}
                  </Text>
                ))}
              </View>
              <Text size="sm" color="textDim">
                {t('sessions.emptyHint')}
              </Text>
            </EmptyState>
          ) : null
        }
        contentContainerStyle={fab ? styles.listWithFab : styles.list}
      />
      <SessionActionsSheet
        session={actionsFor}
        profile={actionsFor ? profilesById.get(actionsFor.profileId) : undefined}
        items={
          actionsFor
            ? sessionActions(
                actionsFor,
                {
                  muted: isMuted(actionsFor),
                  pinned: isPinned(actionsFor),
                  liveFollow: liveFollow(actionsFor),
                },
                t,
              )
            : []
        }
        onSelect={(action) => {
          if (actionsFor) act(actionsFor, action)
        }}
        onClose={() => setActionsFor(null)}
      />
      {closing ? (
        <CloseSessionSheet session={closing.session} mode={closing.mode} onDone={() => setClosing(null)} />
      ) : null}
      {fab ? <NewSessionFab /> : null}
      <SessionFiltersSheet
        visible={filtersSheetOpen}
        profiles={profiles}
        filter={filter}
        sort={sort}
        onChangeFilter={changeFilter}
        onToggleState={toggleState}
        onChangeSort={changeSort}
        onClose={() => setFiltersSheetOpen(false)}
      />
    </Screen>
  )
}

const useStyles = makeStyles((theme) => ({
  // A horizontal ScrollView grows to fill a column parent; keep it at the height of the chips.
  filterBar: { flexGrow: 0 },
  filters: { gap: space.xs, paddingHorizontal: space.lg, paddingBottom: space.sm, alignItems: 'center' },
  // Clips the two layers below to the animated height; on regular width this gets no special style.
  headerContainer: { overflow: 'hidden' },
  // Stacked on top of each other so the crossfade doesn't shift layout; unused on regular width.
  headerLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
  compactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  compactSearch: { flex: 1 },
  // The navigation bar's height; the title is centered as the native iOS title was.
  titleRow: { height: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.lg },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titleActions: { position: 'absolute', right: space.sm, top: 0, bottom: 0, justifyContent: 'center' },
  expandedMarkSlot: { width: MARK_GLYPH_SIZE, height: MARK_GLYPH_SIZE },
  compactMarkSlot: { width: COMPACT_MARK_SIZE, height: COMPACT_MARK_SIZE },
  slidingMark: { position: 'absolute', left: 0, top: 0 },
  filterDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  strip: { paddingTop: space.sm },
  list: { paddingTop: space.sm, paddingBottom: space.xxl },
  listWithFab: { paddingTop: space.sm, paddingBottom: space.xxl + NEW_SESSION_FAB_SPACE },
  code: { backgroundColor: theme.colors.surface, padding: space.md, borderRadius: 8, gap: space.xs },
}))
