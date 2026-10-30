import {
  AccessoryWidgetBackground,
  Button,
  HStack,
  Image,
  Link,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui'
import {
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  resizable,
  strokeBorder,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers'
import { createWidget, type WidgetEnvironment } from 'expo-widgets'
import type { ReactNode } from 'react'
import type { WidgetSnapshot } from './logic'

/** Widget kind; same name in the `expo-widgets` plugin config (`app.config.ts`). */
export const SESSIONS_WIDGET_NAME = 'SessionsWidget'

/**
 * Home Screen and Lock Screen widget of the active computer. It runs in the widget runtime: only
 * `@expo/ui/swift-ui`, no app state and no imports used inside, so the texts arrive translated and
 * the theme colors in the snapshot (the literals below are the dark theme, used before the first
 * snapshot). Small: counts; medium: up to three sessions and Deny / Allow for the oldest pending
 * request; Lock Screen: counts and usage limits, in the system's vibrant rendering. The buttons'
 * `app:` targets make iOS run them in the app's process, which answers them (`push/background.ts`).
 */
function SessionsWidgetLayout(props: Partial<WidgetSnapshot>, environment: WidgetEnvironment) {
  'widget'
  const family = environment.widgetFamily
  const palette = props.palette
  const background = palette ? palette.background : '#0D0D0D'
  const text = palette ? palette.text : '#E8E6E3'
  const textMuted = palette ? palette.textMuted : '#8A8784'
  const accent = palette ? palette.accent : '#E8A33D'
  const success = palette ? palette.success : '#7FB069'
  const warning = palette ? palette.warning : '#F3DC7A'
  const labels = props.labels ?? null
  const waiting = props.waiting ?? 0
  const running = props.running ?? 0
  const sessions = props.sessions ?? []
  const request = props.request ?? null
  const answering = request !== null && props.answering === request.requestId
  const listLink = props.listLink ?? 'remoteharness://'
  const paired = props.kind === 'computer'
  const limits = props.limits ?? { fiveHour: null, weekly: null }
  const updatedAt = props.updatedAt ?? 0
  // Lock Screen families: iOS 17 asks for a container background there too (the system removes it).
  const clear = containerBackground('clear', 'widget')

  const stateColor = (state: string) =>
    state === 'pending' || state === 'waiting' ? warning : state === 'running' ? accent : textMuted
  const counts = labels ? `${waiting} ${labels.waiting} · ${running} ${labels.running}` : '—'
  const limitParts = labels
    ? [
        limits.fiveHour ? `${labels.fiveHour} ${Math.round(limits.fiveHour.percent)}%` : '',
        limits.weekly ? `${labels.weekly} ${Math.round(limits.weekly.percent)}%` : '',
      ].filter((part) => part.length > 0)
    : []
  const limitLine = limitParts.join(' · ')
  // "Updated {time}": the words around the snapshot's clock time.
  const updatedParts = (labels ? labels.updated : '').split('{time}')
  const updatedBefore = updatedParts.length === 2 ? (updatedParts[0] ?? '').trim() : ''
  const updatedAfter = updatedParts.length === 2 ? (updatedParts[1] ?? '').trim() : ''
  const small = (content: string, color: string) => (
    <Text modifiers={[font({ size: 11 }), foregroundStyle(color), lineLimit(1)]}>{content}</Text>
  )
  const updated =
    labels && updatedAt > 0 ? (
      <HStack spacing={3}>
        {updatedBefore ? small(updatedBefore, textMuted) : null}
        <Text
          date={new Date(updatedAt)}
          dateStyle="time"
          modifiers={[font({ size: 11 }), monospacedDigit(), foregroundStyle(textMuted), lineLimit(1)]}
        />
        {updatedAfter ? small(updatedAfter, textMuted) : null}
      </HStack>
    ) : null
  const mark = (size: number) => (
    <Image
      assetName="LiveActivityIcon"
      modifiers={[resizable(), frame({ width: size, height: size }), clipShape('roundedRectangle', size / 4)]}
    />
  )
  const header = (
    <HStack spacing={6}>
      {mark(18)}
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(textMuted), lineLimit(1)]}>
        {props.computer || 'Remote Harness'}
      </Text>
      <Spacer />
    </HStack>
  )
  const count = (value: number, label: string, color: string) => (
    <VStack alignment="leading" spacing={0}>
      <Text modifiers={[font({ size: 30, weight: 'bold', design: 'monospaced' }), foregroundStyle(color)]}>
        {`${value}`}
      </Text>
      {small(label, textMuted)}
    </VStack>
  )

  if (family === 'accessoryInline') {
    return <Text modifiers={[clear]}>{paired ? counts : labels ? labels.pair : 'Remote Harness'}</Text>
  }
  if (family === 'accessoryCircular') {
    return (
      <VStack spacing={0} modifiers={[clear, widgetURL(listLink)]}>
        <AccessoryWidgetBackground />
        <Text modifiers={[font({ size: 22, weight: 'bold', design: 'monospaced' })]}>{`${waiting}`}</Text>
        {labels ? <Text modifiers={[font({ size: 9 }), lineLimit(1)]}>{labels.waiting}</Text> : null}
      </VStack>
    )
  }
  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[clear, widgetURL(listLink)]}>
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), lineLimit(1)]}>
          {paired ? counts : labels ? labels.pair : 'Remote Harness'}
        </Text>
        {paired && limitLine ? (
          <Text modifiers={[font({ size: 12, design: 'monospaced' }), lineLimit(1)]}>{limitLine}</Text>
        ) : null}
        {paired ? updated : null}
      </VStack>
    )
  }

  const card = (content: ReactNode) => (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[containerBackground(background, 'widget'), widgetURL(listLink), foregroundStyle(text)]}
    >
      {content}
    </VStack>
  )

  if (!paired || !labels) {
    return card(
      <VStack alignment="leading" spacing={8}>
        {header}
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(text)]}>
          {labels ? labels.pair : 'Remote Harness'}
        </Text>
      </VStack>,
    )
  }

  if (family === 'systemSmall') {
    return card(
      <VStack alignment="leading" spacing={4}>
        {header}
        <Spacer />
        <HStack spacing={14}>
          {count(waiting, labels.waiting, waiting > 0 ? warning : textMuted)}
          {count(running, labels.running, running > 0 ? accent : textMuted)}
        </HStack>
        <Spacer />
        {limitLine ? small(limitLine, textMuted) : null}
        {updated}
      </VStack>,
    )
  }

  const rows = sessions.map((session) => (
    <Link key={session.id} destination={session.link}>
      <HStack spacing={6}>
        <Text modifiers={[font({ size: 10 }), foregroundStyle(stateColor(session.state))]}>●</Text>
        <Text
          modifiers={[
            font({ size: 13, weight: session.state === 'pending' ? 'semibold' : 'regular' }),
            foregroundStyle(text),
            lineLimit(1),
          ]}
        >
          {session.title || labels.states[session.state]}
        </Text>
        <Spacer />
        {small(labels.states[session.state], stateColor(session.state))}
        <Text
          date={new Date(session.since)}
          dateStyle="relative"
          modifiers={[
            font({ size: 11 }),
            monospacedDigit(),
            foregroundStyle(textMuted),
            lineLimit(1),
            frame({ maxWidth: 64 }),
          ]}
        />
      </HStack>
    </Link>
  ))
  const actions = request ? (
    <HStack
      spacing={8}
      modifiers={[
        padding({ horizontal: 8, vertical: 4 }),
        strokeBorder({ content: warning, style: { lineWidth: 1 }, shape: 'roundedRectangle' }),
      ]}
    >
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(warning), lineLimit(1)]}>
        {request.text}
      </Text>
      <Spacer />
      {answering ? (
        small(labels.answering, textMuted)
      ) : (
        <HStack spacing={6}>
          {/* biome-ignore lint/a11y/useValidAriaRole: SwiftUI button role, not an ARIA role */}
          <Button label={labels.deny} role="destructive" target={`app:deny:${request.requestId}`} />
          <Button
            label={labels.allow}
            target={`app:allow:${request.requestId}`}
            modifiers={[foregroundStyle(success)]}
          />
        </HStack>
      )}
    </HStack>
  ) : null

  return card(
    <VStack alignment="leading" spacing={5}>
      <HStack spacing={6}>
        {mark(18)}
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(textMuted), lineLimit(1)]}>
          {props.computer || 'Remote Harness'}
        </Text>
        <Spacer />
        <Text
          modifiers={[font({ size: 12, design: 'monospaced' }), foregroundStyle(textMuted), lineLimit(1)]}
        >
          {counts}
        </Text>
      </HStack>
      {rows.length > 0 ? rows : small(labels.empty, textMuted)}
      <Spacer />
      {actions ?? (
        <HStack spacing={6}>
          {limitLine ? small(limitLine, textMuted) : null}
          <Spacer />
          {updated}
        </HStack>
      )}
    </VStack>,
  )
}

export const SessionsWidget = createWidget<Partial<WidgetSnapshot>>(
  SESSIONS_WIDGET_NAME,
  SessionsWidgetLayout,
)
