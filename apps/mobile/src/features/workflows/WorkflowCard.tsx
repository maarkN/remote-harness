import type { SubagentInfo } from '@remote-harness/protocol'
import { router } from 'expo-router'
import { ChevronDown, ChevronRight } from 'lucide-react-native'
import { memo, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { type ColorName, makeStyles, radius, space, useTheme } from '@/core/theme'
import { ConversationSession } from '@/features/conversation/session-context'
import type { TimelineItem } from '@/features/conversation/timeline'
import { useSessionsStore } from '@/features/sessions/store'
import { SubagentRows } from '@/features/subagents/SubagentRows'
import { Badge, Text } from '@/ui'
import {
  PHASE_GLYPHS,
  type PhaseState,
  phaseRows,
  phaseState,
  WORKFLOW_TONES,
  workflowAgents,
  workflowDescription,
  workflowStatus,
  workflowSummary,
  workflowTitle,
} from './logic'

type WorkflowItem = Extract<TimelineItem, { type: 'workflow' }>

const NO_AGENTS: SubagentInfo[] = []

const PHASE_COLORS: Record<PhaseState, ColorName> = {
  pending: 'textDim',
  active: 'accentText',
  done: 'success',
  failed: 'danger',
}

/**
 * A `Workflow` call in the conversation: name, status badge and the collapsed summary; expanded, the
 * description, the phases with their agents' progress, the run's agents (the subagent rows; a tap
 * opens one) and, once the run ended, its summary and result. The agents come from the session's
 * subagents carrying the run id, so the card follows `subagent.updated` live.
 */
export const WorkflowCard = memo(function WorkflowCard({ item }: { item: WorkflowItem }) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const sessionId = useContext(ConversationSession)
  const [open, setOpen] = useState(false)
  const call = item.use.workflow
  const launch = item.result?.workflow ?? null
  const runId = launch?.runId ?? null
  const subagents =
    useSessionsStore((s) => (sessionId ? s.sessions[sessionId]?.subagents : undefined)) ?? NO_AGENTS
  const agents = useMemo(() => workflowAgents(subagents, runId), [subagents, runId])
  const rows = useMemo(() => phaseRows(call.phases, agents), [call.phases, agents])
  const status = workflowStatus(item.result !== null, item.notification?.status)
  const live = status === 'starting' || status === 'running'
  const title = workflowTitle(call, t)
  const description = workflowDescription(call, launch)
  const summary = workflowSummary(rows, agents, t)
  const Icon = open ? ChevronDown : ChevronRight

  const openAgent = (agentId: string) => {
    if (sessionId)
      router.push({ pathname: '/session/[id]/agent/[agentId]', params: { id: sessionId, agentId } })
  }

  return (
    <View style={[styles.wrap, live && styles.live]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workflow.open', { name: title, summary })}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.header}
      >
        <View style={layout.flex}>
          <Text size="sm" weight="medium" numberOfLines={open ? undefined : 1}>
            {title}
          </Text>
          {!open ? (
            <Text size="xs" color="textMuted" numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Badge label={t(`workflow.status.${status}`)} tone={WORKFLOW_TONES[status]} dot={live} />
        <Icon size={14} color={colors.textDim} />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {description ? (
            <Text size="sm" color="textMuted" selectable>
              {description}
            </Text>
          ) : null}
          {rows.length > 0 ? (
            <View style={layout.section}>
              <Text size="xs" color="textDim" weight="medium">
                {t('workflow.phasesTitle')}
              </Text>
              {rows.map((row) => {
                const state = phaseState(row)
                return (
                  <View key={row.title} style={layout.phase}>
                    <Text size="sm" color={PHASE_COLORS[state]}>
                      {PHASE_GLYPHS[state]}
                    </Text>
                    <View style={layout.flex}>
                      <Text size="sm" numberOfLines={1}>
                        {row.title}
                      </Text>
                      {row.detail ? (
                        <Text size="xs" color="textMuted" numberOfLines={2}>
                          {row.detail}
                        </Text>
                      ) : null}
                    </View>
                    <Text size="xs" color={row.total > 0 ? 'textMuted' : 'textDim'}>
                      {`${row.done}/${row.total}`}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : null}
          <View style={layout.section}>
            <Text size="xs" color="textDim" weight="medium">
              {t('workflow.agentsTitle')}
            </Text>
            {agents.length > 0 ? (
              <SubagentRows subagents={agents} onOpen={openAgent} />
            ) : (
              <Text size="xs" color="textDim">
                {t('workflow.noAgents')}
              </Text>
            )}
          </View>
          {item.notification ? (
            <View style={layout.section}>
              <Text size="xs" color="textDim" weight="medium">
                {t('workflow.result')}
              </Text>
              <Text size="sm" selectable>
                {item.notification.text}
              </Text>
              {item.notification.result ? (
                <Text size="xs" color="textMuted" selectable>
                  {item.notification.result}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
})

const layout = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.xs },
  phase: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xxs },
})

const useStyles = makeStyles((theme) => ({
  wrap: {
    marginHorizontal: space.md,
    marginVertical: space.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radius.md,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  live: { borderColor: theme.colors.accent },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  body: { paddingHorizontal: space.sm, paddingBottom: space.sm, gap: space.md },
}))
