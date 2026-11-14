import type { Session } from '@remote-harness/protocol'
import { ChevronDown } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { space, useTheme } from '@/core/theme'
import { useMachineName } from '@/features/settings/machine-store'
import { Text } from '@/ui'
import type { StateFilter } from '../filter'
import { listSummary, statsLine } from '../summary'
import { ComputerSwitcherSheet } from './ComputerSwitcherSheet'

/**
 * Under the header, two lines (#555). First: the computer switcher (connection dot, machine name,
 * chevron), "via relay" when that is the path, and the session counts (total, running, waiting);
 * the counts wrap to a new line before the switcher is squeezed. Second: background tasks and the
 * distinct agents (and how many are running). Tapping "running" or "waiting" toggles that filter.
 */
export function MachineLine({
  sessions,
  stateFilter = 'all',
  onToggleState,
}: {
  sessions: readonly Session[]
  stateFilter?: StateFilter
  onToggleState?: (state: Exclude<StateFilter, 'all'>) => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const status = useConnectionStore((s) => s.status)
  const path = useConnectionStore((s) => s.path)
  const [switching, setSwitching] = useState(false)
  const machine = useMachineName() ?? t('machine.generic')
  const summary = listSummary(sessions)
  const dot = status === 'open' ? colors.success : status === 'unauthorized' ? colors.danger : colors.warning
  const stats = statsLine(summary, t)
  return (
    <View style={styles.block} accessibilityLabel={`${machine} · ${t(`connection.status.${status}`)}`}>
      <View style={styles.line}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('computers.switchLabel', { name: machine })}
          onPress={() => setSwitching(true)}
          hitSlop={6}
          style={({ pressed }) => [styles.machine, pressed ? { opacity: 0.6 } : null]}
        >
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Text size="xs" numberOfLines={1} style={styles.host}>
            {machine}
          </Text>
          <ChevronDown size={12} color={colors.textMuted} />
        </Pressable>
        {path === 'relay' ? (
          <Text size="xs" color="textMuted" numberOfLines={1}>
            · {t('connection.path.relay')}
          </Text>
        ) : null}
        <Text size="xs" color="textMuted" numberOfLines={1}>
          · {t('sessions.count', { count: summary.sessions })}
        </Text>
        {summary.running > 0 ? (
          <CountPart
            label={t('sessions.runningCount', { count: summary.running })}
            onPress={onToggleState ? () => onToggleState('running') : undefined}
            active={stateFilter === 'running'}
          />
        ) : null}
        {summary.waiting > 0 ? (
          <CountPart
            label={t('sessions.waitingCount', { count: summary.waiting })}
            onPress={onToggleState ? () => onToggleState('waiting') : undefined}
            active={stateFilter === 'waiting'}
          />
        ) : null}
      </View>
      {stats ? (
        <Text size="xs" color="textMuted" numberOfLines={1}>
          {stats}
        </Text>
      ) : null}
      <ComputerSwitcherSheet visible={switching} onClose={() => setSwitching(false)} />
    </View>
  )
}

function CountPart({ label, onPress, active }: { label: string; onPress?: () => void; active: boolean }) {
  const text = (
    <Text size="xs" color={active ? 'accentText' : 'textMuted'} numberOfLines={1}>
      · {label}
    </Text>
  )
  if (!onPress) return text
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
      {text}
    </Pressable>
  )
}

/** The switcher never gets narrower than its dot, a few letters of the name and the chevron. */
const SWITCHER_MIN_WIDTH = 96

const styles = StyleSheet.create({
  block: {
    gap: space.xxs,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  // Wraps: counts that do not fit move to the next line instead of squeezing the switcher.
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  machine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minWidth: SWITCHER_MIN_WIDTH,
    maxWidth: '100%',
    flexShrink: 1,
  },
  host: { flexShrink: 1 },
})
