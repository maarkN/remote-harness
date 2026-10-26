import { useTranslation } from 'react-i18next'
import { Alert, RefreshControl, ScrollView, View } from 'react-native'
import { useDaemonClient } from '@/core/connection'
import { makeStyles, space, useTheme } from '@/core/theme'
import { relativeTime } from '@/core/utils/time'
import { Badge, type BadgeTone, Button, Card, Screen, Text } from '@/ui'
import { type ApprovalLabel, appRuleIds, approvalLabel, approvalSubject, undoableRuleId } from './rules'
import { useApprovals, useRules } from './use-rules'

const TONE: Record<ApprovalLabel, BadgeTone> = {
  allow: 'success',
  allowAlways: 'accent',
  deny: 'danger',
  undo: 'muted',
  delete: 'warning',
}

/**
 * Settings → Permissions → Activity: the daemon's approval log (last 30 days). An "allowed always"
 * entry keeps an Undo while its rule is still there.
 */
export function ActivityScreen() {
  const { t } = useTranslation()
  const styles = useStyles()
  const { colors } = useTheme()
  const client = useDaemonClient()
  const { entries, supported, error, refresh } = useApprovals()
  const rules = useRules()
  const ids = appRuleIds(rules.files ?? [])

  const refreshAll = () => {
    void refresh()
    void rules.refresh()
  }

  const confirmUndo = (ruleId: string, rule: string) => {
    Alert.alert(t('permissionRules.undoTitle'), rule, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('permissionRules.undo'),
        style: 'destructive',
        onPress: () => void rules.undo(ruleId).then(() => refresh()),
      },
    ])
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={colors.accent} />
        }
      >
        <Text size="xs" color="textMuted">
          {t('approvals.intro')}
        </Text>
        {!supported ? <Text color="textMuted">{t('permissionRules.unsupported')}</Text> : null}
        {supported && entries === null && !error && client ? (
          <Text color="textMuted">{t('permissionRules.loading')}</Text>
        ) : null}
        {entries?.length === 0 ? <Text color="textMuted">{t('approvals.empty')}</Text> : null}
        {error ? <Text color="danger">{error}</Text> : null}
        {entries && entries.length > 0 ? (
          <Card>
            {entries.map((entry) => {
              const label = approvalLabel(entry)
              const ruleId = undoableRuleId(entry, ids)
              const where = [entry.device?.name ?? t('approvals.thisComputer'), entry.folder].filter(Boolean)
              return (
                <View key={entry.id} style={styles.row}>
                  <View style={styles.flex}>
                    <View style={styles.title}>
                      <Badge label={t(`approvals.action.${label}`)} tone={TONE[label]} />
                      <Text size="sm" numberOfLines={1} style={styles.flex}>
                        {approvalSubject(entry)}
                      </Text>
                    </View>
                    <Text size="xs" color="textMuted" numberOfLines={1}>
                      {[...where, relativeTime(entry.at, t)].join(' · ')}
                    </Text>
                    {label === 'allowAlways' && entry.rule ? (
                      <Text size="xs" color="textDim" numberOfLines={1}>
                        {entry.rule}
                      </Text>
                    ) : null}
                  </View>
                  {ruleId && entry.rule ? (
                    <Button
                      label={t('permissionRules.undo')}
                      variant="ghost"
                      compact
                      onPress={() => confirmUndo(ruleId, entry.rule ?? '')}
                    />
                  ) : null}
                </View>
              )
            })}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  content: { padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, gap: 2 },
}))
