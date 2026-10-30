import {
  CHANNEL_CLOSE,
  type DeviceInfo,
  type KeyPair,
  type NoiseCrypto,
  type PairingCode,
} from '@remote-harness/protocol'
import {
  type ConnectionStatus,
  DaemonClient,
  type DaemonTarget,
  type Hello,
  type SocketFactory,
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
export type TestResult = { ok: true; hello: Hello } | { ok: false; error: TestFailure; detail?: string }

/** The failure a refused connection's close code means. */
export function failureForClose(code: number | undefined): TestFailure {
  if (code === CHANNEL_CLOSE.pairingRefused) return 'codeUsed'
  if (code === CHANNEL_CLOSE.deviceLimit) return 'deviceLimit'
  if (code === CHANNEL_CLOSE.protocolMismatch) return 'protocol'
  if (code === WRONG_DAEMON_CLOSE) return 'wrongComputer'
  return 'unauthorized'
}

type PairOptions = {
  crypto: NoiseCrypto
  deviceKey: KeyPair
  info: DeviceInfo
  timeoutMs?: number
  socketFactory?: SocketFactory
}

/** One pairing attempt on one target (no retries). */
function pairAt(
  target: Pick<DaemonTarget, 'addresses' | 'daemonId' | 'relay'>,
  code: PairingCode,
  options: PairOptions,
): Promise<TestResult> {
  return new Promise((resolve) => {
    const client = new DaemonClient({
      computer: { ...target, daemonKey: code.daemonKey, deviceKey: options.deviceKey },
      crypto: options.crypto,
      pairing: { secret: code.secret, info: options.info },
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
 * Pairs this device with the code's daemon (Noise XXpsk3), trying its direct addresses in turn and
 * then its relay until one answers; a refusal from the daemon stops there (the code is used up or
 * the device refused).
 */
export async function testConnection(code: PairingCode, options: PairOptions): Promise<TestResult> {
  const targets: Pick<DaemonTarget, 'addresses' | 'daemonId' | 'relay'>[] = [
    ...code.addresses.map((address) => ({ addresses: [address] })),
    ...(code.relay ? [{ addresses: [], daemonId: code.daemonId, relay: code.relay }] : []),
  ]
  let last: TestResult = { ok: false, error: 'failed' }
  for (const target of targets) {
    last = await pairAt(target, code, options)
    if (last.ok || (last.error !== 'failed' && last.error !== 'timeout')) return last
  }
  return last
}
