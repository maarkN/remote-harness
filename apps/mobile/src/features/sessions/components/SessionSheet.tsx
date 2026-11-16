import type { Profile, Session } from '@remote-harness/protocol'
import {
  ArrowDownToLine,
  Bot,
  Braces,
  CalendarClock,
  Cpu,
  GitCompare,
  Headphones,
  History,
  Keyboard,
  type LucideIcon,
  Power,
  Radio,
  SquareTerminal,
  Terminal,
} from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { keys, useKeyCommand } from '@/core/keyboard/key-commands'
import { makeStyles, radius, space, useTheme } from '@/core/theme'
import { shortPath } from '@/core/utils/time'
import type {
  SessionMenuAction,
  SessionMenuItem,
  SessionSheetCell,
} from '@/features/conversation/session-menu'
import { AgentBadge, Button, ProfileTag, Sheet, Text } from '@/ui'
import { nextEnabled } from '@/ui/menu-nav'
import { sessionAgent } from '../agent'
import { SessionDetailsList } from './SessionDetailsList'
import { StateBadge } from './StateBadge'

const ICONS: Record<Exclude<SessionMenuAction, 'close'>, LucideIcon> = {
  terminal: Terminal,
  runCommand: SquareTerminal,
  model: Cpu,
  subagents: Bot,
  toggleKeyBar: Keyboard,
  toggleHandsFree: Headphones,
  templates: Braces,
  schedule: CalendarClock,
  history: History,
  changes: GitCompare,
  toggleFollow: ArrowDownToLine,
  toggleLiveFollow: Radio,
}

/**
 * The session sheet (#563), opened from the session title and from More options: the session's
 * summary, its actions as a grid of icon buttons (toggles highlighted while on), its details (the
 * inspector's rows) and Close session set apart. A cell closes the sheet and runs its action; ↑ / ↓
 * move between the enabled cells, Enter runs the highlighted one, Esc closes.
 */
export function SessionSheet({
  visible,
  session,
  profile,
  cells,
  close,
  disabledReason,
  subagentsRunning,
  onAction,
  onClose,
}: {
  visible: boolean
  session: Session
  profile: Profile | undefined
  cells: SessionSheetCell[]
  close: SessionMenuItem | null
  disabledReason?: string
  /** An accent dot on the Subagents cell, as on the More options button. */
  subagentsRunning: boolean
  onAction: (action: SessionMenuAction) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const agent = sessionAgent(session)
  // Keyboard highlight among the cells; -1 until an arrow is pressed.
  const [highlight, setHighlight] = useState(-1)
  const choose = (action: SessionMenuAction) => {
    setHighlight(-1)
    onClose()
    onAction(action)
  }
  const move = (delta: 1 | -1) => setHighlight((current) => nextEnabled(cells, current, delta))
  useKeyCommand({ input: keys.keyInputDownArrow }, () => move(1), visible)
  useKeyCommand({ input: keys.keyInputUpArrow }, () => move(-1), visible)
  useKeyCommand(
    { input: keys.keyInputEnter },
    () => {
      const cell = cells[highlight]
      if (cell && !cell.disabled) choose(cell.key)
    },
    visible,
  )
  const dismiss = () => {
    setHighlight(-1)
    onClose()
  }
  const title = session.title || t('common.session')
  return (
    <Sheet
      visible={visible}
      onClose={dismiss}
      accessibilityLabel={t('sessionDetails.open', { title })}
      header={
        <View style={styles.summary}>
          <View style={styles.line}>
            {agent ? <AgentBadge agent={agent} /> : null}
            <Text weight="bold" numberOfLines={2} selectable accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          </View>
          <View style={styles.line}>
            <ProfileTag profile={profile ?? { name: session.profileId, color: '' }} />
            <Text size="xs" color="textMuted" numberOfLines={1} style={styles.folder}>
              {shortPath(session.cwd)}
            </Text>
            <StateBadge state={session.state} />
          </View>
        </View>
      }
      footer={
        close ? (
          <Button
            label={close.label}
            variant="danger"
            disabled={close.disabled}
            icon={<Power size={16} color={close.disabled ? colors.textDim : colors.danger} />}
            onPress={() => choose('close')}
          />
        ) : null
      }
    >
      <View>
        <View style={styles.grid}>
          {cells.map((cell, index) => {
            const Icon = ICONS[cell.key]
            const on = cell.active === true
            return (
              <Pressable
                key={cell.key}
                accessibilityRole="button"
                accessibilityLabel={cell.label}
                accessibilityState={{
                  disabled: cell.disabled,
                  ...(cell.active === null ? {} : { selected: on }),
                }}
                disabled={cell.disabled}
                onPress={() => choose(cell.key)}
                style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
              >
                <View
                  style={[
                    styles.icon,
                    on && styles.iconOn,
                    index === highlight && styles.iconHighlight,
                    cell.disabled && styles.disabled,
                  ]}
                >
                  <Icon size={20} color={on ? colors.accentText : colors.text} />
                  {cell.key === 'subagents' && subagentsRunning ? <View style={styles.dot} /> : null}
                </View>
                <Text
                  size="xs"
                  color={cell.disabled ? 'textDim' : on ? 'accentText' : 'textMuted'}
                  numberOfLines={2}
                  style={styles.label}
                >
                  {cell.short}
                </Text>
              </Pressable>
            )
          })}
        </View>
        {disabledReason ? (
          <Text size="xs" color="textMuted">
            {disabledReason}
          </Text>
        ) : null}
      </View>
      <View style={styles.details}>
        <Text
          size="xs"
          weight="bold"
          color="textMuted"
          accessibilityRole="header"
          style={styles.sectionTitle}
        >
          {t('sessionDetails.title').toUpperCase()}
        </Text>
        <SessionDetailsList sessionId={session.id} profile={profile} />
      </View>
    </Sheet>
  )
}

const ICON_SIZE = 48

const useStyles = makeStyles((theme) => ({
  summary: { gap: space.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minWidth: 0 },
  title: { flex: 1 },
  folder: { flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, marginBottom: space.sm },
  cell: { width: '25%', alignItems: 'center', gap: space.xs, paddingHorizontal: 2 },
  pressed: { opacity: 0.6 },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
  },
  iconOn: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
  iconHighlight: { borderColor: theme.colors.accent, borderWidth: 2 },
  disabled: { opacity: 0.4 },
  dot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.accent,
    borderWidth: 1.5,
    borderColor: theme.colors.surfaceRaised,
  },
  label: { textAlign: 'center' },
  details: { gap: space.xs },
  sectionTitle: { letterSpacing: 0.8 },
}))
