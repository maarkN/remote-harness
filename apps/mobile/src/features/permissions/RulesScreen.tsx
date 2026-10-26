import type { ListedRule, RuleFile } from '@remote-harness/protocol'
import { useTranslation } from 'react-i18next'
import { Alert, RefreshControl, ScrollView, View } from 'react-native'
import { confirmIdentity } from '@/core/auth/confirm-identity'
import { selectProfiles, useConnectionStore } from '@/core/connection'
import { makeStyles, space, useTheme } from '@/core/theme'
import { relativeTime, shortPath } from '@/core/utils/time'
import { Badge, Button, Card, Screen, Text } from '@/ui'
import { ruleFileTitle, sortRuleFiles } from './rules'
import { useRules } from './use-rules'

/**
 * Settings → Permissions → Rules: the computer's always-allow rules by file. App-created rules can
 * be undone; hand-written ones are read-only except Delete, behind the device's biometrics.
 */
export function RulesScreen() {
  const { t } = useTranslation()
  const styles = useStyles()
  const { colors } = useTheme()
  const profiles = useConnectionStore(selectProfiles)
  const { files, supported, error, refresh, undo, remove } = useRules()

  const confirmUndo = (rule: Extract<ListedRule, { origin: 'app' }>) => {
    Alert.alert(t('permissionRules.undoTitle'), rule.rule, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('permissionRules.undo'), style: 'destructive', onPress: () => void undo(rule.ruleId) },
    ])
  }

  const confirmDelete = (file: RuleFile, rule: string) => {
    Alert.alert(
      t('permissionRules.deleteTitle'),
      t('permissionRules.deleteBody', { rule, file: shortPath(file.file) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('permissionRules.delete'),
          style: 'destructive',
          onPress: () => {
            void confirmIdentity(t('permissionRules.identityPrompt'), t('common.cancel')).then((ok) => {
              if (ok) void remove(file.file, rule)
            })
          },
        },
      ],
    )
  }

  const sorted = files ? sortRuleFiles(files, profiles) : []
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={colors.accent} />
        }
      >
        <Text size="xs" color="textMuted">
          {t('permissionRules.intro')}
        </Text>
        {!supported ? <Text color="textMuted">{t('permissionRules.unsupported')}</Text> : null}
        {supported && files === null && !error ? (
          <Text color="textMuted">{t('permissionRules.loading')}</Text>
        ) : null}
        {files?.length === 0 ? <Text color="textMuted">{t('permissionRules.empty')}</Text> : null}
        {error ? <Text color="danger">{error}</Text> : null}
        {sorted.map((file) => (
          <Card key={file.file}>
            <View style={styles.header}>
              <View style={styles.flex}>
                <Text weight="bold" numberOfLines={1}>
                  {shortPath(ruleFileTitle(file, profiles))}
                </Text>
                <Text size="xs" color="textDim" numberOfLines={1}>
                  {shortPath(file.file)}
                </Text>
              </View>
              <Badge
                label={t(`permissionRules.scope.${file.scope}`)}
                tone={file.scope === 'project' ? 'info' : 'accent'}
              />
            </View>
            {file.rules.map((rule) => (
              <View key={rule.rule} style={styles.row}>
                <View style={styles.flex}>
                  <Text size="sm" selectable>
                    {rule.rule}
                  </Text>
                  <Text size="xs" color="textMuted">
                    {rule.origin === 'app'
                      ? t('permissionRules.fromApp', { when: relativeTime(rule.createdAt, t) })
                      : t('permissionRules.handWritten')}
                  </Text>
                </View>
                {rule.origin === 'app' ? (
                  <Button
                    label={t('permissionRules.undo')}
                    variant="ghost"
                    compact
                    onPress={() => confirmUndo(rule)}
                  />
                ) : (
                  <Button
                    label={t('permissionRules.delete')}
                    variant="ghost"
                    compact
                    onPress={() => confirmDelete(file, rule.rule)}
                  />
                )}
              </View>
            ))}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  content: { padding: space.lg, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  flex: { flex: 1, gap: 2 },
}))
