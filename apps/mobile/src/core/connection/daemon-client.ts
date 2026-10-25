import {
  CHANNEL_CLOSE,
  type ChannelSession,
  type ClientRequest,
  DeviceHandshake,
  type DeviceInfo,
  type ErrorCode,
  type KeyPair,
  type NoiseCrypto,
  PROTOCOL_VERSION,
  parseServerMessage,
  type ServerMessage,
  type ServerMessageOf,
  type ServerMessageType,
} from '@remote-harness/protocol'

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'open'
  | 'reconnecting'
  | 'unauthorized'
  | 'closed'

export type Hello = Omit<ServerMessageOf<'auth.ok'>, 'type' | 'replyTo'>

/** Minimal WebSocket surface used by the client (RN's global WebSocket or a test fake). */
export interface SocketLike {
  readyState: number
  binaryType?: string
  send(data: ArrayBuffer): void
  close(code?: number, reason?: string): void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev: { code: number; reason?: string }) => void) | null
  onerror: ((ev: unknown) => void) | null
}
export type SocketFactory = (url: string) => SocketLike

export class DaemonRequestError extends Error {
  constructor(
    readonly code: ErrorCode | 'timeout' | 'disconnected',
    message: string,
  ) {
    super(message)
    this.name = 'DaemonRequestError'
  }
}

/** What the client needs of a paired computer (or of the code being paired). */
export type DaemonTarget = {
  /** Direct `host:port` addresses, tried in turn. */
  addresses: string[]
  /** The daemon's Noise static key; the handshake fails when another key answers. */
  daemonKey: Uint8Array
  deviceKey: KeyPair
}

export type DaemonClientOptions = {
  computer: DaemonTarget
  crypto: NoiseCrypto
  /** Pair with a code (Noise XXpsk3) instead of reconnecting with IK; used once, by the pairing. */
  pairing?: { secret: Uint8Array; info: DeviceInfo }
  socketFactory?: SocketFactory
  /** Automatically reconnect with exponential backoff (disabled for the pairing test). */
  reconnect?: boolean
  requestTimeoutMs?: number
  minBackoffMs?: number
  maxBackoffMs?: number
  /** An attempt that has not opened after this long is abandoned and counted as unreachable. */
  connectTimeoutMs?: number
  clientName?: string
}

type Pending = {
  type: ClientRequest['type']
  resolve: (message: ServerMessage) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}
type AnyHandler = (message: ServerMessage) => void
/** A request answered with `error`, or never answered: its message type and the error (code). */
export type RequestErrorListener = (type: ClientRequest['type'], error: DaemonRequestError) => void

const OPEN = 1
/** Close codes after which retrying is pointless: unknown key, protocol mismatch, refused pairing. */
const FATAL_CLOSE_CODES: ReadonlySet<number> = new Set([
  CHANNEL_CLOSE.unauthorized,
  CHANNEL_CLOSE.protocolMismatch,
  CHANNEL_CLOSE.pairingRefused,
  CHANNEL_CLOSE.deviceLimit,
])
/** Ours: the daemon that answered does not have the pinned static key. */
export const WRONG_DAEMON_CLOSE = 4090

/** `ws://host:port` for a `host:port` address (IPv6 already in brackets). */
export function daemonUrl(address: string): string {
  return `ws://${address}`
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  return null
}

/**
 * WebSocket client for the daemon: runs the Noise handshake, authenticates inside the encrypted
 * channel, correlates requests by id, and keeps the connection alive with exponential backoff. No
 * React in here so it can be unit-tested.
 */
export class DaemonClient {
  private socket: SocketLike | null = null
  private handshake: DeviceHandshake | null = null
  private session: ChannelSession | null = null
  /** Cleared after the first successful pairing: reconnects use IK. */
  private pairing: DaemonClientOptions['pairing']
  private _closeCode: number | undefined
  private readonly pending = new Map<string, Pending>()
  private readonly handlers = new Map<ServerMessageType | '*', Set<AnyHandler>>()
  private readonly statusListeners = new Set<(status: ConnectionStatus, error?: string) => void>()
  private readyListeners = new Set<(hello: Hello) => void>()
  private readonly requestErrorListeners = new Set<RequestErrorListener>()
  private seq = 0
  private attempt = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private _unreachable = false
  /** `unreachable` as of the last status notification (a flip alone notifies the listeners). */
  private notifiedUnreachable = false
  private stopped = false
  private _status: ConnectionStatus = 'idle'
  private _hello: Hello | null = null
  private _lastError: string | undefined

  constructor(private readonly options: DaemonClientOptions) {
    this.pairing = options.pairing
  }

  get status(): ConnectionStatus {
    return this._status
  }

  get hello(): Hello | null {
    return this._hello
  }

  get lastError(): string | undefined {
    return this._lastError
  }

  /** The close code of the last connection the daemon refused (4001, 4005…), if any. */
  get closeCode(): number | undefined {
    return this._closeCode
  }

