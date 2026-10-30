import { concatBytes, relayCloseCode, utf8Encode } from '@remote-harness/protocol'
import WebSocket from 'ws'
import { type DaemonIdentity, signRelayChallenge } from '../core/identity.ts'
import type { Logger } from '../core/logger.ts'
import type { Link } from './secure-connection.ts'

// The connection relay's daemon frames (apps/relay/internal/relay/frame.go).
const FRAME_CHALLENGE = 0x01
const FRAME_HELLO = 0x02
const FRAME_READY = 0x03
const FRAME_OPEN = 0x10
const FRAME_DATA = 0x11
const FRAME_CLOSE = 0x12
const HEADER = 5
const CHALLENGE_CONTEXT = utf8Encode('remote-harness relay v1\0')
const READY_TIMEOUT_MS = 10_000
/** The relay pings every 25 s; nothing at all for this long means the connection is dead. */
const SILENCE_MS = 90_000
/** Largest device message (8 MB, the relay's default) plus the frame header. */
const MAX_PAYLOAD = 8 * 1024 * 1024 + HEADER

function frame(kind: number, channel: number, rest: Uint8Array = new Uint8Array(0)): Uint8Array {
  const out = new Uint8Array(HEADER + rest.length)
  out[0] = kind
  new DataView(out.buffer).setUint32(1, channel)
  out.set(rest, HEADER)
  return out
}

/** The answer to the relay's challenge: our Ed25519 relay key and its signature (relay ownership). */
export function relayHello(identity: DaemonIdentity, challenge: Uint8Array): Uint8Array {
  const signature = signRelayChallenge(identity, concatBytes(CHALLENGE_CONTEXT, challenge))
  return concatBytes(Uint8Array.of(FRAME_HELLO), identity.relay.publicKey, signature)
}

type Channel = {
  message: Array<(data: Uint8Array, isBinary: boolean) => void>
  close: Array<() => void>
  closed: boolean
}

export type RelayConnectionOptions = {
  /** The relay's daemon endpoint (`wss://…/v1/daemon`). */
  url: string
  identity: DaemonIdentity
  /** A device opened a channel: run the Noise connection on it. */
  onLink: (link: Link) => void
  logger: Logger
}

/**
 * One connection to a relay as the owner of our room. `ready` resolves once the room is open and
 * rejects when it could not be; `closed` resolves (with the close code) when it ends.
 */
export class RelayConnection {
  readonly ready: Promise<void>
  readonly closed: Promise<number>
  private readonly ws: WebSocket
  private readonly channels = new Map<number, Channel>()
  private lastHeard = Date.now()
  private watchdog: ReturnType<typeof setInterval> | null = null

  constructor(private readonly o: RelayConnectionOptions) {
    this.ws = new WebSocket(o.url, { perMessageDeflate: false, maxPayload: MAX_PAYLOAD })
    let resolveReady: () => void = () => undefined
    let rejectReady: (error: Error) => void = () => undefined
    this.ready = new Promise((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    this.ready.catch(() => undefined)
    const readyTimer = setTimeout(() => {
      rejectReady(new Error('relay did not open the room in time'))
      this.ws.terminate()
    }, READY_TIMEOUT_MS)
    let isReady = false

    this.closed = new Promise((resolve) => {
      this.ws.on('close', (code) => {
        clearTimeout(readyTimer)
        if (this.watchdog) clearInterval(this.watchdog)
        rejectReady(new Error(`relay closed (${code})`))
        for (const channel of this.channels.keys()) this.endChannel(channel)
        resolve(code)
      })
    })
    this.ws.on('error', (error) => o.logger.debug({ err: error }, 'relay connection error'))
    this.ws.on('ping', () => {
      this.lastHeard = Date.now()
    })
    this.ws.on('message', (raw: Buffer, isBinary) => {
      this.lastHeard = Date.now()
      const data = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
      if (!isBinary || data.length === 0) return this.ws.close(1002, 'binary frames only')
      if (!isReady) {
        if (data[0] === FRAME_CHALLENGE && data.length === 33) {
          this.ws.send(relayHello(o.identity, data.subarray(1)))
          return
        }
        if (data[0] === FRAME_READY) {
          isReady = true
          clearTimeout(readyTimer)
          this.watchdog = setInterval(() => {
            if (Date.now() - this.lastHeard > SILENCE_MS) this.ws.terminate()
          }, 15_000)
          resolveReady()
          return
        }
        return this.ws.close(1002, 'unexpected frame')
      }
      this.handleFrame(data)
    })
  }

  close(): void {
    this.ws.close(1001, 'daemon stopping')
  }

  private handleFrame(data: Uint8Array): void {
    if (data.length < HEADER) return
    const channel = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(1)
    const kind = data[0]
    if (kind === FRAME_OPEN) this.openChannel(channel)
    else if (kind === FRAME_DATA) {
      const ch = this.channels.get(channel)
      if (ch && !ch.closed) for (const fn of ch.message) fn(data.subarray(HEADER), true)
    } else if (kind === FRAME_CLOSE) this.endChannel(channel)
  }

  private openChannel(id: number): void {
    const channel: Channel = { message: [], close: [], closed: false }
    this.channels.set(id, channel)
    const link: Link = {
      send: (data) => {
        if (!channel.closed && this.ws.readyState === WebSocket.OPEN)
          this.ws.send(frame(FRAME_DATA, id, data))
      },
      close: (code) => {
        if (channel.closed) return
        if (this.ws.readyState === WebSocket.OPEN) {
          const rest = new Uint8Array(2)
          new DataView(rest.buffer).setUint16(0, relayCloseCode(code))
          this.ws.send(frame(FRAME_CLOSE, id, rest))
        }
        this.endChannel(id)
      },
      onMessage: (fn) => channel.message.push(fn),
      onClose: (fn) => channel.close.push(fn),
    }
    this.o.onLink(link)
  }

  private endChannel(id: number): void {
    const channel = this.channels.get(id)
    if (!channel || channel.closed) return
    channel.closed = true
    this.channels.delete(id)
    for (const fn of channel.close.splice(0)) fn()
  }
}
