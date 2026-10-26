import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { noiseCrypto } from '@/core/crypto'
import { clearCommandRecents } from '@/features/autocomplete/recents-store'
import { clearAllDrafts } from '@/features/drafts/persistence'
import { deviceInfo } from '@/features/pairing/parse-pairing-url'
import { setHidden, setPinned, useSessionPrefsStore } from '@/features/sessions/prefs-store'
import type { DemoLabels } from './demo-daemon'
import { DemoServer } from './demo-socket'
import { demoComputer, withoutDemoSessions } from './fixtures'

let server: DemoServer | null = null
let unsubscribe: (() => void) | null = null

/**
 * Opens the offline demo: a demo computer with a key made for this run, connected through in-memory
 * sockets. It ends when the user leaves it or connects to a real computer (pairing one), and never
 * outlives the app process.
 */
export function startDemo(labels: DemoLabels): void {
  stopServer()
  const next = new DemoServer(noiseCrypto, {
    labels,
    daemonVersion: Constants.expoConfig?.version ?? '0.0.0',
    device: deviceInfo(Platform.OS, Platform.OS === 'ios' && Platform.isPad),
  })
  server = next
  useConnectionStore
    .getState()
    .enterDemo(demoComputer(next.publicKey, noiseCrypto.generateKeyPair()), next.socketFactory)
  unsubscribe = useConnectionStore.subscribe((state, previous) => {
    if (previous.demo && !state.demo) void endDemo()
  })
}

/** "Leave demo": back to the pairing screen, with nothing of the demo left on the device. */
export function leaveDemo(): void {
  useConnectionStore.getState().leaveDemo()
}

function stopServer(): void {
  unsubscribe?.()
  unsubscribe = null
  server?.dispose()
  server = null
}

/**
 * What the demo may have left on the device: drafts and command recents (the demo only starts with
 * no computer paired, so they are all the demo's) and the pinned or hidden demo sessions. The
 * sessions, transcripts and requests shown go with the computer change, as for any computer. A new
 * per-session store kept on the device belongs here too.
 */
async function endDemo(): Promise<void> {
  stopServer()
  const prefs = useSessionPrefsStore.getState()
  const kept = withoutDemoSessions(prefs)
  for (const id of prefs.pinned) if (!kept.pinned.includes(id)) await setPinned(id, false)
  for (const id of prefs.hidden) if (!kept.hidden.includes(id)) await setHidden(id, false)
  await clearAllDrafts()
  await clearCommandRecents()
}
