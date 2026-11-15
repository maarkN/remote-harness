/**
 * Entry of `dist/server.js` (the container's command). Environment: `PORT` (8080), `DATA_DIR`
 * (`./data`), `UPDATES_TOKEN` and `UPDATES_DEV_TOKEN` (publishing is off without them),
 * `APP_INSTALL_URL` (the install link the landing's iPhone & iPad card opens, `/app/<token>/`;
 * the card points to the docs without it).
 */
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fsStores } from './fs-stores.ts'
import { RateLimiter, REPORTS_PER_HOUR, retentionCutoff, SWEEP_INTERVAL_MS } from './reports.ts'
import { closeServer, createSiteServer } from './server.ts'
import { siteConfig } from './site.ts'

const port = Number(process.env.PORT ?? 8080)
const dataDir = resolve(process.env.DATA_DIR ?? 'data')
await mkdir(resolve(dataDir, 'updates'), { recursive: true })
await mkdir(resolve(dataDir, 'app'), { recursive: true })
await mkdir(resolve(dataDir, 'reports'), { recursive: true })

const stores = fsStores(dataDir)
// Reports older than the retention go at start and every few hours (ADR 0008).
const sweep = () =>
  void stores.reportFiles.sweep(retentionCutoff(new Date())).catch((error: unknown) => console.error(error))
sweep()
setInterval(sweep, SWEEP_INTERVAL_MS).unref()

const server = createSiteServer({
  ...stores,
  reports: { store: stores.reportFiles, limiter: new RateLimiter(REPORTS_PER_HOUR, 3_600_000) },
  tokens: {
    token: process.env.UPDATES_TOKEN || undefined,
    devToken: process.env.UPDATES_DEV_TOKEN || undefined,
  },
  site: siteConfig(process.env),
})
server.listen(port, () => console.log(`remoteharness.app on :${port}, data in ${dataDir}`))

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    // A request that never ends must not keep the container from stopping.
    setTimeout(() => process.exit(1), 10_000).unref()
    closeServer(server).then(
      () => process.exit(0),
      () => process.exit(1),
    )
  })
}
