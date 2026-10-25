import { Button, HStack, Image, Link, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  activityBackgroundTint,
  clipShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  progressViewStyle,
  resizable,
  strokeBorder,
  tint,
  truncationMode,
} from '@expo/ui/swift-ui/modifiers'
import { LIVE_ACTIVITY_NAME, type LiveStatusProps } from '@remote-harness/protocol'
import { createLiveActivity } from 'expo-widgets'

/**
 * Lock screen and Dynamic Island layout of a session's live status. It runs in the widget runtime:
 * only `@expo/ui/swift-ui`, no app state, no imports used inside, so the texts arrive translated in
 * the props, the colors arrive in `props.palette` (the app theme; the literals below are the dark
 * theme, used when an older daemon sends none) and props from older daemons may lack the fields
 * after `startedAt`. The mark (`LiveActivityIcon`, from the widget extension's asset catalog) is the
 * only icon; color encodes only the state (border, state pill, timer, progress bar, current glyph).
 * The big timer counts the time in the current state (working: the turn; waiting: the wait; done:
 * the frozen total); the right side says how long ago the phone was notified (and, waiting, the
 * turn's working time; done, when it finished), all self-updating `Text` dates, so no extra pushes.
 * Nothing spins: widgets don't animate an indeterminate `ProgressView`, so progress is only the
 * ticking timer and, with a todo list, a determinate bar. The Deny and Allow buttons carry
 * `deny:<requestId>` / `allow:<requestId>` as their target; the app answers them. Open is a link to
 * the session (a button would run in the background and could not open the app).
 */
