import { describe, expect, test } from 'vitest'
import {
  LAST_ACTIVITY_MAX_CHARS,
  lastActivityOf,
  previewText,
  SessionSchema,
  type TranscriptEntry,
} from '../src/index.ts'

const FALLBACK = '2026-10-31T12:00:00.000Z'
let line = 0
const base = (timestamp: string | null = '2026-10-31T11:59:00.000Z', isSidechain = false) => {
  const cursor = line++
  return { key: `u${cursor}:0`, cursor, index: 0, uuid: `u${cursor}`, timestamp, isSidechain }
}
const user = (text: string): TranscriptEntry => ({ ...base(), kind: 'user', text, images: [] })
const reply = (text: string, timestamp?: string | null): TranscriptEntry => ({
  ...base(timestamp),
  kind: 'assistant_text',
  text,
})
const tool = (name: string, input: Record<string, unknown>): TranscriptEntry => ({
  ...base(),
  kind: 'tool_use',
  toolUseId: `t${line}`,
  name,
  input,
})
const result: TranscriptEntry = {
  ...base(),
  kind: 'tool_result',
  toolUseId: 't',
  content: 'ok',
  isError: false,
  truncated: false,
  images: [],
}

describe('previewText', () => {
  test('strips markdown and joins lines', () => {
    expect(previewText('## Done\n\nI raised the **pool** to `20`, see [the docs](https://x.y).')).toBe(
      'Done I raised the pool to 20, see the docs.',
    )
    expect(previewText('- one\n- _two_\n> quoted\n1. three')).toBe('one two quoted three')
    expect(previewText('```ts\nconst a = 1\n```\nafter')).toBe('const a = 1 after')
  })

  test('keeps snake_case and arithmetic', () => {
    expect(previewText('rename max_pool_size to 2 * 10')).toBe('rename max_pool_size to 2 * 10')
  })

  test('cuts to the limit with an ellipsis', () => {
    const text = previewText('word '.repeat(300))
    expect(text.endsWith('word…') || text.endsWith('wor…')).toBe(true)
    expect([...text].length).toBeLessThanOrEqual(LAST_ACTIVITY_MAX_CHARS)
    expect(previewText('short')).toBe('short')
  })
})

describe('lastActivityOf', () => {
  test('the last reply, with its time', () => {
    expect(lastActivityOf([user('Fix it'), reply('I raised the **pool** to 20.')], FALLBACK)).toEqual({
      kind: 'assistant',
      text: 'I raised the pool to 20.',
      at: '2026-10-31T11:59:00.000Z',
    })
  })

  test('a running tool: its name and target, past its result', () => {
    expect(
      lastActivityOf([user('Fix'), tool('Edit', { file_path: '/repo/src/db/pool.ts' }), result], FALLBACK),
    ).toMatchObject({ kind: 'tool', text: 'Edit(pool.ts)' })
    expect(lastActivityOf([tool('Bash', { command: 'npm test\nnpm run lint' })], FALLBACK)).toMatchObject({
      text: 'Bash(npm test)',
    })
    expect(lastActivityOf([tool('Grep', { pattern: 'createPool', path: 'src/' })], FALLBACK)).toMatchObject({
      text: 'Grep(src)',
    })
    expect(lastActivityOf([tool('TodoWrite', { todos: [] })], FALLBACK)).toMatchObject({ text: 'TodoWrite' })
  })

  test('the last prompt, cut to one line', () => {
    const activity = lastActivityOf([reply('Hi'), user(`${'a'.repeat(450)}\n${'b'.repeat(450)}`)], FALLBACK)
    expect(activity?.kind).toBe('user')
    expect([...(activity?.text ?? '')]).toHaveLength(LAST_ACTIVITY_MAX_CHARS)
    expect(activity?.text).not.toContain('\n')
  })

  test('skips thinking, system lines, subagents and image-only prompts', () => {
    const entries: TranscriptEntry[] = [
      reply('The answer'),
      { ...base(), kind: 'thinking', text: 'hmm' },
      { ...base(), kind: 'system', subtype: 'turn_duration', text: 'Turn completed in 3s' },
      { ...base(null, true), kind: 'assistant_text', text: 'subagent' },
      { ...base(), kind: 'user', text: '', images: [] },
    ]
    expect(lastActivityOf(entries, FALLBACK)?.text).toBe('The answer')
  })

  test('a slash command counts as a prompt', () => {
    expect(
      lastActivityOf(
        [reply('x'), { ...base(), kind: 'system', subtype: 'command', text: '/review 12' }],
        FALLBACK,
      ),
    ).toMatchObject({ kind: 'user', text: '/review 12' })
  })

  test('falls back to the given time; null without anything', () => {
    expect(lastActivityOf([reply('x', null)], FALLBACK)?.at).toBe(FALLBACK)
    expect(lastActivityOf([result], FALLBACK)).toBeNull()
    expect(lastActivityOf([], FALLBACK)).toBeNull()
  })
})

test('sessions from older daemons have no last activity', () => {
  const parsed = SessionSchema.parse({
    id: 's',
    profileId: 'p',
    cwd: '/tmp',
    title: 't',
    state: 'idle',
    permissionMode: null,
    controllable: false,
    paneId: null,
    updatedAt: FALLBACK,
  })
  expect(parsed.lastActivity).toBeNull()
})
