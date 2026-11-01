import { router } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { makeStyles, space, useTheme } from '@/core/theme'
import { useTemplatesStore } from '@/features/templates/store'
import { Card, Text } from '@/ui'

/** Settings → Prompt templates: opens the templates screen; the count is shown once there are some. */
export function TemplatesCard() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const count = useTemplatesStore((s) => s.templates.length)
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/templates')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.flex}>
          <Text weight="bold">{t('settings.templates')}</Text>
          <Text size="xs" color="textMuted">
            {t('settings.templatesHint')}
          </Text>
          {count > 0 ? (
            <Text size="xs" color="textDim">
              {t('templates.count', { count })}
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
