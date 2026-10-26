import { CHANNEL_CLOSE, type DaemonPaths } from '@remote-harness/protocol'
import { create } from 'zustand'
import { noiseCrypto } from '../crypto'
import { type Computer, withPaths } from '../storage/computer'
import {
  type ConnectionPath,
  type ConnectionStatus,
  DaemonClient,
  type Hello,
  type SocketFactory,
} from './daemon-client'

/** Where computers are saved: SecureStore in the app (`ConnectionProvider`), memory in tests. */
export type ComputerStorage = {
  save(computer: Computer, activate?: boolean): Promise<void>
  activate(daemonId: string): Promise<void>
  /** Returns the computer active afterwards. */
  remove(daemonId: string): Promise<string | null>
}

const memoryStorage: ComputerStorage = {
  save: async () => undefined,
  activate: async () => undefined,
  remove: async () => null,
}
let credentialsStorage: ComputerStorage = memoryStorage

export function setComputerStorage(storage: ComputerStorage): void {
  credentialsStorage = storage
}

type ConnectionState = {
  /** Every paired computer, most recently used first. */
  computers: Computer[]
  /** The active computer's daemon ID. */
  activeId: string | null
  /** The active computer (null when nothing is paired). */
  credentials: Computer | null
  /** A protocol-1 pairing was found and dropped: the pairing screen says to pair again. */
  pairAgain: boolean
  /** The name of a computer that revoked this device, shown once on the next screen. */
  revokedFrom: string | null
  /** False until SecureStore has been read once. */
  credentialsLoaded: boolean
  /** The active computer is the offline demo's (in memory only, never saved). */
  demo: boolean
  client: DaemonClient | null
  status: ConnectionStatus
  error: string | undefined
  /** The last attempt got no answer: the computer may be asleep or offline. */
  unreachable: boolean
  /** Direct or relay, while connected. */
  path: ConnectionPath | null
  hello: Hello | null
  /** The computers read from SecureStore at start. */
  loadComputers(computers: Computer[], activeId: string | null): void
  /** A newly paired computer: saved, added (or replaced) and made active. */
  addComputer(computer: Computer): Promise<void>
  /** Connects to another paired computer. */
  selectComputer(daemonId: string): Promise<void>
  /** Deletes a computer's keys; the next one becomes active, or none. */
  forgetComputer(daemonId: string): Promise<void>
  /** Renames a computer on this device (null: back to its host name). */
  renameComputer(daemonId: string, alias: string | null): Promise<void>
  dismissRevoked(): void
  /** Starts (or restarts) the connection for the given computer; null disconnects. */
  setCredentials(credentials: Computer | null): void
  /**
   * Connects to the offline demo's computer through its in-memory sockets. Nothing is saved and the
   * paired computers are left alone; any other connection (pairing, switching) ends the demo.
   */
  enterDemo(computer: Computer, socketFactory: SocketFactory): void
  /** Closes the demo connection: back to no computer (the pairing screen). */
  leaveDemo(): void
}

/** The display name of a computer: its alias, else the name it was paired with. */
export function computerName(computer: Pick<Computer, 'alias' | 'name'>): string {
  return computer.alias?.trim() || computer.name
}

