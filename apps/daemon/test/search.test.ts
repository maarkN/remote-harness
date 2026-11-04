import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { silentLogger } from '../src/core/logger.ts'
import { fold, matchRanges, queryTerms, snippetAround } from '../src/features/search/match.ts'
import {
  decodeCursor,
  encodeCursor,
  MAX_TRANSCRIPTS_PER_PAGE,
  type SearchCursor,
  TranscriptSearch,
} from '../src/features/search/service.ts'
import { SessionStore } from '../src/features/sessions/store.ts'
import type { SessionRecord } from '../src/features/sessions/types.ts'
import type { TranscriptFormat } from '../src/features/transcript/format.ts'
import { claudeTranscript } from '../src/features/transcript/parser.ts'
import { useTempHome } from './helpers.ts'

const home = useTempHome()

function record(id: string, patch: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id,
    profileId: 'claudin',
    cwd: '/w/app',
    title: id,
    state: 'idle',
    permissionMode: null,
    approvalPolicy: null,
    permissionProfile: null,
    controllable: true,
    paneId: null,
    updatedAt: '2026-11-01T10:00:00Z',
    subagents: [],
    backgroundTasks: 0,
    lastActivity: null,
    checkout: null,
    status: null,
    transcriptPath: null,
    ...patch,
  }
}

const user = (uuid: string, text: string) =>
  JSON.stringify({
    type: 'user',
    uuid,
    timestamp: '2026-11-01T10:00:00Z',
    message: { role: 'user', content: text },
  })
const assistant = (uuid: string, text: string) =>
  JSON.stringify({ type: 'assistant', uuid, message: { content: [{ type: 'text', text }] } })

function newStore(): SessionStore {
  return new SessionStore({ broadcast: () => {} }, join(home.dir(), 's.json'), silentLogger, 60_000)
}

async function transcript(name: string, lines: string[]): Promise<string> {
  const dir = join(home.dir(), 'transcripts')
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${name}.jsonl`)
  await writeFile(path, `${lines.join('\n')}\n`)
  return path
}

/** Two sessions: `b` is newer and mentions "pool" twice, `a` is older and mentions it once. */
async function fixture() {
  const store = newStore()
  const a = await transcript('a', [assistant('a2', 'connection pool exhausted')])
  const b = await transcript('b', [
    user('u1', 'please check the connection pool'),
    assistant('a1', 'The pool is fine'),
    user('u2', 'unrelated'),
  ])
  store.upsert('a', { updatedAt: '2026-11-01T10:00:00Z' }, () => record('a', { transcriptPath: a }))
  store.upsert('b', { updatedAt: '2026-11-02T10:00:00Z' }, () => record('b', { transcriptPath: b }))
  return { store, search: new TranscriptSearch(store, () => claudeTranscript) }
}

describe('matching', () => {
  test('folds case and accents and keeps the distinct query words in order', () => {
    expect(fold('Café POOL')).toBe('cafe pool')
    expect(queryTerms('  Café   POOL café ')).toEqual(['cafe', 'pool'])
    expect(queryTerms('!!! ...')).toEqual([])
  })

  test('matches whole words only, every term required', () => {
    const text = 'The connection pool is warm; pools are not'
    expect(matchRanges(text, ['pool'])).toEqual([{ start: 15, end: 19 }])
    expect(matchRanges(text, ['pool', 'warm'])).toEqual([
      { start: 15, end: 19 },
      { start: 23, end: 27 },
    ])
    expect(matchRanges(text, ['pool', 'missing'])).toEqual([])
    expect(matchRanges(text, ['poo'])).toEqual([])
    expect(matchRanges('Configuração do café', queryTerms('CAFE'))).toEqual([{ start: 16, end: 20 }])
    expect(matchRanges('anything', [])).toEqual([])
  })

  test('the snippet keeps whole words around the first match and shifts the ranges', () => {
    const short = 'hello pool'
    expect(snippetAround(short, matchRanges(short, ['pool']))).toEqual({
      snippet: short,
      ranges: [{ start: 6, end: 10 }],
      cutStart: false,
      cutEnd: false,
    })
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`)
    const text = words.join(' ')
    const middle = snippetAround(text, matchRanges(text, ['word50']), 60)
    expect(middle.snippet.length).toBeLessThanOrEqual(60)
    expect(middle.cutStart).toBe(true)
    expect(middle.cutEnd).toBe(true)
    expect(text.includes(middle.snippet)).toBe(true)
    expect(middle.snippet.split(' ').every((word) => words.includes(word))).toBe(true)
    const [range] = middle.ranges
    expect(range && middle.snippet.slice(range.start, range.end)).toBe('word50')
    const head = snippetAround(text, matchRanges(text, ['word0']), 60)
    expect(head).toMatchObject({ cutStart: false, cutEnd: true, ranges: [{ start: 0, end: 5 }] })
  })

  test('cursor codec', () => {
    const roundTrip = (cursor: SearchCursor) => decodeCursor(encodeCursor(cursor))
    expect(roundTrip({ sessionId: 'abc', from: null })).toEqual({ sessionId: 'abc', from: null })
    expect(roundTrip({ sessionId: 'a:b', from: { cursor: 12, index: 1 } })).toEqual({
      sessionId: 'a:b',
      from: { cursor: 12, index: 1 },
    })
    expect(decodeCursor('nocolon')).toBeNull()
    expect(decodeCursor(':3.0')).toBeNull()
    expect(decodeCursor('abc:x')).toBeNull()
  })
})