function SessionActivityLayout(props: LiveStatusProps) {
  'widget'
  const palette = props.palette
  const background = palette ? palette.background : '#0D0D0D'
  const text = palette ? palette.text : '#E8E6E3'
  const textMuted = palette ? palette.textMuted : '#8A8784'
  const accent = palette ? palette.accent : '#E8A33D'
  const success = palette ? palette.success : '#7FB069'
  const warning = palette ? palette.warning : '#F3DC7A'
  const state = props.state
  const stateColor =
    state === 'waiting' ? warning : state === 'done' ? success : state === 'closed' ? textMuted : accent
  const working = state === 'working'
  const finished = state === 'done' || state === 'closed'
  const endedAt = props.endedAt ?? null
  const header = props.host ? `${props.title} · ${props.host}` : props.title
  const glyphs = props.glyphs ?? []
  const pending = props.pending ?? null
  const hint = props.hint ?? ''
  // Subagents and background tasks ("2 subagents · 1 background task"); older daemons send neither
  // these nor the current step ("Bash · pnpm test") and the todo progress.
  const tasks = props.tasks ?? ''
  const current = props.current ?? ''
  const progress = props.progress ?? null
  // Newer daemons: the phrase (or the opted-in task), the card labels, the notify time and the link.
  const labels = props.labels ?? null
  const doing = props.task || props.activity || ''
  const notifiedAt = props.notifiedAt ?? 0
  const link = props.link ?? ''
  const changedAt = props.changedAt ?? 0
  const waiting = state === 'waiting'
  // "{time} ago" / "há {time}": the words around the live relative time.
  const agoParts = (props.ago ?? '').split('{time}')
  const agoBefore = agoParts.length === 2 ? (agoParts[0] ?? '') : ''
  const agoAfter = agoParts.length === 2 ? (agoParts[1] ?? '') : ''
  const stateLine = [props.status, props.step].filter((part) => part.length > 0).join(' · ')
  const meta = [progress ? `☑ ${progress.done}/${progress.total}` : '', tasks, props.tools]
    .filter((part) => part.length > 0)
    .join(' · ')
  // Oldest on the left, the current step on the right; repeated glyphs get their own stable key.
  const seen: Record<string, number> = {}
  const ordered = [...glyphs].reverse().map((glyph) => {
    seen[glyph] = (seen[glyph] ?? 0) + 1
    return { glyph, key: `${glyph}-${seen[glyph]}` }
  })

  const twoDigits = (value: number) => (value < 10 ? `0${value}` : `${value}`)
  const duration = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = twoDigits(total % 60)
    return hours > 0 ? `${hours}:${twoDigits(minutes)}:${seconds}` : `${minutes}:${seconds}`
  }

  const mark = (size: number) => (
    <Image
      assetName="LiveActivityIcon"
      modifiers={[resizable(), frame({ width: size, height: size }), clipShape('roundedRectangle', size / 4)]}
    />
  )
  const timerStyle = (size: number) => [
    font({ size, weight: 'semibold', design: 'monospaced' }),
    monospacedDigit(),
    foregroundStyle(stateColor),
  ]
  // Running: the turn; waiting (newer daemons): the wait. Ticks on its own. Ended: frozen at the
  // turn's duration.
  const timerStart = waiting && labels && changedAt > 0 ? changedAt : props.startedAt
  const timer = (size: number, maxWidth: number) =>
    !finished ? (
      <Text
        date={new Date(timerStart)}
        dateStyle="timer"
        modifiers={[...timerStyle(size), frame({ maxWidth })]}
      />
    ) : endedAt !== null ? (
      <Text modifiers={timerStyle(size)}>{duration(endedAt - props.startedAt)}</Text>
    ) : null
  const small = (content: string) => (
    <Text modifiers={[font({ size: 11 }), foregroundStyle(textMuted), lineLimit(1)]}>{content}</Text>
  )
  /** "<label> 30 min ago", the time counting by itself. */
  const since = (label: string, at: number) => (
    <HStack spacing={3}>
      {small(agoBefore ? `${label} ${agoBefore.trim()}` : label)}
      <Text
        date={new Date(at)}
        dateStyle="relative"
        modifiers={[font({ size: 11 }), monospacedDigit(), foregroundStyle(textMuted), lineLimit(1)]}
      />
      {agoAfter.trim() ? small(agoAfter.trim()) : null}
    </HStack>
  )
  const timerLabel = labels ? (finished ? labels.total : waiting ? labels.waiting : labels.working) : ''
  // Big timer with its label on the left; how fresh the card is on the right.
  const timesRow = labels ? (
    <HStack spacing={8}>
      {timer(30, 140)}
      {small(timerLabel)}
      <Spacer />
      <VStack alignment="trailing" spacing={1}>
        {waiting && changedAt > props.startedAt
          ? small(`${labels.working} ${duration(changedAt - props.startedAt)}`)
          : null}
        {finished && endedAt !== null
          ? since(labels.finished, endedAt)
          : notifiedAt > 0
            ? since(labels.notified, notifiedAt)
            : null}
      </VStack>
    </HStack>
  ) : null
  const statePill = (
    <Text
      modifiers={[
        font({ size: 11, weight: 'semibold' }),
        foregroundStyle(stateColor),
        lineLimit(1),
        padding({ horizontal: 8, vertical: 3 }),
        strokeBorder({ content: stateColor, style: { lineWidth: 1 }, shape: 'capsule' }),
      ]}
    >
      {`● ${props.status}`}
    </Text>
  )
  const doingLine = doing ? (
    <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(text), lineLimit(1)]}>
      {`↳ ${doing}`}
    </Text>
  ) : null
  const sessionName = props.session ? (
    <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle(text), lineLimit(1)]}>
      {props.session}
    </Text>
  ) : null
  const folder = props.path ? (
    <Text
      modifiers={[
        font({ size: 12, design: 'monospaced' }),
        foregroundStyle(textMuted),
        lineLimit(1),
        truncationMode('head'),
      ]}
    >
      {props.path}
    </Text>
  ) : null
  const stateText = (
    <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(stateColor), lineLimit(1)]}>
      {stateLine}
    </Text>
  )
  // What runs now on the left, the progress and counts on the right.
  const detailRow =
    current || meta ? (
      <HStack spacing={8}>
        {current ? (
          <Text
            modifiers={[
              font({ size: 12, design: 'monospaced' }),
              foregroundStyle(text),
              lineLimit(1),
              truncationMode('middle'),
            ]}
          >
            {current}
          </Text>
        ) : null}
        <Spacer />
        {meta ? (
          <Text
            modifiers={[
              font({ size: 11, design: 'monospaced' }),
              monospacedDigit(),
              foregroundStyle(textMuted),
              lineLimit(1),
            ]}
          >
            {meta}
          </Text>
        ) : null}
      </HStack>
    ) : null
  const progressBar =
    working && progress ? (
      <ProgressView
        value={Math.min(1, progress.done / progress.total)}
        modifiers={[progressViewStyle('linear'), tint(stateColor)]}
      />
    ) : null
  const glyphRow =
    ordered.length > 0 ? (
      <HStack spacing={8}>
        {ordered.map(({ glyph, key }, index) => (
          <Text
            key={key}
            modifiers={[
              font({ size: 13, weight: 'semibold', design: 'monospaced' }),
              foregroundStyle(index === ordered.length - 1 ? stateColor : textMuted),
            ]}
          >
            {glyph}
          </Text>
        ))}
      </HStack>
    ) : null
  const actions = pending ? (
    <HStack spacing={10}>
      {/* biome-ignore lint/a11y/useValidAriaRole: SwiftUI button role, not an ARIA role */}
      <Button label={pending.deny} role="destructive" target={`deny:${pending.requestId}`} />
      <Button
        label={pending.allow}
        target={`allow:${pending.requestId}`}
        modifiers={[foregroundStyle(success)]}
      />
      {labels && link ? (
        <Link label={labels.open} destination={link} modifiers={[foregroundStyle(textMuted)]} />
      ) : null}
    </HStack>
  ) : null
  const hintText =
    hint && state === 'closed' ? (
      <Text modifiers={[font({ size: 12 }), foregroundStyle(textMuted), lineLimit(1)]}>{hint}</Text>
    ) : null
  const totalText =
    hint && state === 'done' ? (
      <Text modifiers={[font({ size: 11 }), foregroundStyle(textMuted)]}>{hint}</Text>
    ) : null
  const stateDot = <Text modifiers={[font({ size: 10 }), foregroundStyle(stateColor)]}>●</Text>

  // Newer daemons: header with the state pill, times row, phrase; older ones keep the first layout.
  const card = labels ? (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        padding({ all: 14 }),
        activityBackgroundTint(background),
        strokeBorder({ content: stateColor, style: { lineWidth: 2 }, shape: 'containerRelativeShape' }),
      ]}
    >
      <HStack spacing={10}>
        {mark(24)}
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(textMuted), lineLimit(1)]}>
          {header}
        </Text>
        <Spacer />
        {statePill}
      </HStack>
      {sessionName}
      {folder}
      {timesRow}
      {doingLine}
      {detailRow}
      {progressBar}
      {glyphRow}
      {hintText}
      {actions}
    </VStack>
  ) : null

  return {
    banner: card ?? (
      <VStack
        alignment="leading"
        spacing={6}
        modifiers={[
          padding({ all: 14 }),
          activityBackgroundTint(background),
          strokeBorder({ content: stateColor, style: { lineWidth: 2 }, shape: 'containerRelativeShape' }),
        ]}
      >
        <HStack spacing={10}>
          {mark(24)}
          <VStack alignment="leading" spacing={2}>
            <Text
              modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(textMuted), lineLimit(1)]}
            >
              {header}
            </Text>
            {sessionName}
            {folder}
          </VStack>
          <Spacer />
          <VStack alignment="trailing" spacing={0}>
            {timer(28, 120)}
            {totalText}
          </VStack>
        </HStack>
        {progressBar}
        <HStack spacing={8}>
          {stateText}
          <Spacer />
          {glyphRow}
        </HStack>
        {detailRow}
        {hintText}
        {actions}
      </VStack>
    ),
    compactLeading: mark(20),
    compactTrailing: !finished ? (
      timer(14, 56)
    ) : glyphs[0] ? (
      <Text modifiers={[font({ size: 13, design: 'monospaced' }), foregroundStyle(stateColor)]}>
        {glyphs[0]}
      </Text>
    ) : (
      stateDot
    ),
    minimal: (
      <HStack spacing={2}>
        {mark(16)}
        {stateDot}
      </HStack>
    ),
    expandedLeading: (
      <HStack spacing={6}>
        {mark(20)}
        <Text modifiers={[font({ weight: 'semibold' }), lineLimit(1)]}>{header}</Text>
      </HStack>
    ),
    expandedTrailing: timer(16, 76),
    expandedBottom: (
      <VStack alignment="leading" spacing={4}>
        {sessionName}
        {folder}
        {labels ? (
          <HStack spacing={8}>
            {statePill}
            <Spacer />
            {glyphRow}
          </HStack>
        ) : (
          <HStack spacing={8}>
            {stateText}
            <Spacer />
            {glyphRow}
          </HStack>
        )}
        {doingLine}
        {detailRow}
        {progressBar}
        {hintText}
        {actions}
      </VStack>
    ),
  }
}

export const SessionActivity = createLiveActivity<LiveStatusProps>(LIVE_ACTIVITY_NAME, SessionActivityLayout)
