import Svg, { Rect } from 'react-native-svg'
import type { AgentIconProps } from './types'

/** Placeholder mark for Gemini CLI — a plain rounded square, not Google's actual mark (see README). */
export function GeminiIcon({ size, color }: AgentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Rect x={5} y={5} width={14} height={14} rx={3} fill={color} />
    </Svg>
  )
}
