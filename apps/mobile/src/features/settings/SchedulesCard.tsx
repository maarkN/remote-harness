import { router } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { makeStyles, space, useTheme } from '@/core/theme'
import { useSchedulesStore } from '@/features/schedules/store'
import { Card, Text } from '@/ui'

/** Settings → Scheduled prompts (#432): opens the schedules screen; only on daemons that keep schedules. */
export function SchedulesCard() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const supported = useSchedulesStore((s) => s.supported)
  const count = useSchedulesStore((s) => s.schedules.length)
  if (!supported) return null
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/schedules')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.flex}>
          <Text weight="bold">{t('settings.schedules')}</Text>
          <Text size="xs" color="textMuted">
            {t('settings.schedulesHint')}
          </Text>
          {count > 0 ? (
            <Text size="xs" color="textDim">
              {t('schedules.count', { count })}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={colors.textDim} />
      </Pressable>
    </Card>
  )
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pressed: { opacity: 0.7 },
  flex: { flex: 1, gap: 2 },
}))
