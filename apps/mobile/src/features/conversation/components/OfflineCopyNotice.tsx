import { CloudOff } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { makeStyles, space, useTheme } from '@/core/theme'
import { Text } from '@/ui'

/**
 * While the computer is not connected, says the conversation shown is the copy saved on the device
 * (the history cache), not a live one. Not in the offline demo, which is always "connected".
 */
export function OfflineCopyNotice({ hasEntries }: { hasEntries: boolean }) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const status = useConnectionStore((s) => s.status)
  const credentials = useConnectionStore((s) => s.credentials)
  if (!hasEntries || !credentials || status === 'open') return null
  return (
    <View style={styles.row} accessibilityRole="text">
      <CloudOff size={12} color={colors.textMuted} />
      <Text size="xs" color="textMuted" numberOfLines={1} style={styles.text}>
        {t('conversation.offlineCopy')}
      </Text>
    </View>
  )
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  text: { flexShrink: 1 },
}))
