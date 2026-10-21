import Svg, { Path } from 'react-native-svg'
import { CLAUDE_PATH } from './paths'
import type { AgentIconProps } from './types'

/** Claude Code's spark, the glyph it shows in the terminal (same path as the landing's mark). */
export function ClaudeIcon({ size, color }: AgentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d={CLAUDE_PATH} fill={color} />
    </Svg>
  )
}
