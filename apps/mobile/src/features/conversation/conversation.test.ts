import type { TranscriptEntry } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import { diffForTool } from './diff'
import { summarizeTool } from './summarize-tool'
import {
  buildTimeline,
  EMPTY_TIMELINE,
  extendTimeline,
  mergeEntries,
  systemText,
  taskStatusText,
  taskTone,
} from './timeline'

const en = createI18n('en-US').t
const pt = createI18n('pt-BR').t

const base = { timestamp: null, isSidechain: false }
const e = {
  user: (c: number, text: string): TranscriptEntry => ({
    ...base,
    kind: 'user',
    text,
    images: [],
    cursor: c,
    index: 0,
    uuid: `u${c}`,
    key: `u${c}:0`,
  }),
  use: (c: number, id: string): TranscriptEntry => ({
    ...base,
    kind: 'tool_use',
    toolUseId: id,
    name: 'Bash',
    input: { command: 'ls' },
    cursor: c,
    index: 0,
    uuid: `t${c}`,
    key: `t${c}:0`,
  }),
  result: (c: number, id: string): TranscriptEntry => ({
    ...base,
    kind: 'tool_result',
    toolUseId: id,
    content: 'ok',
    isError: false,
    truncated: false,
    images: [],
    cursor: c,
    index: 0,
    uuid: `r${c}`,
    key: `r${c}:0`,
  }),
}

describe('timeline', () => {
  test('user items carry their images', () => {
    const ref = { id: '0.0', mediaType: 'image/png', bytes: 70 }
    const user = { ...e.user(0, ''), images: [ref] } as TranscriptEntry
    expect(buildTimeline([user])).toEqual([{ type: 'user', key: 'u0:0', text: '', images: [ref] }])
  })

  test('pairs tool calls with results', () => {
    const items = buildTimeline([e.user(0, 'oi'), e.use(1, 'a'), e.result(2, 'a'), e.result(3, 'orphan')])
    expect(items.map((i) => i.type)).toEqual(['user', 'tool', 'tool'])
    expect(items[1]).toMatchObject({ use: { toolUseId: 'a' }, result: { toolUseId: 'a' } })
    expect(items[2]).toMatchObject({ use: null, result: { toolUseId: 'orphan' } })
  })

  test('merges without duplicates in cursor order', () => {
    const merged = mergeEntries(
      [e.user(2, 'b'), e.user(0, 'a')],
      [e.user(2, 'b'), e.user(5, 'c'), e.user(1, 'x')],
    )
    expect(merged.map((x) => x.cursor)).toEqual([0, 1, 2, 5])
  })
})

describe('workflow items (#440)', () => {
  const call = {
    name: 'review-changes',
    description: 'Review the diff',
    phases: [{ title: 'Review', detail: null }],
  }
  const wf = (c: number, id: string): TranscriptEntry => ({
    ...base,
    kind: 'tool_use',
    toolUseId: id,
    name: 'Workflow',
    input: { script: '…' },
    workflow: call,
    cursor: c,
    index: 0,
    uuid: `w${c}`,
    key: `w${c}:0`,
  })
  const launch = (c: number, id: string): TranscriptEntry => {
    const result = e.result(c, id)
    if (result.kind !== 'tool_result') throw new Error('not a result')
    return { ...result, workflow: { taskId: 'w1', runId: 'wf_1', summary: 'Review the diff' } }
  }
  const done = (c: number, id: string | null): TranscriptEntry => ({
    ...base,
    kind: 'system',
    subtype: 'task_notification',
    text: 'Dynamic workflow "Review the diff" completed',
    status: 'completed',
    result: '{"ok":true}',
    ...(id ? { toolUseId: id } : {}),
    cursor: c,
    index: 0,
    uuid: `n${c}`,
    key: `n${c}:0`,
  })

  test('a Workflow call with its launch and notification becomes one workflow item', () => {
    const items = buildTimeline([wf(0, 'a'), launch(1, 'a'), e.use(2, 'b'), done(3, 'a')])
    expect(items.map((i) => i.type)).toEqual(['workflow', 'tool'])
    expect(items[0]).toMatchObject({
      type: 'workflow',
      use: { toolUseId: 'a', workflow: call },
      result: { workflow: { runId: 'wf_1' } },
      notification: { status: 'completed', result: '{"ok":true}' },
    })
  })

  test('a Workflow call without the normalized field stays a tool item; a notification without its call stays a line', () => {
    const plain = { ...e.use(0, 'a'), name: 'Workflow' } as TranscriptEntry
    const items = buildTimeline([plain, done(1, 'a'), done(2, null)])
    expect(items.map((i) => i.type)).toEqual(['tool', 'system', 'system'])
  })

  test('a launch and a notification arriving later attach to the card without rebuilding the rest', () => {
    const first = extendTimeline(EMPTY_TIMELINE, [e.user(0, 'go'), wf(1, 'a')])
    expect(first.items[1]).toMatchObject({ type: 'workflow', result: null, notification: null })
    const second = extendTimeline(first, [...first.entries, launch(2, 'a')])
    expect(second.items[0]).toBe(first.items[0])
    expect(second.items[1]).toMatchObject({
      type: 'workflow',
      result: { toolUseId: 'a' },
      notification: null,
    })
    const third = extendTimeline(second, [...second.entries, done(3, 'a')])
    expect(third.items).toHaveLength(2)
    expect(third.items[1]).toMatchObject({ type: 'workflow', notification: { status: 'completed' } })
    expect(third.items[1]).not.toBe(second.items[1])
    // A notification whose call is not loaded is a line of its own.
    const fourth = extendTimeline(third, [...third.entries, done(4, 'zz')])
    expect(fourth.items.at(-1)).toMatchObject({ type: 'system', subtype: 'task_notification' })
  })
})

