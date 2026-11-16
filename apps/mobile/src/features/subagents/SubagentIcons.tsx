import type { SubagentInfo } from '@remote-harness/protocol'
import { CircleCheck, CircleStop, CircleX, LoaderCircle, type LucideIcon } from 'lucide-react-native'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'
import { makeStyles, space, useTheme } from '@/core/theme'
import { Text } from '@/ui'
import { cardSubagents, SUBAGENT_TEXT_COLORS, type SubagentStatus, subagentStateCounts } from './sort'

const ICONS: Record<SubagentStatus, LucideIcon> = {
  running: LoaderCircle,
  done: CircleCheck,
  failed: CircleX,
  stopped: CircleStop,
}

/**
 * A session's subagents on its card in the list (#562): up to three state icons, running first,
 * then "+N" (with the running ones it hides). One button, announced with the count per state, that
 * opens the Subagents sheet.
 */
export const SubagentIcons = memo(function SubagentIcons({
  subagents,
  onPress,
}: {
  subagents: SubagentInfo[]
  onPress: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  if (subagents.length === 0) return null
  const card = cardSubagents(subagents)
  const states = subagentStateCounts(subagents)
    .map(([status, count]) => t(`subagents.stateCount.${status}`, { count }))
    .join(', ')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('subagents.cardLabel', {
        summary: t('subagents.summary', { count: subagents.length }),
        states,
      })}
      accessibilityHint={t('subagents.cardHint')}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.group, pressed && styles.pressed]}
    >
      {card.shown.map(({ agentId, status }) => {
        const Icon = ICONS[status]
        return (
          <Icon key={agentId} size={14} color={colors[SUBAGENT_TEXT_COLORS[status]]} strokeWidth={2.25} />
        )
      })}
      {card.hidden > 0 ? (
        <Text size="xs" color="textDim">
          {card.hiddenRunning > 0
            ? t('subagents.overflowRunning', { count: card.hidden, running: card.hiddenRunning })
            : t('subagents.overflow', { count: card.hidden })}
        </Text>
      ) : null}
    </Pressable>
  )
})

const useStyles = makeStyles(() => ({
  group: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: 2 },
  pressed: { opacity: 0.6 },
}))