describe('TranscriptSearch', () => {
  test('finds hits newest session first and newest entry first, with what the app needs to open them', async () => {
    const { search } = await fixture()
    const result = await search.search({ query: 'pool' })
    expect(result.scanned).toBe(2)
    expect(result.nextCursor).toBeNull()
    expect(result.hits.map((hit) => [hit.sessionId, hit.key, hit.cursor, hit.kind])).toEqual([
      ['b', 'a1:0', 1, 'assistant_text'],
      ['b', 'u1:0', 0, 'user'],
      ['a', 'a2:0', 0, 'assistant_text'],
    ])
    expect(result.hits[0]).toMatchObject({
      index: 0,
      timestamp: null,
      snippet: 'The pool is fine',
      ranges: [{ start: 4, end: 8 }],
      cutStart: false,
      cutEnd: false,
    })
    expect(result.hits[1]?.timestamp).toBe('2026-11-01T10:00:00Z')
  })

  test('every word must match, whatever the case; a query without words finds nothing', async () => {
    const { search } = await fixture()
    const keys = async (query: string) => (await search.search({ query })).hits.map((hit) => hit.key)
    expect(await keys('Connection POOL')).toEqual(['u1:0', 'a2:0'])
    expect(await keys('pool fine')).toEqual(['a1:0'])
    expect(await search.search({ query: '???' })).toEqual({ hits: [], nextCursor: null, scanned: 0 })
  })

  test('pages continue from the cursor, across sessions', async () => {
    const { search } = await fixture()
    const first = await search.search({ query: 'pool', limit: 1 })
    expect(first.hits.map((hit) => hit.key)).toEqual(['a1:0'])
    expect(first.nextCursor).toBe('b:0.0')
    const second = await search.search({ query: 'pool', limit: 1, cursor: first.nextCursor ?? undefined })
    expect(second.hits.map((hit) => hit.key)).toEqual(['u1:0'])
    expect(second.nextCursor).toBe('a:0.0')
    const third = await search.search({ query: 'pool', limit: 1, cursor: second.nextCursor ?? undefined })
    expect(third.hits.map((hit) => hit.key)).toEqual(['a2:0'])
    expect(third.nextCursor).toBeNull()
    // The session a page stopped at is gone: the search starts over.
    const restarted = await search.search({ query: 'pool', cursor: 'gone:' })
    expect(restarted.hits).toHaveLength(3)
  })

  test('one session only; an unknown session is not found', async () => {
    const { search } = await fixture()
    const only = await search.search({ query: 'pool', sessionId: 'a' })
    expect(only.hits.map((hit) => hit.key)).toEqual(['a2:0'])
    expect(only.scanned).toBe(1)
    await expect(search.search({ query: 'pool', sessionId: 'nope' })).rejects.toMatchObject({
      code: 'not_found',
    })
  })

  test('a missing transcript file is skipped', async () => {
    const { store, search } = await fixture()
    const gone = join(home.dir(), 'gone.jsonl')
    store.upsert('c', { updatedAt: '2026-11-03T10:00:00Z' }, () => record('c', { transcriptPath: gone }))
    const result = await search.search({ query: 'pool' })
    expect(result.scanned).toBe(3)
    expect(result.hits.map((hit) => hit.sessionId)).toEqual(['b', 'b', 'a'])
  })

  test('reads at most MAX_TRANSCRIPTS_PER_PAGE transcripts per page and continues from the next', async () => {
    const store = newStore()
    for (let i = 0; i < MAX_TRANSCRIPTS_PER_PAGE + 5; i++) {
      const n = String(i).padStart(2, '0')
      store.upsert(`s${n}`, { updatedAt: `2026-11-01T10:${n}:00Z` }, () =>
        record(`s${n}`, { transcriptPath: `/t/${n}` }),
      )
    }
    const quiet = async function* () {
      yield user('u', 'nothing to see')
    }
    const search = new TranscriptSearch(store, () => claudeTranscript, quiet)
    const first = await search.search({ query: 'pool' })
    expect(first).toEqual({ hits: [], scanned: MAX_TRANSCRIPTS_PER_PAGE, nextCursor: 's04:' })
    const second = await search.search({ query: 'pool', cursor: first.nextCursor ?? undefined })
    expect(second).toEqual({ hits: [], scanned: 5, nextCursor: null })
  })

  test('a message appended again by an upserting format counts once', async () => {
    const store = newStore()
    store.upsert('g', {}, () => record('g', { transcriptPath: '/any' }))
    const format: TranscriptFormat = {
      upserts: true,
      parseLine: (raw, cursor) => [
        {
          kind: 'assistant_text',
          key: 'm:0',
          cursor,
          index: 0,
          uuid: 'm',
          timestamp: null,
          isSidechain: false,
          text: raw,
        },
      ],
      parseMeta: () => null,
      findImage: () => null,
    }
    const appended = async function* () {
      yield 'the pool'
      yield 'the pool, revised'
    }
    const search = new TranscriptSearch(store, () => format, appended)
    const result = await search.search({ query: 'pool' })
    expect(result.hits.map((hit) => [hit.cursor, hit.snippet])).toEqual([[0, 'the pool']])
  })
})
