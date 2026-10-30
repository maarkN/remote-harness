import { FlexWidget, type HexColor, TextWidget } from 'react-native-android-widget'
import { THEMES } from '@/core/theme/palettes'
import { livePalette } from '../../live-status/logic'
import { updatedLine, type WidgetSession, type WidgetSnapshot } from '../logic'

/** Widget names; the same in the `react-native-android-widget` plugin config (`app.config.ts`). */
export const ANDROID_WIDGETS = { small: 'SessionsSmall', medium: 'SessionsMedium' } as const
export type AndroidWidgetName = (typeof ANDROID_WIDGETS)[keyof typeof ANDROID_WIDGETS]

/** Click actions the widget task handler answers (besides the library's `OPEN_URI`). */
export const WIDGET_CLICK = { allow: 'ALLOW', deny: 'DENY' } as const

const hex = (color: string) => color as HexColor

/** Clock time of the snapshot (the widget only redraws when a new snapshot arrives). */
function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function openUri(uri: string) {
  return { clickAction: 'OPEN_URI', clickActionData: { uri } } as const
}

type Props = { snapshot: WidgetSnapshot | null }

/**
 * Small (2×2) home screen widget: waiting and running counts, the limits and the snapshot time;
 * a tap opens the session list. Theme colors and texts come in the snapshot.
 */
export function SessionsSmallWidget({ snapshot }: Props) {
  if (!snapshot || snapshot.kind === 'pair') return <PairWidget snapshot={snapshot} />
  const { palette, labels } = snapshot
  return (
    <Card snapshot={snapshot}>
      <Header snapshot={snapshot} />
      <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexGap: 16 }}>
        <Count
          value={snapshot.waiting}
          label={labels.waiting}
          color={snapshot.waiting > 0 ? palette.warning : palette.textMuted}
          muted={palette.textMuted}
        />
        <Count
          value={snapshot.running}
          label={labels.running}
          color={snapshot.running > 0 ? palette.accent : palette.textMuted}
          muted={palette.textMuted}
        />
      </FlexWidget>
      <Footer snapshot={snapshot} />
    </Card>
  )
}

/**
 * Medium (4×2) home screen widget: up to three sessions (each opens on its computer), the pending
 * permission highlighted with Deny / Allow, which a background task answers with the app closed.
 */
export function SessionsMediumWidget({ snapshot }: Props) {
  if (!snapshot || snapshot.kind === 'pair') return <PairWidget snapshot={snapshot} />
  const { palette, labels, request } = snapshot
  const answering = request !== null && snapshot.answering === request.requestId
  const requestData: Record<string, string> = request
    ? { requestId: request.requestId, daemonId: snapshot.daemonId ?? '' }
    : {}
  return (
    <Card snapshot={snapshot}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <Header snapshot={snapshot} />
        <TextWidget
          text={`${snapshot.waiting} ${labels.waiting} · ${snapshot.running} ${labels.running}`}
          style={{ fontSize: 12, color: hex(palette.textMuted), fontFamily: 'monospace' }}
          maxLines={1}
        />
      </FlexWidget>
      <FlexWidget
        style={{ flex: 1, width: 'match_parent', flexDirection: 'column', flexGap: 4, paddingTop: 6 }}
      >
        {snapshot.sessions.length > 0 ? (
          snapshot.sessions.map((session) => (
            <SessionRow key={session.id} session={session} snapshot={snapshot} />
          ))
        ) : (
          <TextWidget text={labels.empty} style={{ fontSize: 12, color: hex(palette.textMuted) }} />
        )}
      </FlexWidget>
      {request ? (
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: hex(palette.warning),
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 4,
            flexGap: 8,
          }}
        >
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text={request.text}
              style={{ fontSize: 12, fontWeight: '600', color: hex(palette.warning) }}
              maxLines={1}
              truncate="END"
            />
          </FlexWidget>
          {answering ? (
            <TextWidget text={labels.answering} style={{ fontSize: 12, color: hex(palette.textMuted) }} />
          ) : (
            <FlexWidget style={{ flexDirection: 'row', flexGap: 8 }}>
              <Action
                label={labels.deny}
                color={palette.textMuted}
                border={palette.textMuted}
                clickAction={WIDGET_CLICK.deny}
                data={requestData}
              />
              <Action
                label={labels.allow}
                color={palette.background}
                fill={palette.success}
                clickAction={WIDGET_CLICK.allow}
                data={requestData}
              />
            </FlexWidget>
          )}
        </FlexWidget>
      ) : (
        <Footer snapshot={snapshot} />
      )}
    </Card>
  )
}

function Card({ snapshot, children }: { snapshot: WidgetSnapshot; children: React.ReactNode }) {
  return (
    <FlexWidget
      {...openUri(snapshot.listLink)}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: hex(snapshot.palette.background),
        borderRadius: 18,
        padding: 12,
      }}
    >
      {children}
    </FlexWidget>
  )
}

