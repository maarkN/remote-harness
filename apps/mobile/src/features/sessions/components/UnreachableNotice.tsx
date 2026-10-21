import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { useDaemonClient } from '@/core/connection'
import { space } from '@/core/theme'
import { relativeTime } from '@/core/utils/time'
import { Button, Text } from '@/ui'

/**
 * Compact notice above a still-visible, now-stale session list, instead of the full checklist
 * empty state: the `ConnectionBanner` above already explains the computer isn't answering (#326).
 */
export function UnreachableNotice({ lastFetchedAt }: { lastFetchedAt: string }) {
  const { t } = useTranslation()
  const client = useDaemonClient()
  return (
    <View style={styles.base}>
      <Text size="xs" color="textDim" style={styles.text}>
        {t('sessions.offlineList', { time: relativeTime(lastFetchedAt, t) })}
      </Text>
      <Button
        label={t('sessions.unreachable.tryAgain')}
        variant="ghost"
        compact
        onPress={() => client?.resumeNow()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.xs,
  },
  text: { flex: 1 },
})
