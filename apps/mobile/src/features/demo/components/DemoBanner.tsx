import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { space, useTheme } from '@/core/theme'
import { Text } from '@/ui'
import { leaveDemo } from '../demo-mode'

/** Leaves the offline demo and shows the pairing screen. */
export function leaveDemoToPairing(): void {
  leaveDemo()
  router.replace('/pair')
}

/** Thin strip on the main screens while the offline demo runs, with the way out. */
export function DemoBanner() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const demo = useConnectionStore((s) => s.demo)
  if (!demo) return null
  return (
    <View style={[styles.base, { backgroundColor: colors.accentSoft }]}>
      <Text size="xs" color="accentText" style={styles.text}>
        {t('demo.banner')}
      </Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={leaveDemoToPairing}>
        <Text size="xs" weight="bold" color="accentText">
          {t('demo.leave')}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
  },
  text: { flex: 1 },
})
