import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { Accelerometer } from 'expo-sensors'
import { Bug } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { captureScreen } from 'react-native-view-shot'
import { makeStyles, radius, space, useTheme } from '@/core/theme'
import { Text } from '@/ui'
import { addAttachment } from '../draft-store'
import { createShakeDetector } from '../shake'
import { useShakeSettings } from '../shake-store'
import { fileSize } from '../upload'

/** How long the button stays after a shake. */
const VISIBLE_MS = 6000
/** 20 samples a second are enough to see a shake. */
const SAMPLE_INTERVAL_MS = 50

/** Two frames: the button is gone from the screen before it is captured. */
const nextFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

/**
 * Shake to report (#557): in release builds, with the setting on and the app in the foreground, a
 * shake shows "Report a problem" for a few seconds; tapping it captures the screen without the
 * button and opens the report with that screenshot. Development builds keep the dev menu.
 */
export function ShakeToReport() {
  const enabled = useShakeSettings((s) => s.enabled)
  const [active, setActive] = useState(AppState.currentState === 'active')
  const [visible, setVisible] = useState(false)
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (__DEV__ || !enabled || !active) return
    let subscription: { remove(): void } | null = null
    let cancelled = false
    const shaken = createShakeDetector()
    void Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return
        Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS)
        subscription = Accelerometer.addListener((sample) => {
          if (!shaken(sample, Date.now())) return
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          setVisible(true)
          clearTimeout(hide.current)
          hide.current = setTimeout(() => setVisible(false), VISIBLE_MS)
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      subscription?.remove()
    }
  }, [enabled, active])

  useEffect(() => () => clearTimeout(hide.current), [])

  const report = async () => {
    clearTimeout(hide.current)
    setVisible(false)
    await nextFrames()
    try {
      const uri = await captureScreen({ format: 'jpg', quality: 0.8, result: 'tmpfile' })
      addAttachment({ kind: 'screenshot', uri, name: 'screenshot.jpg', size: fileSize(uri) })
    } catch {
      // The report opens without the screenshot.
    }
    router.push('/report')
  }

  return visible ? <ReportButton onPress={() => void report()} /> : null
}

function ReportButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('errorReports.shake.button')}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom: insets.bottom + space.lg, opacity: pressed ? 0.85 : 1 }]}
    >
      <Bug size={18} color={colors.accentInk} strokeWidth={2.25} />
      <Text size="sm" weight="bold" color="accentInk">
        {t('errorReports.shake.button')}
      </Text>
    </Pressable>
  )
}

const useStyles = makeStyles((theme) => ({
  fab: {
    position: 'absolute',
    left: space.lg,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
}))
