import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg'
import { useTheme } from '@/core/theme'

type Weight = 'regular' | 'bold'

/**
 * Geometry of the mark in a 256 box (the same source as `scripts/icons.mts`): the width of the `>`
 * cut out of the cursor block and the width of the three arcs; bold widens both under 24 pt.
 */
const GEOMETRY: Record<Weight, { cutout: number; arcs: number }> = {
  regular: { cutout: 16, arcs: 22 },
  bold: { cutout: 24, arcs: 28 },
}
const CUTOUT = 'M51 104L79 128L51 152'
const ARCS = [
  'M123.6 104.9A36 36 0 0 1 123.6 151.1',
  'M154.2 79.1A76 76 0 0 1 154.2 176.9',
  'M184.9 53.4A116 116 0 0 1 184.9 202.6',
]

/**
 * The Remote Harness mark ("Cursor Signal": a terminal cursor block with the `>` prompt cut out of
 * it and three signal arcs leaving it to the right). Bold under 24 pt. Drawn in the accent text
 * color unless `color` says otherwise.
 */
export function Mark({
  size = 22,
  weight = size < 24 ? 'bold' : 'regular',
  color,
}: {
  size?: number
  weight?: Weight
  color?: string
}) {
  const { colors } = useTheme()
  const paint = color ?? colors.accentText
  const m = GEOMETRY[weight]
  const maskId = `rh-cursor-${weight}`
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessible={false}>
      <Defs>
        {/* Luminance mask: white keeps the block, the black prompt stroke cuts through it. */}
        <Mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={256} height={256}>
          <Rect width={256} height={256} fill="white" />
          <Path
            d={CUTOUT}
            stroke="black"
            strokeWidth={m.cutout}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Mask>
      </Defs>
      <Rect x={34} y={76} width={62} height={104} rx={13} fill={paint} mask={`url(#${maskId})`} />
      {ARCS.map((d) => (
        <Path key={d} d={d} stroke={paint} strokeWidth={m.arcs} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  )
}
