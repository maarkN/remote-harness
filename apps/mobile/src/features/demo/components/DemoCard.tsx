import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { space, useTheme } from '@/core/theme'
import { Button, Card, Text } from '@/ui'
import { leaveDemoToPairing } from './DemoBanner'

/** Settings → Demo: says the computer is fictional and leaves the demo (instead of Computers). */
export function DemoCard() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const demo = useConnectionStore((s) => s.demo)
  if (!demo) return null
  return (
    <Card accent={colors.accent}>
      <View style={styles.gap}>
        <Text weight="bold">{t('demo.cardTitle')}</Text>
        <Text size="sm" color="textMuted">
          {t('demo.cardBody')}
        </Text>
        <Button label={t('demo.leave')} variant="primary" compact onPress={leaveDemoToPairing} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({ gap: { gap: space.sm } })
