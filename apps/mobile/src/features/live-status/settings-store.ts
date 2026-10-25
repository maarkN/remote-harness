import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'

const LIVE_STATUS_KEY = 'remote-harness.live-status'
const LIVE_TASK_KEY = 'remote-harness.live-status-task'

type LiveStatusSettings = {
  enabled: boolean
  /** Send the in-progress todo item through push and show it on the lock screen (opt-in). */
  showTask: boolean
}

/** Whether running sessions get a live status on the lock screen (per device, on by default). */
export const useLiveStatusSettings = create<LiveStatusSettings>(() => ({ enabled: true, showTask: false }))

/** Loads the persisted choices; called once at app start. */
export async function restoreLiveStatusSetting(): Promise<void> {
  const [saved, task] = await Promise.all([
    SecureStore.getItemAsync(LIVE_STATUS_KEY).catch(() => null),
    SecureStore.getItemAsync(LIVE_TASK_KEY).catch(() => null),
  ])
  useLiveStatusSettings.setState({ enabled: saved !== 'off', showTask: task === 'on' })
}

export async function setLiveStatusEnabled(enabled: boolean): Promise<void> {
  useLiveStatusSettings.setState({ enabled })
  await SecureStore.setItemAsync(LIVE_STATUS_KEY, enabled ? 'on' : 'off').catch(() => undefined)
}

export async function setLiveStatusShowTask(showTask: boolean): Promise<void> {
  useLiveStatusSettings.setState({ showTask })
  await SecureStore.setItemAsync(LIVE_TASK_KEY, showTask ? 'on' : 'off').catch(() => undefined)
}
