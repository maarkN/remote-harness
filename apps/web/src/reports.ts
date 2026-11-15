/**
 * Problem reports from the app (#557, ADR 0008): one zip per report, kept 30 days, never readable
 * over HTTP. The limits keep a public upload endpoint from filling the disk.
 */

export const REPORTS_PATH = '/api/reports'
export const MAX_REPORT_BYTES = 25 * 1024 * 1024
export const REPORTS_QUOTA_BYTES = 2 * 1024 * 1024 * 1024
export const REPORTS_PER_HOUR = 5
export const RETENTION_DAYS = 30
/** How often the server deletes expired reports. */
export const SWEEP_INTERVAL_MS = 6 * 3_600_000

/** Where the reports live; days are `YYYY-MM-DD` folders. */
export type ReportsStore = {
  put(day: string, id: string, data: Uint8Array): Promise<void>
  /** Bytes held by every report. */
  usage(): Promise<number>
  /** Deletes the day folders before `cutoffDay`; returns how many. */
  sweep(cutoffDay: string): Promise<number>
}

/** At most `limit` hits per key within a sliding `windowMs`. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(now)
    this.hits.set(key, recent)
    // Old keys leave the map so it cannot grow without bound.
    if (this.hits.size > 10_000)
      for (const [k, v] of this.hits) if (v.every((at) => now - at >= this.windowMs)) this.hits.delete(k)
    return true
  }
}

export type ReportDeps = {
  store: ReportsStore
  limiter: RateLimiter
  now?: () => Date
  id?: () => string
  /** Overrides for tests. */
  max?: number
  quota?: number
}

const day = (date: Date) => date.toISOString().slice(0, 10)

/** The first day kept: reports in folders before it are deleted. */
export function retentionCutoff(now: Date, days = RETENTION_DAYS): string {
  return day(new Date(now.getTime() - days * 86_400_000))
}

/** A zip starts with a local file header or, when empty, the end-of-central-directory record. */
function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)
}

/** The body, or null as soon as it passes `max` bytes (the rest is not read). */
async function readLimited(body: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/** The visitor's address as Traefik passes it (first entry of `X-Forwarded-For`). */
function clientAddress(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/** `POST /api/reports`: validates, limits and stores one report. */
export async function handleReport(request: Request, deps: ReportDeps): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } })
  const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  if (type !== 'application/zip') return json(415, { error: 'zip only' })
  const max = deps.max ?? MAX_REPORT_BYTES
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > max) return json(413, { error: 'too large' })
  const now = (deps.now ?? (() => new Date()))()
  if (!deps.limiter.allow(clientAddress(request), now.getTime()))
    return json(429, { error: 'too many reports' })
  const body = await readLimited(request.body, max)
  if (!body) return json(413, { error: 'too large' })
  if (!isZip(body)) return json(415, { error: 'zip only' })
  if ((await deps.store.usage()) + body.byteLength > (deps.quota ?? REPORTS_QUOTA_BYTES))
    return json(507, { error: 'no room for reports now' })
  const id = (deps.id ?? (() => crypto.randomUUID()))()
  await deps.store.put(day(now), id, body)
  return json(201, { id })
}