/** Global connection state. Feature stores subscribe to `client` for their messages. */
export const useConnectionStore = create<ConnectionState>((set, get) => {
  /** Saves new paths the daemon announced for a computer. */
  const notePaths = (daemonId: string, paths: DaemonPaths | undefined) => {
    if (!paths) return
    const current = get().computers.find((c) => c.daemonId === daemonId)
    if (!current) return
    const next = withPaths(current, paths)
    if (next === current) return
    replace(next)
    get().client?.updateTarget(next)
    void credentialsStorage.save(next).catch(() => undefined)
  }
  const replace = (computer: Computer) =>
    set((state) => ({
      computers: state.computers.map((c) => (c.daemonId === computer.daemonId ? computer : c)),
      credentials: state.credentials?.daemonId === computer.daemonId ? computer : state.credentials,
    }))

  const connect = (computer: Computer | null, demo?: { socketFactory: SocketFactory }) => {
    get().client?.close()
    if (!computer) {
      set({
        demo: false,
        credentials: null,
        activeId: null,
        credentialsLoaded: true,
        client: null,
        status: 'idle',
        path: null,
        hello: null,
        error: undefined,
        unreachable: false,
      })
      return
    }
    const client = new DaemonClient({
      computer,
      crypto: noiseCrypto,
      clientName: 'claude-remote-ios',
      ...(demo ? { socketFactory: demo.socketFactory } : {}),
    })
    client.onStatus((status, error) => {
      set({ status, error, unreachable: client.unreachable })
      // This device was revoked from another one: that computer is gone for it.
      if (
        status === 'unauthorized' &&
        client.closeCode === CHANNEL_CLOSE.revoked &&
        get().client === client
      ) {
        set({ revokedFrom: computerName(computer) })
        void get().forgetComputer(computer.daemonId)
      }
    })
    client.onPath((path) => set({ path }))
    client.onReady((hello) => {
      set({ hello })
      notePaths(computer.daemonId, hello.paths)
    })
    client.on('daemon.paths', (paths) => notePaths(computer.daemonId, paths))
    set({
      demo: demo !== undefined,
      credentials: computer,
      activeId: computer.daemonId,
      pairAgain: false,
      credentialsLoaded: true,
      client,
      status: client.status,
      path: null,
      hello: null,
      error: undefined,
      unreachable: false,
    })
    client.connect()
  }

  return {
    computers: [],
    activeId: null,
    credentials: null,
    pairAgain: false,
    revokedFrom: null,
    credentialsLoaded: false,
    demo: false,
    client: null,
    status: 'idle',
    error: undefined,
    unreachable: false,
    path: null,
    hello: null,
    loadComputers(computers, activeId) {
      set({ computers })
      connect(computers.find((c) => c.daemonId === activeId) ?? computers[0] ?? null)
    },
    async addComputer(computer) {
      await credentialsStorage.save(computer, true)
      set((state) => ({
        computers: [computer, ...state.computers.filter((c) => c.daemonId !== computer.daemonId)],
        revokedFrom: null,
      }))
      connect(computer)
    },
    async selectComputer(daemonId) {
      const computer = get().computers.find((c) => c.daemonId === daemonId)
      if (!computer || get().activeId === daemonId) return
      await credentialsStorage.activate(daemonId)
      set((state) => ({ computers: [computer, ...state.computers.filter((c) => c.daemonId !== daemonId)] }))
      connect(computer)
    },
    async forgetComputer(daemonId) {
      const next = await credentialsStorage.remove(daemonId)
      const computers = get().computers.filter((c) => c.daemonId !== daemonId)
      set({ computers })
      if (get().activeId === daemonId)
        connect(computers.find((c) => c.daemonId === next) ?? computers[0] ?? null)
    },
    async renameComputer(daemonId, alias) {
      const current = get().computers.find((c) => c.daemonId === daemonId)
      if (!current) return
      const value = alias?.trim() || undefined
      const { alias: _old, ...rest } = current
      const next: Computer = value ? { ...rest, alias: value } : rest
      replace(next)
      await credentialsStorage.save(next)
    },
    dismissRevoked() {
      set({ revokedFrom: null })
    },
    setCredentials(credentials) {
      connect(credentials)
    },
    enterDemo(computer, socketFactory) {
      connect(computer, { socketFactory })
    },
    leaveDemo() {
      if (get().demo) connect(null)
    },
  }
})

export function getClient(): DaemonClient | null {
  return useConnectionStore.getState().client
}

const NO_PROFILES: Hello['profiles'] = []

/** Stable selector: returns the same empty array until the daemon says hello (avoids render loops). */
export function selectProfiles(s: ConnectionState): Hello['profiles'] {
  return s.hello?.profiles ?? NO_PROFILES
}
