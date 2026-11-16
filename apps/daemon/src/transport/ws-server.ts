import { MAX_NOISE_MESSAGE, PAIRING_ID_LENGTH } from '@remote-harness/protocol'
import { type RawData, type WebSocket, WebSocketServer } from 'ws'
import { acceptSecureConnection, type Link, type SecureConnectionDeps } from './secure-connection.ts'

export { AUTH_TIMEOUT_MS } from './secure-connection.ts'

/** The WebSocket ping interval; a socket that has not answered the previous ping is dead. */
const HEARTBEAT_MS = 30_000
/** The close reason logged for a socket the ping/pong found dead (`socket.terminate()` gives 1006). */
export const DEAD_CONNECTION_REASON = 'no pong (dead connection)'
/**
 * One WebSocket message is one Noise message (at most 65,535 bytes) or, first, the preface plus
 * the first handshake message; protocol messages up to 8 MB arrive in several.
 */
export const MAX_PAYLOAD_BYTES = MAX_NOISE_MESSAGE + 4 + PAIRING_ID_LENGTH

export type WsServerOptions = SecureConnectionDeps & {
  host: string
  port: number
  /** The WebSocket ping interval (`HEARTBEAT_MS`); shorter in tests. */
  heartbeatMs?: number
}

function toBytes(data: RawData): Uint8Array {
  if (Array.isArray(data)) return Buffer.concat(data)
  return data instanceof ArrayBuffer ? new Uint8Array(data) : data
}

/** `dead`: whether the ping/pong terminated the socket (its close event then only says 1006). */
function wsLink(socket: WebSocket, dead: () => boolean): Link {
  return {
    send: (data) => {
      if (socket.readyState === socket.OPEN) socket.send(data, { binary: true })
    },
    close: (code, reason) => socket.close(code, reason),
    onMessage: (fn) => socket.on('message', (data, isBinary) => fn(toBytes(data), isBinary)),
    onClose: (fn) =>
      socket.on('close', (code, reason) =>
        fn(
          dead()
            ? { code, reason: DEAD_CONNECTION_REASON, byDaemon: true }
            : { code, reason: reason.toString() },
        ),
      ),
  }
}

/** The direct path: devices connect here and speak the Noise channel (`secure-connection.ts`). */
export async function startWsServer(options: WsServerOptions): Promise<WebSocketServer> {
  const wss = new WebSocketServer({
    host: options.host,
    port: options.port,
    maxPayload: MAX_PAYLOAD_BYTES,
    perMessageDeflate: false,
  })
  const alive = new WeakMap<WebSocket, boolean>()
  const dead = new WeakSet<WebSocket>()

  wss.on('connection', (socket, request) => {
    alive.set(socket, true)
    socket.on('pong', () => alive.set(socket, true))
    acceptSecureConnection(
      wsLink(socket, () => dead.has(socket)),
      options,
      { remote: request.socket.remoteAddress, path: 'direct' },
    )
  })

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (alive.get(socket) === false) {
        dead.add(socket)
        socket.terminate()
        continue
      }
      alive.set(socket, false)
      socket.ping()
    }
  }, options.heartbeatMs ?? HEARTBEAT_MS)
  wss.on('close', () => clearInterval(heartbeat))

  await new Promise<void>((resolve, reject) => {
    wss.once('listening', resolve)
    wss.once('error', reject)
  })
  return wss
}
