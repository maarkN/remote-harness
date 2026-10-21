import { ExternalLink } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native'
import { useDaemonClient } from '@/core/connection'
import { space, useTheme } from '@/core/theme'
import { TAILSCALE_APP_SCHEME, TAILSCALE_STORES } from '@/features/pairing/setup-guide'
import { Button, EmptyState, Text } from '@/ui'

const TROUBLESHOOTING_URL = 'https://remoteharness.app/docs/troubleshooting'

const CHECKLIST_KEYS = ['computerAwake', 'tailscaleComputer', 'tailscalePhone', 'daemonRunning'] as const

/**
 * Shown in place of the session list (and the iPad detail pane) while the computer does not
 * answer at all: a checklist of what to check, plus actions, instead of an empty list with no
 * explanation (#326). `resumeNow()` retries immediately, skipping the backoff wait.
 */
export function UnreachableEmptyState() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const client = useDaemonClient()

  const openTailscale = () => {
    const store = Platform.OS === 'android' ? TAILSCALE_STORES.android : TAILSCALE_STORES.ios
    void Linking.openURL(TAILSCALE_APP_SCHEME).catch(() => Linking.openURL(store.url))
  }

  return (
    <EmptyState title={t('sessions.unreachable.title')}>
      <Text color="textMuted">{t('sessions.unreachable.body')}</Text>
      <View style={styles.checklist}>
        {CHECKLIST_KEYS.map((key, index) => (
          <View key={key} style={styles.item}>
            <Text size="sm" color="textDim" style={styles.index}>
              {index + 1}.
            </Text>
            <Text size="sm" color="textMuted" style={styles.itemText}>
              {t(`sessions.unreachable.checklist.${key}`)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          label={t('sessions.unreachable.tryAgain')}
          variant="primary"
          onPress={() => client?.resumeNow()}
        />
        <Button label={t('sessions.unreachable.openTailscale')} onPress={openTailscale} />
        <Button
          label={t('sessions.unreachable.troubleshooting')}
          variant="ghost"
          icon={<ExternalLink size={16} color={colors.textMuted} />}
          onPress={() => void Linking.openURL(TROUBLESHOOTING_URL)}
        />
      </View>
      <View style={styles.reconnecting}>
        <ActivityIndicator size="small" color={colors.textDim} />
        <Text size="sm" color="textDim">
          {t('connection.status.reconnecting')}
        </Text>
      </View>
    </EmptyState>
  )
}

const styles = StyleSheet.create({
  checklist: { gap: space.sm },
  item: { flexDirection: 'row', gap: space.xs },
  index: { width: 16 },
  itemText: { flex: 1 },
  actions: { gap: space.sm, alignItems: 'flex-start' },
  reconnecting: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
