import { describe, expect, test } from 'vitest'
import { DEMO_SESSIONS, entryLines, transcriptLines } from '../scripts/demo-data.ts'
import {
  burstEntries,
  longEntries,
  PERF_BURST_ID,
  PERF_BURST_SIZE,
  PERF_LONG_ENTRIES,
  perfPaneCommand,
  perfSessions,
} from '../scripts/demo-perf.ts'
import { parseTranscriptLine } from '../src/features/transcript/parser.ts'

const now = Date.parse('2026-10-25T12:00:00Z')
const cwd = '/Users/Shared/code/acme-api'

describe('demo performance scenario', () => {
  test('the long session has about 5,000 entries and every line parses', () => {
    const long = perfSessions()[0]!
    expect(long.entries).toHaveLength(PERF_LONG_ENTRIES)
    const lines = transcriptLines(long, cwd, now)
    const kinds = lines.slice(2).flatMap((line, i) => parseTranscriptLine(line, i).map((e) => e.kind))
    expect(kinds).not.toContain('unknown')
    expect(kinds.length).toBeGreaterThanOrEqual(PERF_LONG_ENTRIES)
  })

  test('the content is the same on every run', () => {
    expect(longEntries(200)).toEqual(longEntries(200))
    expect(burstEntries(3)).toEqual(burstEntries(3))
    expect(burstEntries(3)).not.toEqual(burstEntries(4))
  })

  test('bursts append lines that chain to the transcript so far', () => {
    const burst = perfSessions().find((s) => s.id === PERF_BURST_ID)!
    const at = () => new Date(now).toISOString()
    const first = entryLines(burst, cwd, burst.entries, { startIndex: 0, parent: null, at })
    const next = entryLines(burst, cwd, burstEntries(1), {
      startIndex: burst.entries.length,
      parent: first.parent,
      at,
    })
    expect(next.lines.length).toBeGreaterThanOrEqual(PERF_BURST_SIZE)
    const appended = next.lines.map((line) => JSON.parse(line) as { uuid: string; parentUuid: string | null })
    expect(appended[0]!.parentUuid).toBe(first.parent)
    const uuids = new Set(
      [...first.lines, ...next.lines].map((line) => (JSON.parse(line) as { uuid: string }).uuid),
    )
    expect(uuids.size).toBe(first.lines.length + next.lines.length)
    const kinds = next.lines.flatMap((line, i) => parseTranscriptLine(line, i).map((e) => e.kind))
    expect(kinds).not.toContain('unknown')
  })

  test('the sessions are new, and the bursty and terminal ones run', () => {
    const ids = new Set(DEMO_SESSIONS.map((s) => s.id))
    const sessions = perfSessions()
    expect(sessions.every((s) => !ids.has(s.id))).toBe(true)
    expect(sessions.map((s) => s.state)).toEqual(['idle', 'running', 'running'])
  })

  test('the terminal keeps printing', () => {
    expect(perfPaneCommand()).toMatch(/while :; do .*sleep 0\.2; done$/)
  })
})
