import type { ReactElement } from 'react'
import { Platform } from 'react-native'

type HeaderActionsOptions =
  | {
      unstable_headerRightItems: () => Array<{
        type: 'custom'
        element: ReactElement
        hidesSharedBackground: boolean
      }>
    }
  | { headerRight: () => ReactElement | null }

/**
 * Stack options that render `element` on the right of the header. On iOS 26+ bar buttons share a
 * light "liquid glass" capsule that hides the terminal-colored icons, so the shared background is
 * turned off (older iOS versions ignore the flag). The native items API is iOS-only: elsewhere the
 * element goes through the classic `headerRight`, or the header would show nothing.
 */
export function headerActions(element: ReactElement | null): HeaderActionsOptions {
  if (Platform.OS !== 'ios') return { headerRight: () => element }
  return {
    unstable_headerRightItems: () =>
      element ? [{ type: 'custom', element, hidesSharedBackground: true }] : [],
  }
}
