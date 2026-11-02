import { create } from 'zustand'
import type { Phase } from './engine'

type HandsFreeStore = {
  /** The session hands-free is on for (one at a time), `null` when it is off. */
  sessionId: string | null
  phase: Phase
  /** Last sentence spoken, shown large in the bar. */
  lastSaid: string
  /** Set by the runner while hands-free is on; no-ops otherwise. */
  talk(): void
  repeat(): void
  /** Turns hands-free on for `sessionId`, off for the session it was on for. */
  start(sessionId: string): void
  stop(): void
}

const noop = () => undefined

/**
 * Hands-free lives here, not in the session screen, so it keeps running when the user leaves the
 * screen or locks the phone (#446): `HandsFreeRunner` (root layout) runs the engine for `sessionId`
 * and mirrors its state here; the session screen only shows the bar when its session is the one.
 */
export const useHandsFreeStore = create<HandsFreeStore>((set) => ({
  sessionId: null,
  phase: 'idle',
  lastSaid: '',
  talk: noop,
  repeat: noop,
  start: (sessionId) => set({ sessionId, phase: 'idle', lastSaid: '' }),
  stop: () => set({ sessionId: null, phase: 'idle', lastSaid: '', talk: noop, repeat: noop }),
}))
