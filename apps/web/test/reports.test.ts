import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { FsReportsStore } from '../src/fs-stores.ts'
import { handleReport, RateLimiter, REPORTS_PER_HOUR, retentionCutoff } from '../src/reports.ts'
import { route } from '../src/routes.ts'

let dir = ''
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rh-reports-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const NOW = new Date('2026-11-14T10:00:00Z')
/** The smallest valid zip: an end-of-central-directory record. */
const EMPTY_ZIP = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)])
const zipOf = (size: number) => {
  const bytes = new Uint8Array(size)
  bytes.set([0x50, 0x4b, 0x03, 0x04])
  return bytes
}

function post(body: Uint8Array | string, { type = 'application/zip', ip = '203.0.113.7' } = {}): Request {
  return new Request('https://remoteharness.app/api/reports', {
    method: 'POST',
    headers: { 'content-type': type, 'x-forwarded-for': `${ip}, 10.0.0.2` },
    body,
  })
}

function deps(options: { quota?: number; max?: number } = {}) {
  let n = 0
  return {
    store: new FsReportsStore(join(dir, 'reports')),
    limiter: new RateLimiter(REPORTS_PER_HOUR, 3_600_000),
    now: () => NOW,
    id: () => `id-${++n}`,
    ...options,
  }
}

describe('POST /api/reports', () => {
  test('routes only that path', () => {
    expect(route('/api/reports')).toEqual({ kind: 'reports' })
    expect(route('/api/reports/')).toEqual({ kind: 'reports' })
    expect(route('/api/reports/x')).toEqual({ kind: 'not-found' })
  })

  test('stores a zip under its day and answers its id', async () => {
    const d = deps()
    const response = await handleReport(post(zipOf(3000)), d)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: 'id-1' })
    expect(await readdir(join(dir, 'reports', '2026-11-14'))).toEqual(['id-1.zip'])
    expect((await readFile(join(dir, 'reports', '2026-11-14', 'id-1.zip'))).length).toBe(3000)
    expect((await handleReport(post(EMPTY_ZIP), d)).status).toBe(201)
  })

  test('refuses what is not a zip, too large, or another method', async () => {
    const d = deps({ max: 1024 })
    expect((await handleReport(post('hello', { type: 'text/plain' }), d)).status).toBe(415)
    expect((await handleReport(post('not a zip at all'), d)).status).toBe(415)
    expect((await handleReport(post(zipOf(2048)), d)).status).toBe(413)
    const get = new Request('https://remoteharness.app/api/reports')
    expect((await handleReport(get, d)).status).toBe(405)
    expect(await readdir(dir)).toEqual([])
  })

  test('five uploads an hour per address', async () => {
    const d = deps()
    for (let i = 0; i < REPORTS_PER_HOUR; i++)
      expect((await handleReport(post(EMPTY_ZIP), d)).status).toBe(201)
    expect((await handleReport(post(EMPTY_ZIP), d)).status).toBe(429)
    expect((await handleReport(post(EMPTY_ZIP, { ip: '198.51.100.1' }), d)).status).toBe(201)
  })

  test('no uploads while the folder is over its quota', async () => {
    const d = deps({ quota: 4000 })
    expect((await handleReport(post(zipOf(3000)), d)).status).toBe(201)
    expect((await handleReport(post(zipOf(3000)), d)).status).toBe(507)
  })
})

describe('retention', () => {
  test('the sweep deletes day folders older than 30 days', async () => {
    const store = new FsReportsStore(join(dir, 'reports'))
    for (const day of ['2026-10-14', '2026-10-15', '2026-11-14']) {
      await mkdir(join(dir, 'reports', day), { recursive: true })
      await writeFile(join(dir, 'reports', day, 'a.zip'), 'PK')
    }
    expect(retentionCutoff(NOW)).toBe('2026-10-15')
    expect(await store.sweep(retentionCutoff(NOW))).toBe(1)
    expect((await readdir(join(dir, 'reports'))).sort()).toEqual(['2026-10-15', '2026-11-14'])
    expect(await store.usage()).toBe(4)
  })

  test('the limiter forgets an address after its window', () => {
    const limiter = new RateLimiter(1, 1000)
    expect(limiter.allow('a', 0)).toBe(true)
    expect(limiter.allow('a', 500)).toBe(false)
    expect(limiter.allow('a', 1500)).toBe(true)
  })
})
