import type { DaemonContext } from '../../main.ts'
import { adapterOf } from '../agents/index.ts'
import type { SessionStore } from '../sessions/store.ts'
import { TranscriptSearch } from './service.ts'

/** `transcript.search`: whole-word search over the known transcripts, read through each agent's format. */
export function registerSearchFeature(ctx: DaemonContext, store: SessionStore) {
  const search = new TranscriptSearch(store, (session) => adapterOf(session.agent).transcript)
  ctx.router.register('transcript.search', async (msg) => {
    const result = await search.search(msg)
    // Only counts are logged: never the query, the sessions read or the hits.
    ctx.logger.debug({ hits: result.hits.length, scanned: result.scanned }, 'transcript search')
    return { type: 'transcript.searchResult', ...result }
  })
  return { search }
}