  /**
   * The last attempt got no answer at all (timed out): the computer is likely asleep or offline.
   * A refused or failed-at-once attempt clears it, as does a successful open.
   */
  get unreachable(): boolean {
    return this._unreachable
  }

  connect(): void {
    this.stopped = false
    if (this.socket || this.retryTimer) return
    this.open()
  }

  /** Reconnects immediately (e.g. app returned to the foreground), skipping the backoff wait. */
  resumeNow(): void {
    if (this.stopped || this._status === 'unauthorized') return
    if (this._status === 'open' || this._status === 'connecting' || this._status === 'authenticating') return
    this.clearRetry()
    this.attempt = 0
    this.open()
  }

  close(): void {
    this.stopped = true
    this.clearRetry()
    this.clearConnectTimer()
    const socket = this.socket
    this.socket = null
    this.session = null
    this.handshake = null
    if (socket) {
      socket.onclose = null
      socket.close(1000, 'client closed')
    }
    this.failPending('disconnected')
    this.setStatus('closed')
  }

  on<T extends ServerMessageType>(type: T, handler: (message: ServerMessageOf<T>) => void): () => void {
    return this.addHandler(type, handler as AnyHandler)
  }

  onAny(handler: AnyHandler): () => void {
    return this.addHandler('*', handler)
  }

