import type { ServerMessage } from '@remote-harness/protocol'
import { afterEach, describe, expect, test } from 'vitest'
import { silentLogger } from '../src/core/logger.ts'
import { PaneStreamer } from '../src/features/pane/streamer.ts'
import { TmuxClient } from '../src/infra/tmux.ts'
import { fakeConnection, fakeExecutor } from './helpers.ts'

let streamer: PaneStreamer | undefined
afterEach(() => streamer?.dispose())

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('PaneStreamer', () => {
  test('captures size and colours in one tmux call', async () => {
    const exec = fakeExecutor(() => ({ stdout: '120 40\n\x1b[31mred\x1b[0m\n' }))
    expect(await new TmuxClient(exec).captureWithSize('%1')).toEqual({
      cols: 120,
      rows: 40,
      text: '\x1b[31mred\x1b[0m\n',
    })
    expect(exec.calls[0]?.args).toEqual([
      'display-message',
      '-p',
      '-t',
      '%1',
      '#{pane_width} #{pane_height}',
      ';',
      'capture-pane',
      '-p',
      '-e',
      '-t',
      '%1',
    ])
  })

  test('sends frames only when the pane changes and stops without viewers', async () => {
    let content = 'a'
    const exec = fakeExecutor(() => ({ stdout: `80 24\n${content}` }))
    streamer = new PaneStreamer(new TmuxClient(exec), silentLogger, 20)
    const conn = fakeConnection()
    streamer.subscribe('s', '%1', conn)
    await wait(70)
    const frames = () =>
      conn.sent.filter((m): m is Extract<ServerMessage, { type: 'pane.frame' }> => m.type === 'pane.frame')
    expect(frames()).toHaveLength(1)
    expect(frames()[0]).toMatchObject({ sessionId: 's', text: 'a', cols: 80, rows: 24 })
    content = 'b'
    await wait(50)
    expect(frames().map((f) => f.text)).toEqual(['a', 'b'])
    conn.close()
    expect(streamer.activeStreams).toBe(0)
    const calls = exec.calls.length
    await wait(50)
    expect(exec.calls.length).toBe(calls)
  })

  test('sends changed lines as diffs, and a full frame to a new viewer', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`)
    const exec = fakeExecutor(() => ({ stdout: `80 10\n${lines.join('\n')}` }))
    streamer = new PaneStreamer(new TmuxClient(exec), silentLogger, 20)
    const first = fakeConnection()
    streamer.subscribe('s', '%1', first)
    await wait(50)
    lines[9] = '$ done'
    await wait(50)
    expect(first.sent.map((m) => m.type)).toEqual(['pane.frame', 'pane.diff'])
    expect(first.sent[1]).toMatchObject({ type: 'pane.diff', lineCount: 10, lines: [[9, '$ done']] })
    const second = fakeConnection()
    streamer.subscribe('s', '%1', second)
    await wait(50)
    expect(second.sent).toEqual([expect.objectContaining({ type: 'pane.frame', text: lines.join('\n') })])
    expect(first.sent).toHaveLength(2)
  })
})
