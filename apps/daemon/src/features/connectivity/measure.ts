import { healthUrl, type RelayMeasurement } from './relays.ts'

const TIMEOUT_MS = 3_000
const TRIES = 2

export type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean }>

/** The round trip of a relay's `GET /healthz`: the fastest of two tries, null when neither answered OK. */
export async function measureRelay(
  url: string,
  fetchImpl: FetchLike = fetch,
  now: () => number = performance.now.bind(performance),
): Promise<RelayMeasurement> {
  let best: number | null = null
  for (let i = 0; i < TRIES; i++) {
    const start = now()
    try {
      const response = await fetchImpl(healthUrl(url), { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!response.ok) continue
      const rtt = now() - start
      best = best === null ? rtt : Math.min(best, rtt)
    } catch {
      // timed out or refused: this try does not count
    }
  }
  return { url, rttMs: best }
}

/** Every relay measured in parallel. */
export function measureRelays(urls: readonly string[], fetchImpl?: FetchLike): Promise<RelayMeasurement[]> {
  return Promise.all(urls.map((url) => measureRelay(url, fetchImpl)))
}
