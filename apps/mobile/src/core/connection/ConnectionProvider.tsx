import { type ReactNode, useEffect } from 'react'
import { AppState } from 'react-native'
import { credentialsStorage } from '../storage/credentials'
import { useConnectionStore } from './connection-store'

/** Loads saved credentials once and keeps the socket alive across foreground/background. */
export function ConnectionProvider({ children }: { children: ReactNode }) {
  const setCredentials = useConnectionStore((s) => s.setCredentials)

  useEffect(() => {
    let cancelled = false
    Promise.all([credentialsStorage.load(), credentialsStorage.dropLegacy().catch(() => false)])
      .then(([credentials, legacy]) => {
        if (cancelled) return
        setCredentials(credentials)
        if (!credentials && legacy) useConnectionStore.setState({ pairAgain: true })
      })
      .catch(() => setCredentials(null))
    return () => {
      cancelled = true
    }
  }, [setCredentials])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') useConnectionStore.getState().client?.resumeNow()
    })
    return () => subscription.remove()
  }, [])

  return children
}
