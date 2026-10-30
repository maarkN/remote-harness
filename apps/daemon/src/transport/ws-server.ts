import { MAX_NOISE_MESSAGE, PAIRING_ID_LENGTH } from '@remote-harness/protocol'
import { type RawData, type WebSocket, WebSocketServer } from 'ws'
import { acceptSecureConnection, type Link, type SecureConnectionDeps } from './secure-connection.ts'

export { AUTH_TIMEOUT_MS } from './secure-connection.ts'

const HEARTBEAT_MS = 30_000
/**
 * One WebSocket message is one Noise message (at most 65,535 bytes) or, first, the preface plus
 * the first handshake message; protocol messages up to 8 MB arrive in several.
 */
export const MAX_PAYLOAD_BYTES = MAX_NOISE_MESSAGE + 4 + PAIRING_ID_LENGTH

export type WsServerOptions = SecureConnectionDeps & {
  host: string
  port: number
}

function toBytes(data: RawData): Uint8Array {
  if (Array.isArray(data)) return Buffer.concat(data)
  return data instanceof ArrayBuffer ? new Uint8Array(data) : data
}

function wsLink(socket: WebSocket): Link {
  return {
    send: (data) => {
      if (socket.readyState === socket.OPEN) socket.send(data, { binary: true })
    },
    close: (code, reason) => socket.close(code, reason),
    onMessage: (fn) => socket.on('message', (data, isBinary) => fn(toBytes(data), isBinary)),
    onClose: (fn) => socket.on('close', fn),
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

  wss.on('connection', (socket, request) => {
    alive.set(socket, true)
    socket.on('pong', () => alive.set(socket, true))
    acceptSecureConnection(wsLink(socket), options, { remote: request.socket.remoteAddress, path: 'direct' })
  })

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (alive.get(socket) === false) {
        socket.terminate()
        continue
      }
      alive.set(socket, false)
      socket.ping()
    }
  }, HEARTBEAT_MS)
  wss.on('close', () => clearInterval(heartbeat))

  await new Promise<void>((resolve, reject) => {
    wss.once('listening', resolve)
    wss.once('error', reject)
  })
  return wss
}
