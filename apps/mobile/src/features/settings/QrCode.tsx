import { useMemo } from 'react'
import { View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { qrPath } from './qr'

/** A scannable QR code: always dark on light, whatever the theme (scanners need the contrast). */
export function QrCode({ value, size }: { value: string; size: number }) {
  const qr = useMemo(() => qrPath(value), [value])
  return (
    <View accessibilityRole="image" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${qr.size} ${qr.size}`}>
        <Rect x={0} y={0} width={qr.size} height={qr.size} fill="white" />
        <Path d={qr.d} fill="black" />
      </Svg>
    </View>
  )
}
