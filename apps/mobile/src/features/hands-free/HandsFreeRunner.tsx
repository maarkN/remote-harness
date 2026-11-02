import { useEffect } from 'react'
import { useHandsFreeStore } from './store'
import { useHandsFree } from './use-hands-free'

/**
 * Runs hands-free for the session in the store wherever the user is in the app, so it survives
 * leaving the session screen and locking the phone (#446). Mounted once in the root layout; renders
 * nothing. The bar (`HandsFreeSession`) reads the state and controls mirrored into the store.
 */
export function HandsFreeRunner() {
  const sessionId = useHandsFreeStore((s) => s.sessionId)
  const stop = useHandsFreeStore((s) => s.stop)
  const handsFree = useHandsFree(sessionId ?? '', sessionId !== null, stop)
  const { phase, lastSaid, talk, repeat } = handsFree
  useEffect(() => {
    if (useHandsFreeStore.getState().sessionId === null) return
    useHandsFreeStore.setState({ phase, lastSaid, talk, repeat })
  }, [phase, lastSaid, talk, repeat])
  return null
}
