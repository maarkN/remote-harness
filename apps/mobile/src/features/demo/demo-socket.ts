import {
  CHANNEL_CLOSE,
  type ChannelSession,
  ClientMessageSchema,
  DaemonHandshake,
  type KeyPair,
  type NoiseCrypto,
  type ServerMessage,
} from '@remote-harness/protocol'
import type { SocketFactory, SocketLike } from '@/core/connection/daemon-client'
import { DemoDaemon, type DemoDaemonOptions } from './demo-daemon'

const CONNECTING = 0
const OPEN = 1
const CLOSED = 3

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** Like a network hop: later, and in order (so the channel's nonces stay in step). */
const soon = (fn: () => void) => setTimeout(fn, 0)

/**
 * The offline demo's "computer": a demo daemon behind a key generated for this run, reached through
 * sockets that never touch the network. The app's `DaemonClient` runs its usual Noise IK handshake
 * and protocol with it; any device key is accepted.
 */
export class DemoServer {
  readonly daemon: DemoDaemon
  private readonly key: KeyPair
  private socket: DemoSocket | null = null

  constructor(
    private readonly crypto: NoiseCrypto,
    options: DemoDaemonOptions,
  ) {
    this.key = crypto.generateKeyPair()
    this.daemon = new DemoDaemon(options, (message) => this.socket?.push(message))
  }

  /** The static key the demo computer is pinned with. */
  get publicKey(): Uint8Array {
    return this.key.publicKey
  }

  /** For `DaemonClientOptions.socketFactory`: the URL is ignored, every socket reaches this server. */
  readonly socketFactory: SocketFactory = () => {
    const socket = new DemoSocket(this.crypto, this.key, this)
    this.socket = socket
    return socket
  }

  /** @internal Called by a socket once it is closed. */
  detach(socket: DemoSocket): void {
    if (this.socket === socket) this.socket = null
  }

  dispose(): void {
    this.daemon.dispose()
    this.socket?.close()
    this.socket = null
  }
}

class DemoSocket implements SocketLike {
  readyState = CONNECTING
  binaryType = 'arraybuffer'
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  private session: ChannelSession | null = null
  private readonly handshake: DaemonHandshake

  constructor(
    crypto: NoiseCrypto,
    key: KeyPair,
    private readonly server: DemoServer,
  ) {
    this.handshake = new DaemonHandshake(crypto, key, { pairingSecret: () => null, isPaired: () => true })
    soon(() => {
      if (this.readyState !== CONNECTING) return
      this.readyState = OPEN
      this.onopen?.({})
    })
  }

  send(data: ArrayBuffer): void {
    if (this.readyState !== OPEN) return
    const bytes = new Uint8Array(data)
    if (!this.session) {
      const step = this.handshake.start(bytes)
      if (step.kind !== 'send' || !step.session) {
        this.close(step.kind === 'refused' ? step.code : CHANNEL_CLOSE.unauthorized, 'handshake refused')
        return
      }
      this.session = step.session
      this.deliver(step.send)
      return
    }
    let text: string | null
    try {
      text = this.session.openText(bytes)
    } catch {
      this.close(CHANNEL_CLOSE.unauthorized, 'bad frame')
      return
    }
    if (text === null) return
    this.receive(text)
  }

  /** One decrypted request: validated like the daemon does, then answered by the demo daemon. */
  private receive(text: string): void {
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return
    }
    const parsed = ClientMessageSchema.safeParse(raw)
    if (parsed.success) {
      this.server.daemon.handle(parsed.data)
      return
    }
    const id =
      typeof raw === 'object' && raw && 'id' in raw && typeof raw.id === 'string' ? raw.id : undefined
    if (id) this.push({ type: 'error', replyTo: id, code: 'bad_request', message: 'invalid message' })
  }

  /** Encrypts a message of the demo daemon and hands it to the client. */
  push(message: ServerMessage): void {
    const session = this.session
    if (!session || this.readyState !== OPEN) return
    for (const frame of session.sealText(JSON.stringify(message))) this.deliver(frame)
  }

  private deliver(bytes: Uint8Array): void {
    const data = toArrayBuffer(bytes)
    soon(() => {
      if (this.readyState === OPEN) this.onmessage?.({ data })
    })
  }

  close(code = 1000, reason?: string): void {
    if (this.readyState === CLOSED) return
    this.readyState = CLOSED
    this.session = null
    this.server.detach(this)
    soon(() => this.onclose?.({ code, ...(reason ? { reason } : {}) }))
  }
}
