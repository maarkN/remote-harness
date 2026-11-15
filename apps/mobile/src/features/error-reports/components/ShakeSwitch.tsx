import { useTranslation } from 'react-i18next'
import { Switch, View } from 'react-native'
import { makeStyles, space, useTheme } from '@/core/theme'
import { Text } from '@/ui'
import { setShakeEnabled, useShakeSettings } from '../shake-store'

/** "Shake to report a problem" (on by default), next to "Report a problem" in Settings (#557). */
export function ShakeSwitch() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const enabled = useShakeSettings((s) => s.enabled)
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text size="sm">{t('errorReports.shake.setting')}</Text>
        <Text size="xs" color="textMuted">
          {t('errorReports.shake.settingHint')}
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={(value) => void setShakeEnabled(value)}
        accessibilityLabel={t('errorReports.shake.setting')}
        trackColor={{ true: colors.accent, false: colors.borderStrong }}
      />
    </View>
  )
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
}))
