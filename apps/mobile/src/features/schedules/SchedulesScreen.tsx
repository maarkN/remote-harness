import type { Schedule } from '@remote-harness/protocol'
import { Plus } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import { selectProfiles, useConnectionStore, useDaemonClient } from '@/core/connection'
import { errorMessage } from '@/core/connection/error-message'
import { makeStyles, space, useTheme } from '@/core/theme'
import { Button, Card, EmptyState, Screen, Text } from '@/ui'
import { useSessionsStore } from '../sessions/store'
import {
  describeNext,
  describeRun,
  describeTarget,
  describeWhen,
  needsAttention,
  sortSchedules,
} from './logic'
import { ScheduleEditorSheet } from './ScheduleEditorSheet'
import { runSchedule, updateSchedule, useSchedulesStore } from './store'

/** Session titles by id (strings, so the selection stays shallow-equal while nothing is renamed). */
const selectTitles = (s: { sessions: Record<string, { id: string; title: string }> }) =>
  Object.fromEntries(Object.values(s.sessions).map((session) => [session.id, session.title]))

/** Settings → Scheduled prompts (#432): the computer's schedules; tap one to edit, Run now after a missed or failed run. */
export function SchedulesScreen() {
  const { t, i18n } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const client = useDaemonClient()
  const schedules = useSchedulesStore((s) => s.schedules)
  const loaded = useSchedulesStore((s) => s.loaded)
  const titles = useSessionsStore(useShallow(selectTitles))
  const profiles = useConnectionStore(selectProfiles)
  const [editing, setEditing] = useState<{ schedule: Schedule | null } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const sessions = Object.fromEntries(Object.entries(titles).map(([id, title]) => [id, { title }]))

  const fail = (e: unknown) => Alert.alert(t('schedules.failed'), errorMessage(e, t))
  const toggle = (schedule: Schedule, enabled: boolean) => {
    if (!client) return
    const { title, prompt, target, when } = schedule
    updateSchedule(client, schedule.id, { title, prompt, target, when, enabled }).catch(fail)
  }
  const runNow = async (schedule: Schedule) => {
    if (!client) return
    setBusy(schedule.id)
    try {
      await runSchedule(client, schedule.id)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text size="xs" color="textMuted">
          {t('schedules.hint')}
        </Text>
        <Button
          label={t('schedules.new')}
          variant="primary"
          icon={<Plus size={16} color={colors.accentInk} />}
          onPress={() => setEditing({ schedule: null })}
        />
        {loaded && schedules.length === 0 ? (
          <EmptyState title={t('schedules.empty')}>
            <Text color="textMuted">{t('schedules.emptyHint')}</Text>
          </EmptyState>
        ) : null}
        {sortSchedules(schedules).map((schedule) => {
          const attention = needsAttention(schedule)
          return (
            <Pressable
              key={schedule.id}
              accessibilityRole="button"
              accessibilityLabel={schedule.title}
              onPress={() => setEditing({ schedule })}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card>
                <View style={styles.head}>
                  <Text weight="bold" numberOfLines={1} style={styles.flex}>
                    {schedule.title}
                  </Text>
                  <Switch
                    value={schedule.enabled}
                    onValueChange={(enabled) => toggle(schedule, enabled)}
                    accessibilityLabel={t('schedules.enabled')}
                    trackColor={{ true: colors.accent, false: colors.borderStrong }}
                  />
                </View>
                <Text size="sm" color="textMuted" numberOfLines={1}>
                  {describeWhen(schedule.when, t, i18n.language)} ·{' '}
                  {describeTarget(schedule.target, sessions, profiles, t)}
                </Text>
                <Text size="xs" color="textDim" numberOfLines={1}>
                  {describeNext(schedule, t, i18n.language)}
                </Text>
                <View style={styles.runRow}>
                  <Text
                    size="xs"
                    color={attention ? 'warning' : 'textDim'}
                    numberOfLines={2}
                    style={styles.flex}
                  >
                    {describeRun(schedule.lastRun, t)}
                  </Text>
                  {attention ? (
                    <Button
                      label={t('schedules.runNow')}
                      compact
                      loading={busy === schedule.id}
                      onPress={() => void runNow(schedule)}
                    />
                  ) : null}
                </View>
              </Card>
            </Pressable>
          )
        })}
      </ScrollView>
      {editing ? <ScheduleEditorSheet schedule={editing.schedule} onClose={() => setEditing(null)} /> : null}
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  content: { padding: space.lg, gap: space.md },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  flex: { flex: 1 },
}))
