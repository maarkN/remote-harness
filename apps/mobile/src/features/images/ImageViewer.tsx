import type { ImageRef } from '@remote-harness/protocol'
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Image,
  type LayoutChangeEvent,
  Modal,
  PixelRatio,
  Pressable,
  ScrollView,
  View,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import { makeStyles, radius, space, useTheme } from '@/core/theme'
import { IconButton, Text } from '@/ui'
import { fitImage, type Size } from './fit'
import { nextIndex, previousIndex, swipeTarget } from './gallery'
import { useTranscriptImage } from './use-transcript-image'

const MAX_SCALE = 5
const DOUBLE_TAP_SCALE = 2.5
const THUMB = 56

/**
 * Full-screen gallery of a message's images (#478): pinch zoom, pan while zoomed and double tap
 * (1x / 2.5x) on the current one; a horizontal swipe at 1x, a tap on a thumbnail of the strip at the
 * bottom or the Previous / Next buttons move to the neighbors, with the counter following and the
 * zoom reset. A single tap while not zoomed, the close button or the Android back button closes it.
 * The image gets a view of its own pixel size, fitted to the stage by a base scale, so React Native
 * decodes it whole and zoom shows image pixels, not screen pixels (#476).
 */
export function ImageViewer({
  images,
  initialIndex,
  onClose,
}: {
  images: readonly ImageRef[]
  initialIndex: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const styles = useStyles()
  const count = images.length
  const [index, setIndex] = useState(Math.min(Math.max(0, initialIndex), count - 1))
  const image = images[index] ?? images[0]
  const { state } = useTranscriptImage(image ?? { id: '', bytes: 0, mediaType: 'image/png' })
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
  const stageWidth = useSharedValue(0)

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

  /** Shows another image of the message at 1x. */
  const go = (target: number) => {
    if (target === index || target < 0 || target >= count) return
    setNatural(null)
    setIndex(target)
    reset()
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale))
    })
    .onEnd(() => {
      if (scale.value <= 1.01) reset()
      else savedScale.value = scale.value
    })
  // Zoomed: the pan moves the image. At 1x it slides it sideways and, released far or fast enough,
  // shows the previous or next image of the message.
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        x.value = savedX.value + e.translationX
        y.value = savedY.value + e.translationY
        return
      }
      x.value = count > 1 ? e.translationX : 0
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        savedX.value = x.value
        savedY.value = y.value
        return
      }
      const target = swipeTarget(e.translationX, e.velocityX, index, count, stageWidth.value)
      x.value = withTiming(0)
      if (target !== index) scheduleOnRN(go, target)
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
    stageWidth.value = width
    setStage((current) =>
      current?.width === width && current?.height === height ? current : { width, height },
    )
  }

  const counter = t('images.viewer', { index: index + 1, count })
  const hint = count > 1 ? `${t('images.zoomHint')}. ${t('images.swipeHint')}` : t('images.zoomHint')
  const bottom = insets.bottom + space.sm

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
                accessibilityLabel={counter}
                accessibilityHint={hint}
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
        {count > 1 ? (
          <View style={[styles.bar, { paddingBottom: bottom }]} pointerEvents="box-none">
            <View style={styles.nav}>
              <IconButton
                icon={ChevronLeft}
                label={t('images.previous')}
                color="text"
                size={24}
                disabled={index === 0}
                onPress={() => go(previousIndex(index, count))}
              />
              <Text size="sm" color="text" accessibilityLiveRegion="polite">
                {counter}
              </Text>
              <IconButton
                icon={ChevronRight}
                label={t('images.next')}
                color="text"
                size={24}
                disabled={index === count - 1}
                onPress={() => go(nextIndex(index, count))}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbs}
            >
              {images.map((item, i) => (
                <GalleryThumb
                  key={item.id}
                  image={item}
                  label={t('images.thumbnail', { index: i + 1, count })}
                  selected={i === index}
                  onPress={() => go(i)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  )
}

/** One image of the strip at the bottom: from the same cache and fetch queue as the conversation's thumbnails. */
function GalleryThumb({
  image,
  label,
  selected,
  onPress,
}: {
  image: ImageRef
  label: string
  selected: boolean
  onPress: () => void
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const { state } = useTranscriptImage(image)
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.thumb, selected && styles.thumbSelected]}
    >
      {state.status === 'ready' ? (
        <Image source={{ uri: state.uri }} style={styles.fill} resizeMode="cover" />
      ) : state.status === 'loading' ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : null}
    </Pressable>
  )
}

const useStyles = makeStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.scrim },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  close: { position: 'absolute', padding: space.xs },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: space.xs },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  thumbs: { paddingHorizontal: space.md, gap: space.xs },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.colors.surfaceRaised,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbSelected: { borderColor: theme.colors.accent },
}))