describe('summarizeTool', () => {
  test.each([
    ['Bash', { command: 'pnpm test' }, 'Bash(pnpm test)'],
    ['Read', { file_path: '/w/src/app.ts' }, 'Read(app.ts)'],
    ['Grep', { pattern: 'TODO', path: '/w/src' }, 'Grep("TODO" in src)'],
    ['Grep', { pattern: 'TODO' }, 'Grep("TODO")'],
    ['Task', { description: 'Explorar código' }, 'Task(Explorar código)'],
    ['mcp__github__create_issue', { title: 'Bug' }, 'github:create_issue(Bug)'],
    ['TodoWrite', { todos: [1, 2] }, 'TodoWrite(2 items)'],
    ['Unknown', {}, 'Unknown'],
  ])('%s', (name, input, expected) => {
    expect(summarizeTool(name, input, en)).toBe(expected)
  })

  test('uses the active language', () => {
    expect(summarizeTool('Grep', { pattern: 'TODO', path: '/w/src' }, pt)).toBe('Grep("TODO" em src)')
    expect(summarizeTool('TodoWrite', { todos: [1] }, pt)).toBe('TodoWrite(1 item)')
    expect(summarizeTool('TodoWrite', { todos: [1, 2] }, pt)).toBe('TodoWrite(2 itens)')
  })
})

describe('diffForTool', () => {
  test('edit diff', () => {
    expect(diffForTool('Edit', { old_string: 'a\nb\n', new_string: 'a\nc\n' }, en)).toEqual([
      { kind: 'context', text: 'a' },
      { kind: 'remove', text: 'b' },
      { kind: 'add', text: 'c' },
    ])
  })

  test('write is all additions; other tools have no diff', () => {
    expect(diffForTool('Write', { content: 'x\ny' }, en)).toEqual([
      { kind: 'add', text: 'x' },
      { kind: 'add', text: 'y' },
    ])
    expect(diffForTool('Bash', { command: 'ls' }, en)).toBeNull()
  })

  test('caps long diffs with a translated marker', () => {
    const content = Array.from({ length: 405 }, (_, i) => `l${i}`).join('\n')
    expect(diffForTool('Write', { content }, en)?.at(-1)).toEqual({ kind: 'context', text: '… +5 lines' })
    expect(diffForTool('Write', { content }, pt)?.at(-1)).toEqual({ kind: 'context', text: '… +5 linhas' })
  })
})

describe('systemText', () => {
  test('writes duration and compaction lines in the app language', () => {
    const t = createI18n('pt-BR').t
    expect(
      systemText({ subtype: 'turn_duration', text: 'Turn completed in 1m 15s', durationMs: 75_000 }, t),
    ).toBe('Turno concluído em 1m 15s')
    expect(systemText({ subtype: 'compact_boundary', text: 'Conversation compacted' }, t)).toBe(
      'Conversa compactada',
    )
    expect(systemText({ subtype: 'info', text: 'raw' }, t)).toBe('raw')
  })

  test('qualifies the compaction line by trigger when known', () => {
    expect(
      systemText({ subtype: 'compact_boundary', text: 'Conversation compacted', trigger: 'auto' }, en),
    ).toBe('Conversation compacted automatically')
    expect(
      systemText({ subtype: 'compact_boundary', text: 'Conversation compacted', trigger: 'manual' }, pt),
    ).toBe('Conversa compactada manualmente')
    expect(
      systemText({ subtype: 'compact_boundary', text: 'Conversation compacted', trigger: 'idle' }, en),
    ).toBe('Conversation compacted')
    expect(systemText({ subtype: 'compact_boundary', text: 'Conversation compacted' }, en)).toBe(
      'Conversation compacted',
    )
  })
})

describe('task notifications', () => {
  test('tone by status, neutral for unknown ones', () => {
    expect(taskTone('completed')).toBe('done')
    expect(taskTone('failed')).toBe('failed')
    expect(taskTone('stopped')).toBe('stopped')
    expect(taskTone('killed')).toBe('stopped')
    expect(taskTone('paused')).toBe('other')
    expect(taskTone(undefined)).toBe('other')
  })

  test('status text is translated when known', () => {
    expect(taskStatusText('stopped', pt)).toBe('interrompida')
    expect(taskStatusText('completed', en)).toBe('completed')
    expect(taskStatusText('paused', en)).toBe('paused')
    expect(taskStatusText(undefined, en)).toBe('')
  })

  test('the timeline keeps status, note and tag of system entries', () => {
    const entry: TranscriptEntry = {
      ...base,
      kind: 'system',
      subtype: 'task_notification',
      text: 'Agent stopped',
      status: 'stopped',
      note: 'why',
      cursor: 1,
      index: 0,
      uuid: 's1',
      key: 's1:0',
    }
    expect(buildTimeline([entry])[0]).toMatchObject({ type: 'system', status: 'stopped', note: 'why' })
  })
})
