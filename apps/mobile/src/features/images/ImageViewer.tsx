import type { ImageRef } from '@remote-harness/protocol'
import { X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Image, type LayoutChangeEvent, Modal, PixelRatio, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import { makeStyles, space, useTheme } from '@/core/theme'
import { IconButton, Text } from '@/ui'
import { fitImage, type Size } from './fit'
import { useTranscriptImage } from './use-transcript-image'

const MAX_SCALE = 5
const DOUBLE_TAP_SCALE = 2.5

/**
 * Full-screen image with pinch zoom, pan while zoomed and double tap (1x / 2.5x). A single tap while
 * not zoomed, the close button or the Android back button closes it. The image gets a view of its own
 * pixel size, fitted to the stage by a base scale, so React Native decodes it whole and zoom shows image
 * pixels, not screen pixels (#476).
 */
export function ImageViewer({
  image,
  index,
  count,
  onClose,
}: {
  image: ImageRef
  index: number
  count: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const styles = useStyles()
  const { state } = useTranscriptImage(image)
  const uri = state.status === 'ready' ? state.uri : null
  const [natural, setNatural] = useState<Size | null>(null)
  const [stage, setStage] = useState<Size | null>(null)
  const fit = fitImage(natural, stage, PixelRatio.get())

  useEffect(() => {
    if (!uri) return
    let alive = true
    Image.getSize(
      uri,
      (width, height) => alive && setNatural({ width, height }),
      // Unknown size: the image keeps the stage's size, as before.
      () => alive && setNatural(null),
    )
    return () => {
      alive = false
    }
  }, [uri])

  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const base = useSharedValue(1)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const savedX = useSharedValue(0)
  const savedY = useSharedValue(0)

  useEffect(() => {
    base.value = fit?.baseScale ?? 1
  }, [base, fit?.baseScale])

  const reset = () => {
    'worklet'
    scale.value = withTiming(1)
    savedScale.value = 1
    x.value = withTiming(0)
    y.value = withTiming(0)
    savedX.value = 0
    savedY.value = 0
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale))
    })
    .onEnd(() => {
      if (scale.value <= 1.01) reset()
      else savedScale.value = scale.value
    })
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value <= 1) return
      x.value = savedX.value + e.translationX
      y.value = savedY.value + e.translationY
    })
    .onEnd(() => {
      savedX.value = x.value
      savedY.value = y.value
    })
  // A short swipe or pinch must not count as a tap.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(10)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset()
        return
      }
      scale.value = withTiming(DOUBLE_TAP_SCALE)
      savedScale.value = DOUBLE_TAP_SCALE
    })
  const singleTap = Gesture.Tap()
    .maxDistance(10)
    .onEnd(() => {
      if (savedScale.value <= 1) scheduleOnRN(onClose)
    })
  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap))

  const transform = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: base.value * scale.value }],
  }))

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setStage((current) =>
      current?.width === width && current?.height === height ? current : { width, height },
    )
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* Gestures inside a Modal need their own root view on Android. */}
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={gesture}>
          <View style={styles.stage} onLayout={onStageLayout}>
            {uri ? (
              <Animated.Image
                source={{ uri }}
                style={[fit ? { width: fit.width, height: fit.height } : styles.fill, transform]}
                resizeMode="contain"
                accessible
                accessibilityRole="image"
                accessibilityLabel={t('images.viewer', { index: index + 1, count })}
                accessibilityHint={t('images.zoomHint')}
              />
            ) : state.status === 'loading' ? (
              <ActivityIndicator color={colors.text} accessibilityLabel={t('images.loading')} />
            ) : (
              <Text color="textMuted">
                {state.status === 'tooLarge' ? t('images.tooLargeShort') : t('images.failed')}
              </Text>
            )}
          </View>
        </GestureDetector>
        <View style={[styles.close, { top: insets.top + space.sm, right: insets.right + space.sm }]}>
          <IconButton icon={X} label={t('images.close')} color="text" size={24} onPress={onClose} />
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const useStyles = makeStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.scrim },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  close: { position: 'absolute', padding: space.xs },
}))
