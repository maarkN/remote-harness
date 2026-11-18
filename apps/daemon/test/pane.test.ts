import type { ServerMessage } from '@remote-harness/protocol'
import { afterEach, describe, expect, test } from 'vitest'
import { silentLogger } from '../src/core/logger.ts'
import { PaneStreamer } from '../src/features/pane/streamer.ts'
import type { Executor } from '../src/infra/exec.ts'
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

  test('streams to any viewer, and refresh captures right away (#614)', async () => {
    let content = 'a'
    const exec = fakeExecutor(() => ({ stdout: `80 24\n${content}` }))
    // A long interval: only `refresh` can bring the second frame within the test.
    streamer = new PaneStreamer(new TmuxClient(exec), silentLogger, 60_000)
    const sent: ServerMessage[] = []
    const closers: Array<() => void> = []
    const viewer = {
      send: (message: ServerMessage) => sent.push(message),
      onClose: (fn: () => void) => closers.push(fn),
    }
    streamer.subscribe('s', '%1', viewer)
    await wait(20)
    expect(sent).toEqual([expect.objectContaining({ type: 'pane.frame', text: 'a' })])
    content = 'b'
    streamer.refresh('s')
    await wait(20)
    expect(sent.map((m) => m.type)).toEqual(['pane.frame', 'pane.frame'])
    // Nothing subscribed: nothing captured.
    const calls = exec.calls.length
    streamer.refresh('other')
    for (const close of closers) close()
    expect(streamer.activeStreams).toBe(0)
    streamer.refresh('s')
    await wait(20)
    expect(exec.calls.length).toBe(calls)
  })

  test('a refresh during a capture captures again right after it', async () => {
    let content = 'a'
    let release = () => {}
    let captures = 0
    const exec: Executor = async () => {
      captures += 1
      if (captures === 1) await new Promise<void>((resolve) => (release = resolve))
      return { stdout: `80 24\n${content}`, stderr: '', exitCode: 0 }
    }
    streamer = new PaneStreamer(new TmuxClient(exec), silentLogger, 60_000)
    const sent: ServerMessage[] = []
    streamer.subscribe('s', '%1', { send: (message) => sent.push(message), onClose: () => undefined })
    content = 'b'
    streamer.refresh('s')
    release()
    await wait(20)
    expect(captures).toBe(2)
    expect(sent.at(-1)).toMatchObject({ type: 'pane.frame', text: 'b' })
  })
})
