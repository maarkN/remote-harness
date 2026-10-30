import { noiseCrypto } from '@/core/crypto'
import { credentialsStorage } from '@/core/storage/credentials'
import { DaemonClient, type Hello } from './daemon-client'

const TIMEOUT_MS = 8_000

/**
 * Runs `use` on a short-lived connection (Noise IK with the saved keys) (a notification action, a Live
 * Activity button or token with the app in the background). False when there are no credentials,
 * the daemon cannot be reached or `use` fails.
 */
export async function withShortLivedClient(
  use: (client: DaemonClient) => Promise<unknown>,
  daemonId?: string,
): Promise<boolean> {
  return (await runOnShortLivedClient(use, daemonId)).ok
}

/** Same as `withShortLivedClient`, keeping what `use` returned (a voice assistant's answer). */
export async function runOnShortLivedClient<T>(
  use: (client: DaemonClient) => Promise<T>,
  daemonId?: string,
): Promise<{ ok: true; value: T } | { ok: false }> {
  const { computers, active } = await credentialsStorage.loadAll()
  // The notification's computer when it says which; else the active one.
  const credentials = computers.find((c) => c.daemonId === (daemonId ?? active))
  if (!credentials) return { ok: false }
  const client = new DaemonClient({
    computer: credentials,
    crypto: noiseCrypto,
    reconnect: false,
    requestTimeoutMs: TIMEOUT_MS,
  })
  try {
    await new Promise<Hello>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      client.onReady((hello) => {
        clearTimeout(timer)
        resolve(hello)
      })
      client.onStatus((status) => {
        if (status === 'closed' || status === 'unauthorized') reject(new Error(status))
      })
      client.connect()
    })
    return { ok: true, value: await use(client) }
  } catch {
    return { ok: false }
  } finally {
    client.close()
  }
}
