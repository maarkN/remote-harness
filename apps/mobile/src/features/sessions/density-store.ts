import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'

const DENSITY_KEY = 'remote-harness.session-density'

/** Compact: today's rows. Expanded: rows also preview the session's last activity. */
export type SessionDensity = 'compact' | 'expanded'

/** How dense the session list is; per device, compact by default. */
export const useSessionDensityStore = create<{ density: SessionDensity }>(() => ({ density: 'compact' }))

/** Loads the persisted choice; called once at app start. */
export async function restoreSessionDensity(): Promise<void> {
  const saved = await SecureStore.getItemAsync(DENSITY_KEY).catch(() => null)
  if (saved === 'compact' || saved === 'expanded') useSessionDensityStore.setState({ density: saved })
}

export async function setSessionDensity(density: SessionDensity): Promise<void> {
  useSessionDensityStore.setState({ density })
  await SecureStore.setItemAsync(DENSITY_KEY, density).catch(() => undefined)
}
