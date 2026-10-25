import {
  getAppIconName,
  resetAppIcon,
  setAlternateAppIcon,
  supportsAlternateIcons,
} from 'expo-alternate-app-icons'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useRef } from 'react'
import { AppState, Platform } from 'react-native'
import { create } from 'zustand'
import { resolveThemeName, useThemeStore } from '@/core/theme'
import { type AppIconPreference, iconToApply, isAppIconPreference } from './app-icon'

const KEY = 'remote-harness.app-icon'

export const useAppIconStore = create<{
  preference: AppIconPreference
  /** Whether the saved preference has been read (saved or not); `preference` is a default until then. */
  restored: boolean
}>(() => ({
  preference: 'matchTheme',
  restored: false,
}))

/** Loads the saved preference; called once at app start. */
export async function restoreAppIconPreference(): Promise<void> {
  const saved = await SecureStore.getItemAsync(KEY).catch(() => null)
  useAppIconStore.setState(
    isAppIconPreference(saved) ? { preference: saved, restored: true } : { restored: true },
  )
}

export async function setAppIconPreference(preference: AppIconPreference): Promise<void> {
  useAppIconStore.setState({ preference })
  await SecureStore.setItemAsync(KEY, preference).catch(() => undefined)
}

async function applyIcon(name: string | null): Promise<void> {
  try {
    if (name === null) await resetAppIcon()
    else await setAlternateAppIcon(name)
  } catch {
    // Unsupported device/OS version, or the user dismissed iOS's confirmation — nothing to recover.
  }
}

/**
 * Applies the preference to the real app icon (root layout, once). iOS shows a system alert on
 * every change, so it only ever applies right when the preference or the resolved theme changes —
 * never on a timer or in the background, and never from the defaults before both saved preferences
 * are read (#345). Android instead waits for the app to background, since the launcher can take a
 * moment and may close the app on some devices (#233).
 */
export function useApplyAppIcon(): void {
  const preference = useAppIconStore((s) => s.preference)
  const iconRestored = useAppIconStore((s) => s.restored)
  const themeRestored = useThemeStore((s) => s.restored)
  const resolvedTheme = useThemeStore((s) => resolveThemeName(s.preference, s.system))
  const restored = iconRestored && themeRestored
  /** The icon this launch asked the system for. */
  const requested = useRef<string | null | undefined>(undefined)
  const pendingAndroid = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!supportsAlternateIcons || !restored) return
    const next = iconToApply({
      restored,
      preference,
      resolvedTheme,
      current: getAppIconName(),
      requested: requested.current,
    })
    if (Platform.OS === 'android') {
      // Waits for the background; going back to the icon already showing cancels a pending change.
      pendingAndroid.current = next
      return
    }
    if (next === undefined) return
    requested.current = next
    void applyIcon(next)
  }, [restored, preference, resolvedTheme])

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return
      const target = pendingAndroid.current
      if (target === undefined || target === getAppIconName()) return
      pendingAndroid.current = undefined
      requested.current = target
      void applyIcon(target)
    })
    return () => subscription.remove()
  }, [])
}
