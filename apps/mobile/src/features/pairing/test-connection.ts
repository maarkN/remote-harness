import {
  announcePreface,
  CHANNEL_CLOSE,
  type DeviceInfo,
  type KeyPair,
  type NoiseCrypto,
  normalizeChannelClose,
  type PairingCode,
  relayDeviceUrl,
} from '@remote-harness/protocol'
import {
  type ConnectionStatus,
  DaemonClient,
  type DaemonTarget,
  daemonUrl,
  type Hello,
  type SocketFactory,
  type SocketLike,
  WRONG_DAEMON_CLOSE,
} from '@/core/connection/daemon-client'

/** Why pairing failed; `detail` is the raw reason from the socket, when there is one. */
export type TestFailure =
  | 'timeout'
  | 'unauthorized'
  | 'codeUsed'
  | 'deviceLimit'
  | 'wrongComputer'
  | 'protocol'
  | 'failed'
  /** The computer shows a confirmation code no device has typed yet: type the one it shows. */
  | 'confirmationRequired'
  /** Another code than the one the computer shows; it can be typed again. */
  | 'wrongConfirmation'
  /** Wrong codes burned the pairing code: a new one is needed. */
  | 'confirmationLocked'
  /** The computer's daemon predates confirmation codes (it refused the announce). */
  | 'computerUpdate'
export type TestResult = { ok: true; hello: Hello } | { ok: false; error: TestFailure; detail?: string }

/** One place to reach the code's daemon: one direct address, or its relay. */
export type PairTarget = Pick<DaemonTarget, 'addresses' | 'daemonId' | 'relay'>
export type AnnounceResult =
  | { ok: true; target: PairTarget }
  | { ok: false; error: TestFailure; detail?: string }

/** The failure a refused connection's close code means. */
export function failureForClose(code: number | undefined): TestFailure {
  if (code === CHANNEL_CLOSE.pairingRefused) return 'codeUsed'
  if (code === CHANNEL_CLOSE.deviceLimit) return 'deviceLimit'
  if (code === CHANNEL_CLOSE.protocolMismatch) return 'protocol'
  if (code === CHANNEL_CLOSE.confirmationShown) return 'confirmationRequired'
  if (code === CHANNEL_CLOSE.wrongConfirmation) return 'wrongConfirmation'
  if (code === CHANNEL_CLOSE.confirmationLocked) return 'confirmationLocked'
  if (code === WRONG_DAEMON_CLOSE) return 'wrongComputer'
  return 'unauthorized'
}

type PairOptions = {
  crypto: NoiseCrypto
  deviceKey: KeyPair
  info: DeviceInfo
  /** The six digits the computer shows (ADR-0009). */
  confirmation: string
  /** Where the announce was answered: tried before the code's other targets. */
  first?: PairTarget
  timeoutMs?: number
  socketFactory?: SocketFactory
}

/** The code's direct addresses one by one, then its relay. */
function targetsOf(code: PairingCode, first?: PairTarget): PairTarget[] {
  const all: PairTarget[] = [
    ...code.addresses.map((address) => ({ addresses: [address] })),
    ...(code.relay ? [{ addresses: [], daemonId: code.daemonId, relay: code.relay }] : []),
  ]
  if (!first) return all
  const key = (t: PairTarget) => JSON.stringify([t.addresses, t.daemonId ?? null, t.relay ?? null])
  return [first, ...all.filter((t) => key(t) !== key(first))]
}

function urlOf(target: PairTarget): string {
  const [address] = target.addresses
  if (address) return daemonUrl(address)
  return relayDeviceUrl(target.relay ?? '', target.daemonId ?? '')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** One announce on one target: the close code the daemon answered with, or null (no answer). */
function announceAt(
  target: PairTarget,
  code: PairingCode,
  options: { crypto: NoiseCrypto; socketFactory?: SocketFactory; timeoutMs?: number },
): Promise<{ code: number; reason?: string } | null> {
  const factory = options.socketFactory ?? ((url: string) => new WebSocket(url) as unknown as SocketLike)
  return new Promise((resolve) => {
    let socket: SocketLike
    try {
      socket = factory(urlOf(target))
      socket.binaryType = 'arraybuffer'
    } catch {
      resolve(null)
      return
    }
    let settled = false
    const finish = (result: { code: number; reason?: string } | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.onclose = null
      if (result === null) socket.close()
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), options.timeoutMs ?? 8_000)
    socket.onopen = () => socket.send(toArrayBuffer(announcePreface(options.crypto, code.secret)))
    socket.onmessage = () => undefined
    socket.onerror = () => undefined
    // Through the connection relay the daemon's codes arrive as 41xx.
    socket.onclose = (event) =>
      finish({ code: normalizeChannelClose(event.code), ...(event.reason ? { reason: event.reason } : {}) })
  })
}

/**
 * Presents the code to its daemon (ADR-0009), over its direct addresses and then its relay: the
 * computer then shows the confirmation code the user types on this phone. Returns where it was
 * answered, so the pairing goes there first.
 */
export async function announcePairing(
  code: PairingCode,
  options: { crypto: NoiseCrypto; socketFactory?: SocketFactory; timeoutMs?: number },
): Promise<AnnounceResult> {
  let last: AnnounceResult = { ok: false, error: 'failed' }
  for (const target of targetsOf(code)) {
    const answer = await announceAt(target, code, options)
    if (answer === null) {
      last = { ok: false, error: 'timeout' }
      continue
    }
    if (answer.code === CHANNEL_CLOSE.confirmationShown) return { ok: true, target }
    if (answer.code === CHANNEL_CLOSE.pairingRefused) return { ok: false, error: 'codeUsed' }
    // A daemon without confirmation codes does not know the announce's preface mode.
    if (answer.code === CHANNEL_CLOSE.protocolMismatch) return { ok: false, error: 'computerUpdate' }
    last = { ok: false, error: 'failed', ...(answer.reason ? { detail: answer.reason } : {}) }
  }
  return last
}

/** One pairing attempt on one target (no retries). */
function pairAt(target: PairTarget, code: PairingCode, options: PairOptions): Promise<TestResult> {
  return new Promise((resolve) => {
    const client = new DaemonClient({
      computer: { ...target, daemonKey: code.daemonKey, deviceKey: options.deviceKey },
      crypto: options.crypto,
      pairing: { secret: code.secret, info: options.info, confirmation: options.confirmation },
      reconnect: false,
      socketFactory: options.socketFactory,
    })
    let settled = false
    const finish = (result: TestResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      client.close()
      resolve(result)
    }
    const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), options.timeoutMs ?? 8_000)
    client.onReady((hello) => finish({ ok: true, hello }))
    client.onStatus((status: ConnectionStatus, error?: string) => {
      if (status === 'unauthorized') finish({ ok: false, error: failureForClose(client.closeCode) })
      else if (status === 'closed')
        finish({ ok: false, error: 'failed', ...(error ? { detail: error } : {}) })
    })
    client.connect()
  })
}

/**
 * Pairs this device with the code's daemon (Noise XXpsk3 with the confirmation code), where the
 * announce was answered first and then on the code's other targets until one answers; a refusal
 * from the daemon stops there (a wrong or burned code, a used code, a refused device).
 */
export async function testConnection(code: PairingCode, options: PairOptions): Promise<TestResult> {
  let last: TestResult = { ok: false, error: 'failed' }
  for (const target of targetsOf(code, options.first)) {
    last = await pairAt(target, code, options)
    if (last.ok || (last.error !== 'failed' && last.error !== 'timeout')) return last
  }
  return last
}
