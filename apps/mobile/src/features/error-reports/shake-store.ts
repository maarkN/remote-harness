import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'

const KEY = 'remote-harness.shake-to-report'

/** Per device: whether shaking the phone offers "Report a problem" (on by default, #557). */
export const useShakeSettings = create<{ enabled: boolean }>(() => ({ enabled: true }))

/** Loads the saved choice; called once at app start. */
export async function restoreShakeSetting(): Promise<void> {
  const saved = await SecureStore.getItemAsync(KEY).catch(() => null)
  useShakeSettings.setState({ enabled: saved !== 'off' })
}

export async function setShakeEnabled(enabled: boolean): Promise<void> {
  useShakeSettings.setState({ enabled })
  await SecureStore.setItemAsync(KEY, enabled ? 'on' : 'off').catch(() => undefined)
}
