import * as Clipboard from 'expo-clipboard'
import Constants from 'expo-constants'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, StyleSheet, View } from 'react-native'
import { useLayout } from '@/core/layout'
import { space } from '@/core/theme'
import { Button, Card, Text } from '@/ui'
import { BENCH_HEADER, benchRow } from './bench'
import { useBenchStore } from './bench-store'

/**
 * Settings → Performance (this run): the numbers measured on this device since the app started, and a
 * Copy button that puts them in the before/after table format of the performance PRs.
 */
export function PerformanceNumbersCard() {
  const { t } = useTranslation()
  const { layout } = useLayout()
  const numbers = useBenchStore()
  const [copied, setCopied] = useState(false)
  const none = t('perfNumbers.notMeasured')
  const { stalls, scroll } = numbers

  const copy = async () => {
    const row = benchRow(numbers, {
      version: Constants.expoConfig?.version ?? '?',
      platform: `${Platform.OS} ${Platform.Version}`,
      layout,
    })
    const ok = await Clipboard.setStringAsync(`${BENCH_HEADER}\n${row}`).catch(() => false)
    setCopied(ok)
  }

  const rows: [string, string][] = [
    [
      t('perfNumbers.appReady'),
      numbers.appReadyMs === null ? none : t('perfNumbers.ms', { ms: numbers.appReadyMs }),
    ],
    [
      t('perfNumbers.stalls'),
      t('perfNumbers.stallsValue', { n: stalls.stalls, long: stalls.long_stalls, max: stalls.stall_max_ms }),
    ],
    [
      t('perfNumbers.render'),
      numbers.renders.length === 0
        ? none
        : numbers.renders
            .map((r) => t('perfNumbers.renderValue', { ms: r.ms, entries: r.entries }))
            .join('\n'),
    ],
    [
      t('perfNumbers.scroll'),
      scroll.frames === 0
        ? none
        : t('perfNumbers.scrollValue', {
            frames: scroll.frames,
            dropped: scroll.dropped,
            max: scroll.frame_max_ms,
          }),
    ],
  ]

  return (
    <Card>
      <View style={styles.gap}>
        <Text weight="bold">{t('perfNumbers.title')}</Text>
        <Text size="xs" color="textMuted">
          {t('perfNumbers.hint')}
        </Text>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text size="sm" style={styles.label}>
              {label}
            </Text>
            <Text size="sm" color="textMuted" style={styles.value}>
              {value}
            </Text>
          </View>
        ))}
        <Button
          label={copied ? t('perfNumbers.copied') : t('perfNumbers.copy')}
          onPress={() => void copy()}
        />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  label: { flex: 1 },
  value: { flex: 1, textAlign: 'right' },
})