  onStatus(listener: (status: ConnectionStatus, error?: string) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  /** Called after every successful (re)authentication, so stores can resubscribe. */
  onReady(listener: (hello: Hello) => void): () => void {
    this.readyListeners.add(listener)
    return () => this.readyListeners.delete(listener)
  }

  /**
   * Sends a request and resolves with the correlated reply; `error` replies reject. `timeoutMs`
   * overrides the default for replies that take long to arrive (large images).
   */
  request(message: ClientRequest, options: { timeoutMs?: number } = {}): Promise<ServerMessage> {
    if (!this.socket || this.socket.readyState !== OPEN || this._status !== 'open') {
      return Promise.reject(new DaemonRequestError('disconnected', 'not connected to the daemon'))
    }
    return this.sendRequest(message, options.timeoutMs)
  }

  /**
   * Called when a request is answered with `error` or times out (not for requests dropped because
   * the connection was lost, which the connection status already reports).
   */
  onRequestError(listener: RequestErrorListener): () => void {
    this.requestErrorListeners.add(listener)
    return () => this.requestErrorListeners.delete(listener)
  }

  private requestFailed(type: ClientRequest['type'], error: DaemonRequestError): DaemonRequestError {
    for (const listener of this.requestErrorListeners) listener(type, error)
    return error
  }

  /** Fire-and-forget variant that ignores the reply. */
  send(message: ClientRequest): void {
    this.request(message).catch(() => undefined)
  }

  private addHandler(key: ServerMessageType | '*', handler: AnyHandler): () => void {
    let set = this.handlers.get(key)
    if (!set) {
      set = new Set()
      this.handlers.set(key, set)
    }
    set.add(handler)
    return () => set.delete(handler)
  }

  private nextId(): string {
    this.seq += 1
    return `${Date.now().toString(36)}-${this.seq}`
  }

  private sendRequest(message: ClientRequest, timeoutMs?: number): Promise<ServerMessage> {
    const id = this.nextId()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => {
          this.pending.delete(id)
          reject(
            this.requestFailed(
              message.type,
              new DaemonRequestError('timeout', `no reply to ${message.type}`),
            ),
          )
        },
        timeoutMs ?? this.options.requestTimeoutMs ?? 15_000,
      )
      this.pending.set(id, { type: message.type, resolve, reject, timer })
      this.sendSealed(JSON.stringify({ ...message, id }))
    })
  }

  /** Encrypts one protocol message into its WebSocket frames (several for large messages). */
  private sendSealed(text: string): void {
    const socket = this.socket
    if (!socket || !this.session) return
    for (const frame of this.session.sealText(text)) socket.send(toArrayBuffer(frame))
  }

  private setStatus(status: ConnectionStatus, error?: string): void {
    this._lastError = error
    if (this._status === status && !error && this._unreachable === this.notifiedUnreachable) return
    this.notifiedUnreachable = this._unreachable
    this._status = status
    for (const listener of this.statusListeners) listener(status, error)
  }

  private open(): void {
    const factory =
      this.options.socketFactory ?? ((url: string) => new WebSocket(url) as unknown as SocketLike)
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting')
    const { addresses } = this.options.computer
    const address = addresses[this.attempt % Math.max(1, addresses.length)]
    let socket: SocketLike
    try {
      if (!address) throw new Error('no address for this computer')
      socket = factory(daemonUrl(address))
      socket.binaryType = 'arraybuffer'
    } catch (error) {
      this.scheduleReconnect(String(error))
      return
    }
    this.socket = socket
    this.session = null
    this.handshake = null
    this.clearConnectTimer()
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null
      if (this.socket !== socket) return
      // No answer at all: drop this attempt instead of waiting for the OS timeout.
      this.socket = null
      socket.onopen = null
      socket.onclose = null
      socket.close()
      this._unreachable = true
      this.failPending('disconnected')
      this.scheduleReconnect('unreachable')
    }, this.options.connectTimeoutMs ?? 10_000)
    socket.onopen = () => {
      this.clearConnectTimer()
      this._unreachable = false
      this.setStatus('authenticating')
      const { computer, crypto } = this.options
      this.handshake = this.pairing
        ? DeviceHandshake.pair(crypto, {
            deviceKey: computer.deviceKey,
            daemonKey: computer.daemonKey,
            secret: this.pairing.secret,
            info: this.pairing.info,
          })
        : DeviceHandshake.reconnect(crypto, { deviceKey: computer.deviceKey, daemonKey: computer.daemonKey })
      socket.send(toArrayBuffer(this.handshake.start()))
    }
    socket.onmessage = (event) => {
      if (this.socket === socket) this.handleFrame(socket, event.data)
    }
    socket.onerror = () => {
      // onclose follows and drives reconnection.
    }
    socket.onclose = (event) => {
      if (this.socket !== socket) return
      this.socket = null
      this.session = null
      this.handshake = null
      // Closed before opening, within the timeout: something answered (refused, no network).
      if (this.connectTimer) this._unreachable = false
      this.clearConnectTimer()
      this.failPending('disconnected')
      if (FATAL_CLOSE_CODES.has(event.code)) {
        this._closeCode = event.code
        this.stopped = true
        this.setStatus('unauthorized', event.reason || 'connection refused by the daemon')
        return
      }
      this.scheduleReconnect(event.reason)
    }
  }

  /** Handshake messages until the channel is up, then encrypted protocol messages. */
  private handleFrame(socket: SocketLike, data: unknown): void {
    const bytes = toBytes(data)
    if (!bytes) return
    if (!this.session) {
      const handshake = this.handshake
      if (!handshake) return
      let step: ReturnType<DeviceHandshake['receive']>
      try {
        step = handshake.receive(bytes)
      } catch {
        // Not the daemon we paired with (or a broken handshake): never retry blindly.
        this.refuse(socket, WRONG_DAEMON_CLOSE, 'unexpected daemon key')
        return
      }
      if (step.send) socket.send(toArrayBuffer(step.send))
      if (step.session) {
        this.session = step.session
        this.handshake = null
        this.authenticate()
      }
      return
    }
    let text: string | null
    try {
      text = this.session.openText(bytes)
    } catch {
      socket.close(CHANNEL_CLOSE.unauthorized, 'bad frame')
      return
    }
    if (text !== null) this.handleMessage(text)
  }

  /** Ends the attempt for good: the peer is not who we expect. */
  private refuse(socket: SocketLike, code: number, reason: string): void {
    this.socket = null
    this.session = null
    this.handshake = null
    socket.onclose = null
    socket.close(1000, reason)
    this.clearConnectTimer()
    this.failPending('disconnected')
    this._closeCode = code
    this.stopped = true
    this.setStatus('unauthorized', reason)
  }

  private authenticate(): void {
    this.sendRequest({ type: 'auth', protocolVersion: PROTOCOL_VERSION, client: this.options.clientName })
      .then((reply) => {
        if (reply.type !== 'auth.ok') return
        const { type: _t, replyTo: _r, ...hello } = reply
        // The code is used up: from now on this device reconnects with its own key (IK).
        this.pairing = undefined
        this._hello = hello
        this.attempt = 0
        this.setStatus('open')
        for (const listener of this.readyListeners) listener(hello)
      })
      .catch((error: unknown) => {
        const code = error instanceof DaemonRequestError ? error.code : undefined
        if (code === 'unauthorized' || code === 'protocol_mismatch') {
          this.stopped = true
          this.setStatus('unauthorized', (error as Error).message)
        }
      })
  }

  private handleMessage(text: string): void {
    const parsed = parseServerMessage(text)
    if (!parsed.ok) return
    const message = parsed.value
    const replyTo = 'replyTo' in message ? message.replyTo : undefined
    if (replyTo) {
      const pending = this.pending.get(replyTo)
      if (pending) {
        this.pending.delete(replyTo)
        clearTimeout(pending.timer)
        if (message.type === 'error')
          pending.reject(
            this.requestFailed(pending.type, new DaemonRequestError(message.code, message.message)),
          )
        else pending.resolve(message)
      }
    }
    for (const handler of this.handlers.get(message.type) ?? []) handler(message)
    for (const handler of this.handlers.get('*') ?? []) handler(message)
  }

  private failPending(code: 'disconnected'): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new DaemonRequestError(code, 'connection lost'))
      this.pending.delete(id)
    }
  }

  private scheduleReconnect(reason?: string): void {
    if (this.stopped || this.options.reconnect === false) {
      this.setStatus('closed', reason)
      return
    }
    const min = this.options.minBackoffMs ?? 1_000
    const max = this.options.maxBackoffMs ?? 30_000
    const delay = Math.min(max, min * 2 ** this.attempt)
    this.attempt += 1
    this.setStatus('reconnecting', reason)
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.open()
    }, delay)
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer)
    this.connectTimer = null
  }
}
