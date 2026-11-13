import { type ReactNode, useEffect, useRef, useState } from 'react'
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { type ColorName, useTheme } from '@/core/theme'
import { hasMoreRight, type SideScrollMetrics } from './side-scroll'

const FADE_WIDTH = 28

type Props = {
  children: ReactNode
  /** The background right behind the content, which the fade at the right edge turns into. */
  background?: ColorName
  /** For a sideways scroll inside a vertical one (tool output). */
  nestedScrollEnabled?: boolean
}

/**
 * Horizontal scroll that shows it scrolls: while content lies past the right edge, a fade there, and
 * the scroll indicator flashed the first time the content overflows (#544). Used by wide markdown
 * tables, code blocks and tool output whose columns matter.
 */
export function SideScroll({ children, background = 'background', nestedScrollEnabled }: Props) {
  const { colors } = useTheme()
  const scroll = useRef<ScrollView>(null)
  const [metrics, setMetrics] = useState<SideScrollMetrics>({ content: 0, view: 0, x: 0 })
  const more = hasMoreRight(metrics)
  const overflows = metrics.content - metrics.view > 1
  const [flashed, setFlashed] = useState(false)

  useEffect(() => {
    if (!overflows || flashed) return
    setFlashed(true)
    scroll.current?.flashScrollIndicators()
  }, [overflows, flashed])

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x
    setMetrics((m) => (m.x === x ? m : { ...m, x }))
  }

  return (
    <View>
      <ScrollView
        ref={scroll}
        horizontal
        nestedScrollEnabled={nestedScrollEnabled}
        showsHorizontalScrollIndicator
        persistentScrollbar
        scrollEventThrottle={32}
        onScroll={onScroll}
        onLayout={(event) => {
          const view = event.nativeEvent.layout.width
          setMetrics((m) => (m.view === view ? m : { ...m, view }))
        }}
        onContentSizeChange={(content) => setMetrics((m) => (m.content === content ? m : { ...m, content }))}
      >
        {/* The View avoids "Cannot add a child that doesn't have a YogaNode" (react-native#18773). */}
        <View>{children}</View>
      </ScrollView>
      {more ? (
        <View pointerEvents="none" style={styles.fade}>
          <Svg width={FADE_WIDTH} height="100%">
            <Defs>
              <LinearGradient id="side-scroll-fade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors[background]} stopOpacity={0} />
                <Stop offset="1" stopColor={colors[background]} stopOpacity={0.95} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#side-scroll-fade)" />
          </Svg>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, right: 0, bottom: 0, width: FADE_WIDTH },
})