function Header({ snapshot }: { snapshot: WidgetSnapshot }) {
  return (
    <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
      <TextWidget text="●" style={{ fontSize: 10, color: hex(snapshot.palette.accent) }} />
      <TextWidget
        text={snapshot.computer || 'Remote Harness'}
        style={{ fontSize: 12, fontWeight: '600', color: hex(snapshot.palette.textMuted) }}
        maxLines={1}
        truncate="END"
      />
    </FlexWidget>
  )
}

function Count({
  value,
  label,
  color,
  muted,
}: {
  value: number
  label: string
  color: string
  muted: string
}) {
  return (
    <FlexWidget style={{ flexDirection: 'column' }}>
      <TextWidget
        text={`${value}`}
        style={{ fontSize: 30, fontWeight: 'bold', fontFamily: 'monospace', color: hex(color) }}
      />
      <TextWidget text={label} style={{ fontSize: 11, color: hex(muted) }} maxLines={1} />
    </FlexWidget>
  )
}

function limitLine(snapshot: WidgetSnapshot): string {
  const { labels, limits } = snapshot
  return [
    limits.fiveHour ? `${labels.fiveHour} ${Math.round(limits.fiveHour.percent)}%` : '',
    limits.weekly ? `${labels.weekly} ${Math.round(limits.weekly.percent)}%` : '',
  ]
    .filter((part) => part.length > 0)
    .join(' · ')
}

function Footer({ snapshot }: { snapshot: WidgetSnapshot }) {
  const muted = hex(snapshot.palette.textMuted)
  const limits = limitLine(snapshot)
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: 8 }}>
      {limits ? (
        <TextWidget
          text={limits}
          style={{ fontSize: 11, color: muted, fontFamily: 'monospace' }}
          maxLines={1}
        />
      ) : null}
      <FlexWidget style={{ flex: 1 }} />
      <TextWidget
        text={updatedLine(snapshot.labels, clock(snapshot.updatedAt))}
        style={{ fontSize: 11, color: muted }}
        maxLines={1}
      />
    </FlexWidget>
  )
}

function SessionRow({ session, snapshot }: { session: WidgetSession; snapshot: WidgetSnapshot }) {
  const { palette, labels } = snapshot
  const color =
    session.state === 'pending' || session.state === 'waiting'
      ? palette.warning
      : session.state === 'running'
        ? palette.accent
        : palette.textMuted
  return (
    <FlexWidget
      {...openUri(session.link)}
      style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: 6 }}
    >
      <TextWidget text="●" style={{ fontSize: 10, color: hex(color) }} />
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget
          text={session.title || labels.states[session.state]}
          style={{
            fontSize: 13,
            fontWeight: session.state === 'pending' ? '600' : 'normal',
            color: hex(palette.text),
          }}
          maxLines={1}
          truncate="END"
        />
      </FlexWidget>
      <TextWidget
        text={labels.states[session.state]}
        style={{ fontSize: 11, color: hex(color) }}
        maxLines={1}
      />
      <TextWidget
        text={clock(session.since)}
        style={{ fontSize: 11, color: hex(palette.textMuted), fontFamily: 'monospace' }}
      />
    </FlexWidget>
  )
}

function Action(props: {
  label: string
  color: string
  fill?: string
  border?: string
  clickAction: string
  data: Record<string, string>
}) {
  return (
    <TextWidget
      text={props.label}
      clickAction={props.clickAction}
      clickActionData={props.data}
      style={{
        fontSize: 12,
        fontWeight: '600',
        color: hex(props.color),
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        ...(props.fill ? { backgroundColor: hex(props.fill) } : {}),
        ...(props.border ? { borderWidth: 1, borderColor: hex(props.border) } : {}),
      }}
    />
  )
}

/** No paired computer yet (or no snapshot): an invitation to open the app. */
function PairWidget({ snapshot }: Props) {
  // Before the first snapshot: the default (dark) theme.
  const palette = snapshot?.palette ?? livePalette(THEMES.dark)
  const background = hex(palette.background)
  const text = hex(palette.text)
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: background,
        borderRadius: 18,
        padding: 12,
      }}
    >
      <TextWidget
        text={snapshot?.labels.pair ?? 'Remote Harness'}
        style={{ fontSize: 13, fontWeight: '600', color: text }}
      />
    </FlexWidget>
  )
}

/** The widget of a name with the saved snapshot. */
export function androidWidgetFor(name: string, snapshot: WidgetSnapshot | null) {
  return name === ANDROID_WIDGETS.medium ? (
    <SessionsMediumWidget snapshot={snapshot} />
  ) : (
    <SessionsSmallWidget snapshot={snapshot} />
  )
}
