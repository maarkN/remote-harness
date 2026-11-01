import { type ReactNode, useEffect } from 'react'
import { AppState } from 'react-native'
import { credentialsStorage } from '../storage/credentials'
import { wipeHistory } from '../storage/history'
import { setComputerStorage, useConnectionStore } from './connection-store'

// Forgetting a computer (also when it revoked this device) deletes its history cache with its keys.
setComputerStorage({
  ...credentialsStorage,
  remove: async (daemonId) => {
    await wipeHistory(daemonId).catch(() => undefined)
    return credentialsStorage.remove(daemonId)
  },
})

/** Loads the paired computers once and keeps the active one's socket alive across foreground/background. */
export function ConnectionProvider({ children }: { children: ReactNode }) {
  const loadComputers = useConnectionStore((s) => s.loadComputers)

  useEffect(() => {
    let cancelled = false
    Promise.all([credentialsStorage.loadAll(), credentialsStorage.dropLegacy().catch(() => false)])
      .then(([{ computers, active }, legacy]) => {
        if (cancelled) return
        loadComputers(computers, active)
        if (computers.length === 0 && legacy) useConnectionStore.setState({ pairAgain: true })
      })
      .catch(() => loadComputers([], null))
    return () => {
      cancelled = true
    }
  }, [loadComputers])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') useConnectionStore.getState().client?.resumeNow()
    })
    return () => subscription.remove()
  }, [])

  return children
}
