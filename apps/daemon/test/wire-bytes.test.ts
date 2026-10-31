import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { diffPaneFrames, diffSessions, type Session, type TranscriptEntry } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { entryLines } from '../scripts/demo-data.ts'
import { burstEntries, longEntries, PERF_BURST_ID, PERF_LONG_ID } from '../scripts/demo-perf.ts'
import { claudeTranscript } from '../src/features/transcript/parser.ts'
import { DEFAULT_PAGE_SIZE } from '../src/features/transcript/service.ts'
import { TranscriptFile } from '../src/features/transcript/transcript-file.ts'
import { useTempHome } from './helpers.ts'

// Bytes on the wire for the #355 demo scenario, with the encoding before this change (one message
// per entry, full pane frames, full sessions, resumes of up to 2,000 lines) and after it. The
// numbers are printed for the pull request and the reductions asserted.
const home = useTempHome()
const bytes = (message: unknown) => Buffer.byteLength(JSON.stringify(message))
const at = (i: number) => new Date(Date.UTC(2026, 9, 25, 10, 0, i)).toISOString()
const rows: string[] = []
const report = (name: string, before: number, after: number) => {
  rows.push(
    `| ${name} | ${before.toLocaleString('en-US')} | ${after.toLocaleString('en-US')} | ${Math.round((1 - after / before) * 100)}% |`,
  )
}

async function transcript(id: string, entries: Parameters<typeof entryLines>[2]): Promise<TranscriptFile> {
  const path = join(home.dir(), `${id}.jsonl`)
  const { lines } = entryLines({ id, branch: 'main' }, '/code/app', entries, {
    startIndex: 0,
    parent: null,
    at,
  })
  await writeFile(path, `${lines.join('\n')}\n`)
  const file = new TranscriptFile(path, claudeTranscript)
  await file.sync()
  return file
}

describe('wire bytes for the #355 scenario', () => {
  test('a tool-heavy burst of 25 entries', async () => {
    const file = await transcript(PERF_BURST_ID, burstEntries(0))
    const { entries } = await file.since(-1, 10_000)
    const before = entries.reduce(
      (sum, entry: TranscriptEntry) =>
        sum + bytes({ type: 'transcript.entry', sessionId: PERF_BURST_ID, cursor: entry.cursor, entry }),
      0,
    )
    const after = bytes({ type: 'transcript.entries', sessionId: PERF_BURST_ID, entries })
    report(`burst: ${entries.length} entries (messages: ${entries.length} → 1)`, before, after)
    expect(after).toBeLessThan(before)
  })

  test('resuming the long session after 1,000 new lines', async () => {
    const file = await transcript(PERF_LONG_ID, longEntries())
    const cursor = file.lineCount - 1_000
    const before = bytes({
      type: 'transcript.page',
      sessionId: PERF_LONG_ID,
      entries: (await file.since(cursor, 2_000)).entries,
      hasMore: false,
      lineCount: file.lineCount,
    })
    const after = bytes({
      type: 'transcript.page',
      sessionId: PERF_LONG_ID,
      entries: (await file.page(file.lineCount, DEFAULT_PAGE_SIZE)).entries,
      hasMore: true,
      lineCount: file.lineCount,
    })
    report('resume: 1,000 lines behind', before, after)
    expect(after * 5).toBeLessThan(before)
  })

  test('a busy terminal: a 40-line build log, 5 lines a second, 10 s at 4 frames a second', () => {
    const line = (i: number) =>
      `\u001b[32m✓\u001b[0m compiled \u001b[1mpackages/module-${String(i).padStart(4, '0')}\u001b[0m in ${(i % 97) + 3}ms`
    const screen = (last: number) => ({
      text: Array.from({ length: 40 }, (_, i) => line(last - 39 + i)).join('\n'),
      cols: 120,
      rows: 40,
    })
    let before = 0
    let after = 0
    let previous: ReturnType<typeof screen> | null = null
    // 40 frames: each 250 ms the log grew by one or two lines.
    for (let frame = 0, last = 100; frame < 40; frame++, last += frame % 2 === 0 ? 1 : 2) {
      const next = screen(last)
      const full = bytes({ type: 'pane.frame', sessionId: 's', ...next })
      before += full
      const diff = diffPaneFrames(previous, next)
      after += diff ? bytes({ type: 'pane.diff', sessionId: 's', ...diff }) : full
      previous = next
    }
    report('terminal: 10 s of a scrolling log (40 frames)', before, after)
    expect(after * 5).toBeLessThan(before)
  })

  test('status line ticks on a session', () => {
    const session: Session = {
      id: PERF_LONG_ID,
      profileId: 'work',
      cwd: '/code/app',
      title: 'Long migration of the payments module',
      state: 'running',
      permissionMode: 'acceptEdits',
      approvalPolicy: null,
      permissionProfile: null,
      controllable: true,
      paneId: '%3',
      updatedAt: at(0),
      subagents: [],
      backgroundTasks: 0,
      lastActivity: null,
      checkout: { root: '/code/app', branch: 'feat/payments' },
      status: {
        model: 'Opus 5.5',
        effort: 'high',
        context: { usedTokens: 120_000, size: 200_000, percent: 60 },
      },
    }
    let before = 0
    let after = 0
    let previous = session
    for (let i = 1; i <= 30; i++) {
      const next = {
        ...previous,
        status: {
          ...previous.status,
          context: { usedTokens: 120_000 + i * 500, size: 200_000, percent: 60 + i * 0.25 },
        },
      } as Session
      before += bytes({ type: 'session.updated', session: next })
      after += bytes({ type: 'session.changed', sessionId: next.id, ...diffSessions(previous, next) })
      previous = next
    }
    report('session: 30 status line ticks', before, after)
    expect(after * 2).toBeLessThan(before)
    console.log(
      ['| Case | Before (bytes) | After (bytes) | Saved |', '| --- | ---: | ---: | ---: |', ...rows].join(
        '\n',
      ),
    )
  })
})
