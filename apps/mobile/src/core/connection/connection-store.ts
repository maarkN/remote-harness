import { create } from 'zustand'
import { noiseCrypto } from '../crypto'
import type { Computer } from '../storage/credentials'
import { type ConnectionStatus, DaemonClient, type Hello } from './daemon-client'

type ConnectionState = {
  credentials: Computer | null
  /** A protocol-1 pairing was found and dropped: the pairing screen says to pair again. */
  pairAgain: boolean
  /** False until SecureStore has been read once. */
  credentialsLoaded: boolean
  client: DaemonClient | null
  status: ConnectionStatus
  error: string | undefined
  /** The last attempt got no answer: the computer may be asleep or offline. */
  unreachable: boolean
  hello: Hello | null
  /** Starts (or restarts) the connection for the given computer; null disconnects. */
  setCredentials(credentials: Computer | null): void
}

/** Global connection state. Feature stores subscribe to `client` for their messages. */
export const useConnectionStore = create<ConnectionState>((set, get) => ({
  credentials: null,
  pairAgain: false,
  credentialsLoaded: false,
  client: null,
  status: 'idle',
  error: undefined,
  unreachable: false,
  hello: null,
  setCredentials(credentials) {
    get().client?.close()
    if (!credentials) {
      set({
        credentials: null,
        credentialsLoaded: true,
        client: null,
        status: 'idle',
        hello: null,
        error: undefined,
        unreachable: false,
      })
      return
    }
    const client = new DaemonClient({
      computer: credentials,
      crypto: noiseCrypto,
      clientName: 'claude-remote-ios',
    })
    client.onStatus((status, error) => set({ status, error, unreachable: client.unreachable }))
    client.onReady((hello) => set({ hello }))
    set({
      credentials,
      pairAgain: false,
      credentialsLoaded: true,
      client,
      status: client.status,
      hello: null,
      error: undefined,
      unreachable: false,
    })
    client.connect()
  },
}))

export function getClient(): DaemonClient | null {
  return useConnectionStore.getState().client
}

const NO_PROFILES: Hello['profiles'] = []

/** Stable selector: returns the same empty array until the daemon says hello (avoids render loops). */
export function selectProfiles(s: ConnectionState): Hello['profiles'] {
  return s.hello?.profiles ?? NO_PROFILES
}
